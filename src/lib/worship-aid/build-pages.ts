/**
 * Page builder for the Worship Aid Builder.
 * Loads an occasion via getOccasion(), resolves reprints from Supabase,
 * resolves cover art, fetches brand config, and builds the WorshipAid.
 *
 * SERVER-SIDE ONLY.
 */

import { randomUUID } from "node:crypto";
import { getOccasion } from "@/lib/data";
import { resolveWorshipAidReprint } from "@/lib/generators/reprint-resolver";
import { resolveCoverImage } from "@/lib/generators/cover-resolver";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_BRAND_CONFIG } from "@/lib/generators/types";
import type { BrandConfig, ReprintResult } from "@/lib/generators/types";
import type { MusicPlan, SongEntry, Reading } from "@/lib/types";
import type {
  WorshipAidConfig,
  WorshipAidPage,
  WorshipAid,
  CoverPageData,
  ReadingPageData,
  SongPageData,
  LinkItem,
} from "./types";
import { renderPageContent } from "./render-page";

// ─── Occasion name formatter ────────────────────────────────────────────────────

const ORDINALS: Record<string, string> = {
  "01": "First", "02": "Second", "03": "Third", "04": "Fourth", "05": "Fifth",
  "06": "Sixth", "07": "Seventh", "08": "Eighth", "09": "Ninth", "10": "Tenth",
  "11": "Eleventh", "12": "Twelfth", "13": "Thirteenth", "14": "Fourteenth",
  "15": "Fifteenth", "16": "Sixteenth", "17": "Seventeenth", "18": "Eighteenth",
  "19": "Nineteenth", "20": "Twentieth", "21": "Twenty-First", "22": "Twenty-Second",
  "23": "Twenty-Third", "24": "Twenty-Fourth", "25": "Twenty-Fifth",
  "26": "Twenty-Sixth", "27": "Twenty-Seventh", "28": "Twenty-Eighth",
  "29": "Twenty-Ninth", "30": "Thirtieth", "31": "Thirty-First",
  "32": "Thirty-Second", "33": "Thirty-Third", "34": "Thirty-Fourth",
};

const SEASON_DISPLAY: Record<string, string> = {
  advent: "Advent",
  christmas: "Christmas",
  lent: "Lent",
  easter: "Easter",
  "ordinary-time": "Ordinary Time",
  ordinary: "Ordinary Time",
};

/**
 * Convert internal occasion names like "EASTER 02 DIVINE MERCY [A]"
 * to display names like "Second Sunday of Easter" with subtitle "Divine Mercy Sunday".
 */
function formatOccasionName(raw: string): { name: string; subtitle?: string } {
  // Strip cycle year bracket: [A], [B], [C], [ABC]
  let cleaned = raw.replace(/\s*\[.*?\]\s*$/, "").trim();

  // Match pattern: "SEASON NN EXTRA"
  const match = cleaned.match(/^(ADVENT|CHRISTMAS|LENT|EASTER|ORDINARY[- ]?TIME?)\s+(\d{2})\s*(.*)?$/i);
  if (match) {
    const seasonKey = match[1].toLowerCase().replace(/\s+/g, "-").replace("ordinary-time", "ordinary-time");
    const num = match[2];
    const extra = (match[3] || "").trim();

    const seasonDisplay = SEASON_DISPLAY[seasonKey] ?? SEASON_DISPLAY[seasonKey.replace("-time", "")] ?? match[1];
    const ordinal = ORDINALS[num] ?? num;

    const name = `${ordinal} Sunday of ${seasonDisplay}`;
    const subtitle = extra ? extra.split(/\s+/).map(w =>
      w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ").replace(/\b(Of|The|And|In|For|To|A)\b/g, m => m.toLowerCase()) + " Sunday" : undefined;

    return { name, subtitle };
  }

  // Fallback: title-case the raw name
  const titleCased = cleaned
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|The|And|In|For|To|A)\b/g, (m) => m.toLowerCase());

  return { name: titleCased };
}

// ─── Season colors ──────────────────────────────────────────────────────────────

const SEASON_COLORS: Record<string, string> = {
  advent: "#6B21A8",
  christmas: "#B45309",
  lent: "#7C3AED",
  easter: "#D97706",
  "ordinary-time": "#166534",
  ordinary: "#166534",
};

function seasonColor(season: string): string {
  return SEASON_COLORS[season?.toLowerCase() ?? ""] ?? "#B45309";
}

// ─── Position labels ───────────────────────────────────────────────────────────

const POSITION_LABELS: Record<string, string> = {
  gathering: "Gathering Song",
  penitentialAct: "Penitential Act",
  gloria: "Gloria",
  psalm: "Responsorial Psalm",
  gospelAcclamation: "Gospel Acclamation",
  offertory: "Preparation of the Gifts",
  communion_1: "Communion Song",
  communion_2: "Communion Song",
  communion_3: "Communion Song",
  sending: "Sending Forth",
};

// ─── Date formatter ────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Supabase storage URL builder ──────────────────────────────────────────────

function storageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/song-resources/${storagePath}`;
}

function reprintImageUrl(reprint: ReprintResult): string | null {
  if (reprint.kind === "pdf" || reprint.kind === "gif" || reprint.kind === "image") {
    const sp = reprint.storagePath;
    if (!sp) return null;

    let rawUrl: string;
    if (sp.startsWith("http://") || sp.startsWith("https://")) {
      rawUrl = sp;
    } else if (sp.startsWith("/Users/") || sp.startsWith("/home/")) {
      rawUrl = `/api/worship-aids/resource?path=${encodeURIComponent(sp)}`;
    } else {
      rawUrl = storageUrl(sp);
    }

    // PDFs and TIFFs can't render in <img> tags: route through render-reprint
    const lower = sp.toLowerCase();
    if (lower.endsWith(".pdf") || lower.endsWith(".tif") || lower.endsWith(".tiff")) {
      return `/api/worship-aids/render-reprint?url=${encodeURIComponent(rawUrl)}`;
    }

    return rawUrl;
  }
  return null;
}

// ─── Brand config loader ───────────────────────────────────────────────────────

async function fetchBrandConfig(parishId: string): Promise<BrandConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("parish_brand_config")
    .select("*")
    .eq("parish_id", parishId)
    .maybeSingle();

  if (!data) {
    // Fallback: St. Monica defaults until parish_brand_config is seeded
    return {
      parishId,
      ...DEFAULT_BRAND_CONFIG,
      parishDisplayName: "St. Monica Catholic Community",
      logoUrl: "/logo-stmonica.png",
    };
  }

  return {
    parishId,
    logoUrl: data.logo_url ?? null,
    logoStoragePath: data.logo_storage_path ?? null,
    parishDisplayName: data.parish_display_name ?? "",
    primaryColor: data.primary_color ?? DEFAULT_BRAND_CONFIG.primaryColor,
    secondaryColor: data.secondary_color ?? DEFAULT_BRAND_CONFIG.secondaryColor,
    accentColor: data.accent_color ?? DEFAULT_BRAND_CONFIG.accentColor,
    headingFont: data.heading_font ?? DEFAULT_BRAND_CONFIG.headingFont,
    bodyFont: data.body_font ?? DEFAULT_BRAND_CONFIG.bodyFont,
    layoutPreset: (data.layout_preset as BrandConfig["layoutPreset"]) ?? DEFAULT_BRAND_CONFIG.layoutPreset,
    coverStyle: (data.cover_style as BrandConfig["coverStyle"]) ?? DEFAULT_BRAND_CONFIG.coverStyle,
    headerOverlayMode: (data.header_overlay_mode as BrandConfig["headerOverlayMode"]) ?? DEFAULT_BRAND_CONFIG.headerOverlayMode,
  };
}

// ─── Cover page builder ────────────────────────────────────────────────────────

async function buildCoverPage(
  parishId: string,
  brand: BrandConfig,
  occasionName: string,
  displayDate: string,
  season: string,
  seasonLabel: string,
  occasionCode: string,
  cycle: string
): Promise<WorshipAidPage> {
  const coverImage = await resolveCoverImage(parishId, occasionCode, cycle, brand);

  let coverArtUrl: string | null = null;
  if (coverImage.kind === "image") {
    coverArtUrl = coverImage.url || (coverImage.storagePath ? storageUrl(coverImage.storagePath) : null);
  }

  const accentColor = seasonColor(season);

  const formatted = formatOccasionName(occasionName);

  const coverData: CoverPageData = {
    parishName: brand.parishDisplayName || "St. Monica Catholic Community",
    occasionName: formatted.name,
    occasionSubtitle: formatted.subtitle,
    date: displayDate,
    seasonLabel,
    seasonColor: accentColor,
    logoUrl: brand.logoUrl ?? null,
    coverArtUrl,
  };

  return {
    id: randomUUID(),
    type: "cover",
    title: occasionName,
    subtitle: displayDate,
    position: "cover",
    content: renderPageContent({ type: "cover", coverData, cropTop: 0, customLinks: [], givingBlock: false }),
    coverData,
    removed: false,
    cropTop: 0,
    customLinks: [],
    givingBlock: false,
  };
}

// ─── Reading page builder ──────────────────────────────────────────────────────

function buildReadingPage(readings: Reading[]): WorshipAidPage {
  const mapped = readings.map((r) => ({
    type: r.type,
    citation: r.citation,
    summary: r.summary,
  }));

  const readingData: ReadingPageData = { readings: mapped };

  return {
    id: randomUUID(),
    type: "reading",
    title: "Scripture Readings",
    position: "readings",
    content: renderPageContent({ type: "reading", readingData, cropTop: 0, customLinks: [], givingBlock: false }),
    readingData,
    removed: false,
    cropTop: 0,
    customLinks: [],
    givingBlock: false,
  };
}

// ─── Song page builder ─────────────────────────────────────────────────────────

async function buildSongPage(
  position: string,
  positionLabel: string,
  song: SongEntry & { songId?: string; supabaseId?: string; variants?: Array<{ legacyId: string; supabaseId?: string }> }
): Promise<WorshipAidPage> {
  let reprint: ReprintResult = { kind: "title_only" };
  let resolvedId = song.supabaseId || song.songId || "";

  const supabase = createAdminClient();
  const variants = song.variants ?? (song.songId ? [{ legacyId: song.songId, supabaseId: song.supabaseId }] : []);

  // Try each variant until one resolves a reprint with actual content
  for (const variant of variants) {
    // Try Supabase UUID first
    const tryId = variant.supabaseId || "";
    if (tryId) {
      reprint = await resolveWorshipAidReprint(tryId);
      if (reprint.kind !== "title_only") { resolvedId = tryId; break; }
    }

    // Fall back to legacy_id → UUID lookup
    const { data } = await supabase
      .from("songs")
      .select("id")
      .eq("legacy_id", variant.legacyId)
      .maybeSingle();
    if (data?.id) {
      reprint = await resolveWorshipAidReprint(data.id);
      if (reprint.kind !== "title_only") { resolvedId = data.id; break; }
      if (!resolvedId) resolvedId = data.id;
    }
  }

  const imgUrl = reprintImageUrl(reprint);
  const lyrics = reprint.kind === "lyrics" ? reprint.text : null;

  // No default crop: whitespace is auto-trimmed by render-reprint endpoint
  const defaultCrop = 0;

  const songData: SongPageData = {
    songId: resolvedId,
    title: song.title,
    composer: song.composer ?? null,
    positionLabel,
    reprint,
    reprintUrl: imgUrl,
    lyrics,
  };

  return {
    id: randomUUID(),
    type: "song",
    title: song.title,
    subtitle: song.composer,
    position,
    content: renderPageContent({
      type: "song",
      songData,
      cropTop: defaultCrop,
      customLinks: [],
      givingBlock: false,
    }),
    songData,
    removed: false,
    cropTop: defaultCrop,
    customLinks: [],
    givingBlock: false,
  };
}

// ─── Title → song ID lookup ───────────────────────────────────────────────────

import { getSongLibrary } from "@/lib/song-library";

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Look up song IDs (legacy slug + supabaseId) by title matching.
 * Uses the in-memory song library (3,045 songs from song-library.json).
 * Returns ALL variants per normalized title so the caller can try each
 * until one resolves a reprint (handles duplicate titles from different arrangements).
 */
function lookupSongIds(titles: string[]): Map<string, Array<{ legacyId: string; supabaseId?: string }>> {
  if (titles.length === 0) return new Map();
  const library = getSongLibrary();

  // Build a lookup map: normalized title → all matching songs
  const libMap = new Map<string, Array<{ legacyId: string; supabaseId?: string }>>();
  for (const song of library) {
    const norm = normalizeForMatch(song.title);
    const existing = libMap.get(norm) ?? [];
    existing.push({ legacyId: song.id, supabaseId: song.supabaseId });
    libMap.set(norm, existing);
  }

  const result = new Map<string, Array<{ legacyId: string; supabaseId?: string }>>();
  for (const title of titles) {
    const norm = normalizeForMatch(title);
    const matches = libMap.get(norm);
    if (matches) result.set(title, matches);
  }

  return result;
}

// ─── Song entries from plan ────────────────────────────────────────────────────

type SongWithId = SongEntry & { songId?: string };

function planSongs(plan: MusicPlan): Array<{ position: string; song: SongWithId }> {
  const entries: Array<{ position: string; song: SongWithId }> = [];

  if (plan.gathering) entries.push({ position: "gathering", song: plan.gathering });
  if (plan.gloria) entries.push({ position: "gloria", song: plan.gloria });

  // Psalm: use setting string as title if no songId
  if (plan.responsorialPsalm?.setting) {
    const psalmTitle = plan.responsorialPsalm.setting.split("•")[0].trim();
    entries.push({ position: "psalm", song: { title: psalmTitle } });
  }

  if (plan.gospelAcclamation) entries.push({ position: "gospelAcclamation", song: plan.gospelAcclamation });
  if (plan.offertory) entries.push({ position: "offertory", song: plan.offertory });

  const communion = plan.communionSongs ?? [];
  for (let i = 0; i < communion.length; i++) {
    entries.push({ position: `communion_${i + 1}`, song: communion[i] });
  }

  if (plan.sending) entries.push({ position: "sending", song: plan.sending });

  return entries;
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export async function buildPages(config: WorshipAidConfig): Promise<WorshipAid> {
  const occasion = getOccasion(config.occasionId);
  if (!occasion) throw new Error(`Occasion not found: ${config.occasionId}`);

  const brand = await fetchBrandConfig(config.parishId);

  // Resolve display date (next upcoming date)
  const today = new Date().toISOString().slice(0, 10);
  const upcomingDate = occasion.dates
    .map((d) => d.date)
    .filter((d) => typeof d === "string" && d >= today)
    .sort()[0];
  const displayDate = upcomingDate ? formatDate(upcomingDate) : "";

  const occasionCode = occasion.id;
  const cycle = occasion.year ?? "A";

  const pages: WorshipAidPage[] = [];

  // 1. Cover
  pages.push(
    await buildCoverPage(
      config.parishId,
      brand,
      occasion.name,
      displayDate,
      occasion.season,
      occasion.seasonLabel,
      occasionCode,
      cycle
    )
  );

  // 2. Readings page
  if (config.includeReadings && occasion.readings.length > 0) {
    pages.push(buildReadingPage(occasion.readings));
  }

  // 3. Song pages from the matching ensemble plan
  const plan = occasion.musicPlans.find(
    (p) => p.ensembleId === config.ensembleId || (p as MusicPlan & { communityId?: string }).communityId === config.ensembleId
  );

  if (plan) {
    const songs = planSongs(plan);

    // Resolve song IDs (legacy slug + Supabase UUID) for all songs by title.
    // Returns all variants per title so buildSongPage can try each.
    const titles = songs.map(({ song }) => song.title);
    const songIdMap = lookupSongIds(titles);

    // Attach first variant's IDs + full variants array to each entry
    for (const entry of songs) {
      const variants = songIdMap.get(entry.song.title);
      if (variants && variants.length > 0) {
        (entry.song as SongWithId).songId = variants[0].legacyId;
        (entry.song as SongWithId & { supabaseId?: string }).supabaseId = variants[0].supabaseId;
        (entry.song as SongWithId & { variants?: Array<{ legacyId: string; supabaseId?: string }> }).variants = variants;
      }
    }

    const songPages = await Promise.all(
      songs.map(({ position, song }) =>
        buildSongPage(position, POSITION_LABELS[position] ?? position, song)
      )
    );
    pages.push(...songPages);
  }

  return {
    id: randomUUID(),
    config,
    pages,
    brand,
    createdAt: new Date().toISOString(),
  };
}
