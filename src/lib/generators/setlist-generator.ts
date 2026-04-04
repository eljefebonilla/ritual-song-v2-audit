import { createAdminClient } from "../supabase/admin";
import { launchBrowser, renderPdf } from "./pdf-renderer";
import { loadTemplate, loadBaseCss, injectBrandCss, injectData, applyLayoutPreset } from "./template-engine";
import { loadParishFonts } from "./font-loader";
import type { BrandConfig, GenerationResult } from "./types";
import { DEFAULT_BRAND_CONFIG } from "./types";
import type {
  SetlistSongRow,
  SetlistPersonnel,
  SetlistSafetySong,
} from "../booking-types";

interface SetlistInput {
  massEventId: string;
  parishId: string;
}

/**
 * Generate a setlist/menu PDF for a single mass event.
 * Returns the PDF URL and storage path in Supabase.
 */
export async function generateSetlistPdf(
  input: SetlistInput
): Promise<GenerationResult> {
  const warnings: string[] = [];
  const supabase = createAdminClient();

  // 1. Fetch mass event
  const { data: massEvent, error: massError } = await supabase
    .from("mass_events")
    .select("id, event_date, start_time_12h, community, celebrant, liturgical_name, occasion_id, season")
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
  const personnel = (setlist.personnel || []) as SetlistPersonnel[];
  const safetySong = setlist.safety_song as SetlistSafetySong | null;

  // 3. Fetch parish brand config
  const brand = await fetchBrandConfig(supabase, input.parishId);

  // 4. Build HTML
  const templateName = `${brand.layoutPreset}.html`;
  let html = loadTemplate("setlist", templateName);
  const baseCss = loadBaseCss("setlist");

  // Inject base CSS
  html = html.replace("{{BASE_CSS}}", `<style>${baseCss}</style>`);

  // Load parish fonts and inject brand CSS
  const fonts = await loadParishFonts(input.parishId, brand.headingFont, brand.bodyFont);
  html = injectBrandCss(html, brand, fonts);

  // Apply layout preset
  html = applyLayoutPreset(html, brand.layoutPreset);

  // Build song rows HTML
  const songRowsHtml = buildSongRowsHtml(songRows);

  // Build personnel HTML
  const personnelHtml = buildPersonnelHtml(personnel, setlist.choir_label);

  // Build safety song HTML
  const safetyHtml = safetySong ? buildSafetyHtml(safetySong) : "";

  // Build designation HTML
  const designationHtml = setlist.special_designation
    ? `<div class="header__designation">${escapeHtml(setlist.special_designation)}</div>`
    : "";

  // Format date
  const dateDisplay = formatDate(massEvent.event_date);

  // Inject data
  html = injectData(html, {
    PARISH_NAME: brand.parishDisplayName,
    OCCASION_NAME: setlist.occasion_name || massEvent.liturgical_name || "Mass",
    DESIGNATION_HTML: designationHtml,
    DATE: dateDisplay,
    MASS_TIME: massEvent.start_time_12h || "",
    ENSEMBLE: massEvent.community || "",
    SONG_ROWS: songRowsHtml,
    PERSONNEL_HTML: personnelHtml,
    SAFETY_HTML: safetyHtml,
  });

  // 5. Render PDF via Puppeteer
  const browser = await launchBrowser();
  try {
    const pdfBytes = await renderPdf(browser, html);

    // 6. Upload to Supabase storage
    const occasionCode = massEvent.occasion_id || "mass";
    const ensemble = (massEvent.community || "all").toLowerCase().replace(/\s+/g, "-");
    const storagePath = `${input.parishId}/setlists/${occasionCode}_${ensemble}.pdf`;

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
  } finally {
    await browser.close();
  }
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

function buildSongRowsHtml(rows: SetlistSongRow[]): string {
  return rows
    .map((row) => {
      const conditionalClass = row.is_conditional ? " song-row--conditional" : "";

      if (row.display_value) {
        return `<tr class="song-row${conditionalClass}">
  <td class="song-row__label">${escapeHtml(row.label)}</td>
  <td class="song-row__content">
    <div class="song-row__display">${escapeHtml(row.display_value)}</div>
  </td>
</tr>`;
      }

      if (row.songs.length === 0) {
        return `<tr class="song-row${conditionalClass}">
  <td class="song-row__label">${escapeHtml(row.label)}</td>
  <td class="song-row__content">
    <div class="song-row__empty">&mdash;</div>
  </td>
</tr>`;
      }

      const songsHtml = row.songs
        .map((s) => {
          let html = `<div class="song-row__title">${escapeHtml(s.title)}</div>`;
          if (s.composer) html += `<div class="song-row__composer">${escapeHtml(s.composer)}</div>`;
          if (s.hymnal_number) html += `<div class="song-row__hymnal">${escapeHtml(s.hymnal_number)}</div>`;
          return html;
        })
        .join("");

      let extras = "";
      if (row.thematic_note) {
        extras += `<div class="song-row__thematic">${escapeHtml(row.thematic_note)}</div>`;
      }
      if (row.assignment_text) {
        extras += `<div class="song-row__assignment">${escapeHtml(row.assignment_text)}</div>`;
      }

      return `<tr class="song-row${conditionalClass}">
  <td class="song-row__label">${escapeHtml(row.label)}</td>
  <td class="song-row__content">${songsHtml}${extras}</td>
</tr>`;
    })
    .join("\n");
}

function buildPersonnelHtml(
  personnel: SetlistPersonnel[],
  choirLabel: string | null
): string {
  if (personnel.length === 0 && !choirLabel) return "";

  const left = personnel.filter((p) => p.side === "left");
  const right = personnel.filter((p) => p.side === "right");

  const renderCol = (people: SetlistPersonnel[]) =>
    people
      .map(
        (p) =>
          `<div class="personnel__entry"><span class="personnel__name">${escapeHtml(p.person_name)}</span> <span class="personnel__role">${escapeHtml(p.role_label)}</span></div>`
      )
      .join("\n");

  let html = `<div class="personnel">
  <div class="personnel__col">${renderCol(left)}</div>
  <div class="personnel__col">${renderCol(right)}`;

  if (choirLabel) {
    html += `\n    <div class="personnel__entry"><span class="personnel__role">${escapeHtml(choirLabel)}</span></div>`;
  }

  html += `</div>\n</div>`;
  return html;
}

function buildSafetyHtml(song: SetlistSafetySong): string {
  let inner = `<div class="safety__label">Safety Song</div>`;
  inner += `<div class="safety__title">${escapeHtml(song.title)}</div>`;
  if (song.composer) inner += `<div class="safety__composer">${escapeHtml(song.composer)}</div>`;
  if (song.hymnal_number) inner += `<div class="song-row__hymnal">${escapeHtml(song.hymnal_number)}</div>`;
  return `<div class="safety">${inner}</div>`;
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
