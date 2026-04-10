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
  if (reprint.kind === "pdf" || reprint.kind === "gif") {
    return storageUrl(reprint.storagePath);
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

  const coverData: CoverPageData = {
    parishName: brand.parishDisplayName || "St. Monica Catholic Community",
    occasionName,
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
  song: SongEntry & { songId?: string; supabaseId?: string }
): Promise<WorshipAidPage> {
  let reprint: ReprintResult = { kind: "title_only" };

  // Try Supabase UUID first (song_resources_v2.song_id is a UUID)
  const resolveId = song.supabaseId || song.songId || "";
  if (resolveId) {
    reprint = await resolveWorshipAidReprint(resolveId);
  }

  // If UUID lookup failed but we have a legacy ID, try looking up the UUID via songs table
  if (reprint.kind === "title_only" && song.songId && !song.supabaseId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("songs")
      .select("id")
      .eq("legacy_id", song.songId)
      .maybeSingle();
    if (data?.id) {
      reprint = await resolveWorshipAidReprint(data.id);
    }
  }

  const imgUrl = reprintImageUrl(reprint);
  const lyrics = reprint.kind === "lyrics" ? reprint.text : null;

  // Default OCP header crop: 12% for GIF resources
  const defaultCrop = reprint.kind === "gif" ? 12 : 0;

  const songData: SongPageData = {
    songId: resolveId,
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
 * Returns a map of title → { legacyId, supabaseId }.
 */
function lookupSongIds(titles: string[]): Map<string, { legacyId: string; supabaseId?: string }> {
  if (titles.length === 0) return new Map();
  const library = getSongLibrary();

  // Build a lookup map: normalized title → song
  const libMap = new Map<string, { legacyId: string; supabaseId?: string }>();
  for (const song of library) {
    const norm = normalizeForMatch(song.title);
    libMap.set(norm, { legacyId: song.id, supabaseId: song.supabaseId });
  }

  const result = new Map<string, { legacyId: string; supabaseId?: string }>();
  for (const title of titles) {
    const norm = normalizeForMatch(title);
    const match = libMap.get(norm);
    if (match) result.set(title, match);
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

    // Resolve song IDs (legacy slug + Supabase UUID) for all songs by title
    const titles = songs.map(({ song }) => song.title);
    const songIdMap = lookupSongIds(titles);

    // Attach songId (legacy) and supabaseId to each entry
    for (const entry of songs) {
      const match = songIdMap.get(entry.song.title);
      if (match) {
        (entry.song as SongWithId).songId = match.legacyId;
        (entry.song as SongWithId & { supabaseId?: string }).supabaseId = match.supabaseId;
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
