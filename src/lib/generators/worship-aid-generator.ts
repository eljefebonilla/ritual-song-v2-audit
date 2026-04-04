import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "../supabase/admin";
import { getScriptureSongsForOccasion } from "../supabase/scripture-mappings";
import { getOccasion } from "../data";
import { launchBrowser, renderPdf } from "./pdf-renderer";
import {
  copyPagesFrom,
  mergePuppeteerPdf,
  addBannerOverlay,
  addReplaceOverlay,
  embedImagePage,
  addPageNumbers,
  assembleFinalPdf,
} from "./pdf-assembler";
import { loadTemplate, loadBaseCss, injectBrandCss, injectData, applyLayoutPreset } from "./template-engine";
import { resolveCoverImage, fetchCoverImageBytes } from "./cover-resolver";
import { resolveWorshipAidReprint, fetchReprintBytes } from "./reprint-resolver";
import { loadParishFonts } from "./font-loader";
import type { BrandConfig, GenerationResult, ReprintResult } from "./types";
import { DEFAULT_BRAND_CONFIG } from "./types";
import type { SetlistSongRow, SetlistSongEntry } from "../booking-types";
import type { Reading, LiturgicalOccasion } from "../types";

interface WorshipAidInput {
  massEventId: string;
  parishId: string;
}

const READING_TYPE_LABELS: Record<string, string> = {
  entrance_antiphon: "Entrance Ant.",
  first_reading: "1st Reading",
  second_reading: "2nd Reading",
  sequence: "Sequence",
  gospel: "Gospel",
  communion_antiphon: "Communion Ant.",
};

// Positions in Mass order, with their liturgical section
const MASS_SECTIONS: { section: string; positions: string[] }[] = [
  {
    section: "Introductory Rites",
    positions: ["gathering", "penitential_act", "gloria"],
  },
  {
    section: "Liturgy of the Word",
    positions: ["psalm", "gospel_acclamation"],
  },
  {
    section: "Preparation of the Gifts",
    positions: ["offertory"],
  },
  {
    section: "Liturgy of the Eucharist",
    positions: ["holy", "memorial", "amen", "lords_prayer", "fraction_rite"],
  },
  {
    section: "Communion Rite",
    positions: ["communion_1", "communion_2", "communion_3"],
  },
  {
    section: "Concluding Rites",
    positions: ["sending"],
  },
];

/**
 * Generate a worship aid PDF for a single mass event.
 * Hybrid pipeline: Puppeteer renders cover + text pages,
 * pdf-lib merges existing reprint PDFs (preserving vector quality).
 */
export async function generateWorshipAidPdf(
  input: WorshipAidInput
): Promise<GenerationResult> {
  const warnings: string[] = [];
  const supabase = createAdminClient();

  // 1. Fetch mass event
  const { data: massEvent, error: massError } = await supabase
    .from("mass_events")
    .select("id, event_date, start_time_12h, ensemble, celebrant, liturgical_name, occasion_id, season")
    .eq("id", input.massEventId)
    .single();

  if (massError || !massEvent) {
    return { success: false, error: "Mass event not found", warnings };
  }

  // 2. Fetch setlist
  const { data: setlist, error: setlistError } = await supabase
    .from("setlists")
    .select("*")
    .eq("mass_event_id", input.massEventId)
    .single();

  if (setlistError || !setlist) {
    return { success: false, error: "No setlist found for this mass event", warnings };
  }

  const songRows = (setlist.songs || []) as SetlistSongRow[];

  // 3. Load occasion data (readings, psalm response)
  const occasion = massEvent.occasion_id
    ? getOccasion(massEvent.occasion_id)
    : null;

  // 4. Fetch brand config
  const brand = await fetchBrandConfig(supabase, input.parishId);

  // 5. Resolve cover image
  const occasionCode = massEvent.occasion_id || "mass";
  const cycle = occasion?.year || "A";
  const coverImage = await resolveCoverImage(
    input.parishId,
    occasionCode,
    cycle,
    brand
  );

  // 6. Resolve reprints for all songs (parallel)
  const songReprintMap = new Map<string, { reprint: ReprintResult; title: string }>();
  const reprintPromises = songRows.flatMap((row) =>
    row.songs
      .filter((s) => s.song_library_id)
      .map(async (s) => {
        const reprint = await resolveWorshipAidReprint(s.song_library_id!);
        songReprintMap.set(s.song_library_id!, { reprint, title: s.title });
      })
  );
  await Promise.all(reprintPromises);

  // 7. Load parish fonts for inlining
  const fonts = await loadParishFonts(input.parishId, brand.headingFont, brand.bodyFont);

  // 8. Render cover page via Puppeteer
  const browser = await launchBrowser();
  try {
    const coverPdfBytes = await renderCoverPage(
      browser,
      brand,
      coverImage,
      setlist.occasion_name || massEvent.liturgical_name || "Mass",
      formatDate(massEvent.event_date),
      fonts
    );

    // 8b. Fetch scripture mappings for scripture notes
    const scriptureNoteMap = new Map<string, string>();
    if (massEvent.occasion_id) {
      const mappings = await getScriptureSongsForOccasion(massEvent.occasion_id);
      for (const m of mappings) {
        if (m.legacyId && !scriptureNoteMap.has(m.legacyId)) {
          const label = READING_TYPE_LABELS[m.readingType] || m.readingType;
          scriptureNoteMap.set(
            m.legacyId,
            m.readingReference ? `${m.readingReference} (${label})` : label
          );
        }
      }
    }

    // 9. Render content pages via Puppeteer
    const contentPdfBytes = await renderContentPages(
      browser,
      brand,
      songRows,
      occasion,
      songReprintMap,
      fonts,
      scriptureNoteMap
    );

    // 9. Close browser (done with Puppeteer)
    await browser.close();

    // 10. Assemble final PDF with pdf-lib
    const finalDoc = await PDFDocument.create();

    // Add cover page
    await mergePuppeteerPdf(finalDoc, coverPdfBytes);

    // Add content pages
    await mergePuppeteerPdf(finalDoc, contentPdfBytes);

    // Add reprint pages in Mass order
    for (const massSection of MASS_SECTIONS) {
      for (const position of massSection.positions) {
        const row = songRows.find((r) => r.position === position);
        if (!row) continue;

        for (const song of row.songs) {
          if (!song.song_library_id) continue;
          const entry = songReprintMap.get(song.song_library_id);
          if (!entry) continue;

          const pagesBefore = finalDoc.getPageCount();

          if (entry.reprint.kind === "pdf") {
            const bytes = await fetchReprintBytes(entry.reprint.storagePath);
            if (bytes) {
              await copyPagesFrom(finalDoc, bytes);
              // Add banner overlay to first reprint page
              if (brand.headerOverlayMode === "replace") {
                await addReplaceOverlay(finalDoc, pagesBefore, brand, song.title);
              } else {
                await addBannerOverlay(finalDoc, pagesBefore, brand, song.title);
              }
            } else {
              warnings.push(`Failed to fetch reprint for "${song.title}"`);
            }
          } else if (entry.reprint.kind === "gif") {
            const bytes = await fetchReprintBytes(entry.reprint.storagePath);
            if (bytes) {
              // GIF needs conversion to PNG for pdf-lib
              // For now, attempt PNG embed (most "GIF" resources are actually PNG)
              try {
                await embedImagePage(finalDoc, bytes, "png");
                if (brand.headerOverlayMode === "banner") {
                  await addBannerOverlay(
                    finalDoc,
                    pagesBefore,
                    brand,
                    song.title
                  );
                }
              } catch {
                warnings.push(`GIF reprint for "${song.title}" could not be embedded (raster format unsupported)`);
              }
            }
          }
          // lyrics and title_only are handled in the content pages, not as separate reprint pages
        }
      }
    }

    // Optional: add page numbers (skip cover page)
    await addPageNumbers(finalDoc, 1);

    // 11. Save final PDF
    const pdfBytes = await assembleFinalPdf(finalDoc);

    // 12. Upload to Supabase storage
    const ensemble = (massEvent.ensemble || "all").toLowerCase().replace(/\s+/g, "-");
    const contentHash = hashBytes(pdfBytes).slice(0, 8);
    const storagePath = `${input.parishId}/worship-aids/${occasionCode}_${ensemble}_${contentHash}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("song-resources")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}`, warnings };
    }

    const { data: urlData } = supabase.storage
      .from("song-resources")
      .getPublicUrl(storagePath);

    return {
      success: true,
      pdfUrl: urlData.publicUrl,
      storagePath,
      warnings,
    };
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

async function renderCoverPage(
  browser: Awaited<ReturnType<typeof launchBrowser>>,
  brand: BrandConfig,
  coverImage: Awaited<ReturnType<typeof resolveCoverImage>>,
  occasionName: string,
  dateDisplay: string,
  fonts: import("./types").FontAsset[] = []
): Promise<Uint8Array> {
  let html = loadTemplate("worship-aid", "cover.html");
  const baseCss = loadBaseCss("worship-aid");

  html = html.replace("{{BASE_CSS}}", `<style>${baseCss}</style>`);
  html = injectBrandCss(html, brand, fonts);
  html = applyLayoutPreset(html, brand.layoutPreset);

  // Cover background
  let coverBgHtml: string;
  if (coverImage.kind === "image" && coverImage.url) {
    coverBgHtml = `<img class="cover__bg" src="${escapeAttr(coverImage.url)}" alt="" />`;
  } else if (coverImage.kind === "image" && coverImage.storagePath) {
    const bytes = await fetchCoverImageBytes(coverImage.storagePath);
    if (bytes) {
      const b64 = Buffer.from(bytes.bytes).toString("base64");
      const mime = bytes.format === "png" ? "image/png" : "image/jpeg";
      coverBgHtml = `<img class="cover__bg" src="data:${mime};base64,${b64}" alt="" />`;
    } else {
      coverBgHtml = buildGradientBg(brand.primaryColor, brand.accentColor);
    }
  } else {
    const colors = coverImage.kind === "gradient" ? coverImage.colors : [brand.primaryColor, brand.accentColor];
    coverBgHtml = buildGradientBg(colors[0], colors[1]);
  }

  // Logo
  const logoHtml = brand.logoUrl
    ? `<img class="cover__logo" src="${escapeAttr(brand.logoUrl)}" alt="" />`
    : "";

  html = injectData(html, {
    COVER_BG: coverBgHtml,
    LOGO_HTML: logoHtml,
    PARISH_NAME: brand.parishDisplayName,
    OCCASION_NAME: occasionName,
    DATE: dateDisplay,
  });

  return renderPdf(browser, html);
}

async function renderContentPages(
  browser: Awaited<ReturnType<typeof launchBrowser>>,
  brand: BrandConfig,
  songRows: SetlistSongRow[],
  occasion: LiturgicalOccasion | null,
  reprintMap: Map<string, { reprint: ReprintResult; title: string }>,
  fonts: import("./types").FontAsset[] = [],
  scriptureNoteMap?: Map<string, string>
): Promise<Uint8Array> {
  let html = loadTemplate("worship-aid", "content.html");
  const baseCss = loadBaseCss("worship-aid");

  html = html.replace("{{BASE_CSS}}", `<style>${baseCss}</style>`);
  html = injectBrandCss(html, brand, fonts);
  html = applyLayoutPreset(html, brand.layoutPreset);

  // Build content sections HTML
  const sectionsHtml = buildContentSectionsHtml(songRows, occasion, reprintMap, scriptureNoteMap);

  html = injectData(html, {
    CONTENT_SECTIONS: sectionsHtml,
  });

  return renderPdf(browser, html);
}

function buildContentSectionsHtml(
  songRows: SetlistSongRow[],
  occasion: LiturgicalOccasion | null,
  reprintMap: Map<string, { reprint: ReprintResult; title: string }>,
  scriptureNoteMap?: Map<string, string>
): string {
  const parts: string[] = [];

  for (const section of MASS_SECTIONS) {
    const sectionParts: string[] = [];

    // Add readings for Liturgy of the Word
    if (section.section === "Liturgy of the Word" && occasion) {
      const firstReading = occasion.readings.find((r) => r.type === "first");
      if (firstReading) {
        sectionParts.push(buildReadingHtml("First Reading", firstReading));
      }
    }

    for (const position of section.positions) {
      const row = songRows.find((r) => r.position === position);
      if (!row) continue;

      // Add psalm response box
      if (position === "psalm" && occasion) {
        const psalmReading = occasion.readings.find((r) => r.type === "psalm");
        if (psalmReading?.antiphon) {
          sectionParts.push(buildPsalmResponseHtml(psalmReading.antiphon));
        }
      }

      // Add readings between positions
      if (position === "gospel_acclamation" && occasion) {
        const secondReading = occasion.readings.find((r) => r.type === "second");
        if (secondReading) {
          sectionParts.push(buildReadingHtml("Second Reading", secondReading));
        }
        const gospel = occasion.readings.find((r) => r.type === "gospel");
        if (gospel) {
          sectionParts.push(buildReadingHtml("Gospel", gospel));
        }
      }

      // Song entries (only show text for songs without PDF/GIF reprints)
      for (const song of row.songs) {
        const hasReprint = song.song_library_id
          ? reprintMap.get(song.song_library_id)
          : null;
        const scriptureNote = song.song_library_id && scriptureNoteMap?.get(song.song_library_id);

        if (hasReprint && (hasReprint.reprint.kind === "pdf" || hasReprint.reprint.kind === "gif")) {
          sectionParts.push(buildSongEntryHtml(row.label, song, "(see sheet music)", scriptureNote || null));
        } else if (hasReprint && hasReprint.reprint.kind === "lyrics") {
          sectionParts.push(buildSongEntryHtml(row.label, song, null, scriptureNote || null));
        } else {
          sectionParts.push(buildSongEntryHtml(row.label, song, null, scriptureNote || null));
        }
      }

      if (row.songs.length === 0 && row.display_value) {
        sectionParts.push(`<div class="song-entry">
  <div class="song-entry__position">${escapeHtml(row.label)}</div>
  <div class="song-entry__title" style="font-style: italic; font-weight: 400;">${escapeHtml(row.display_value)}</div>
</div>`);
      }
    }

    if (sectionParts.length > 0) {
      parts.push(`<div class="section-header">${escapeHtml(section.section)}</div>`);
      parts.push(...sectionParts);
    }
  }

  return parts.join("\n");
}

function buildReadingHtml(label: string, reading: Reading): string {
  return `<div class="reading">
  <div class="reading__type">${escapeHtml(label)}</div>
  <div class="reading__citation">${escapeHtml(reading.citation)}</div>
  <div class="reading__summary">${escapeHtml(reading.summary)}</div>
</div>`;
}

function buildPsalmResponseHtml(response: string): string {
  return `<div class="psalm-response">
  <div class="psalm-response__label">Response</div>
  <div class="psalm-response__text">${escapeHtml(response)}</div>
</div>`;
}

function buildSongEntryHtml(
  positionLabel: string,
  song: SetlistSongEntry,
  note: string | null,
  scriptureNote?: string | null
): string {
  let html = `<div class="song-entry">
  <div class="song-entry__position">${escapeHtml(positionLabel)}</div>
  <div class="song-entry__title">${escapeHtml(song.title)}</div>`;
  if (song.composer) {
    html += `\n  <div class="song-entry__composer">${escapeHtml(song.composer)}</div>`;
  }
  if (scriptureNote) {
    html += `\n  <div class="song-entry__scripture" style="font-style:italic;font-size:0.8em;color:#555;margin-top:2px;">Scripture: ${escapeHtml(scriptureNote)}</div>`;
  }
  if (note) {
    html += `\n  <div class="song-entry__lyrics-note">${escapeHtml(note)}</div>`;
  }
  html += `\n</div>`;
  return html;
}

function buildGradientBg(color1: string, color2: string): string {
  return `<div class="cover__gradient" style="background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%);"></div>`;
}

async function fetchBrandConfig(
  supabase: ReturnType<typeof createAdminClient>,
  parishId: string
): Promise<BrandConfig> {
  const { data } = await supabase
    .from("parish_brand_config")
    .select("*")
    .eq("parish_id", parishId)
    .maybeSingle();

  if (!data) {
    return { parishId, ...DEFAULT_BRAND_CONFIG };
  }

  return {
    parishId,
    logoUrl: data.logo_url,
    logoStoragePath: data.logo_storage_path,
    parishDisplayName: data.parish_display_name || "",
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    accentColor: data.accent_color,
    headingFont: data.heading_font,
    bodyFont: data.body_font,
    layoutPreset: data.layout_preset as BrandConfig["layoutPreset"],
    coverStyle: data.cover_style as BrandConfig["coverStyle"],
    headerOverlayMode: data.header_overlay_mode as BrandConfig["headerOverlayMode"],
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 0;
  for (let i = 0; i < bytes.length; i += 64) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return Math.abs(hash).toString(36);
}
