import type { LibrarySong, SongResource, SongCategory, ResourceDisplayCategory, MusicPlan, ResolvedSong, OccasionResource } from "./types";
import { normalizeTitle } from "./occasion-helpers";

let songLibraryData: LibrarySong[] | null = null;

/**
 * Get the song library. Reads from the cached in-memory data.
 * For server components, call loadSongLibrary() first to populate from Supabase.
 * Falls back to JSON file if Supabase data isn't loaded.
 */
export function getSongLibrary(): LibrarySong[] {
  if (songLibraryData) return songLibraryData;
  try {
    // Fallback to JSON when Supabase data hasn't been loaded
    songLibraryData = require("../data/song-library.json") as LibrarySong[];
    // Auto-classify songs that don't have a category yet
    for (const song of songLibraryData) {
      if (!song.category) {
        song.category = classifySong(song.title);
      }
    }
    return songLibraryData;
  } catch {
    return [];
  }
}

/**
 * Load the song library from Supabase (server-side only).
 * Must be called from a Server Component or API route before getSongLibrary().
 */
export async function loadSongLibrary(): Promise<LibrarySong[]> {
  try {
    const { getSongsFromSupabase } = await import("./supabase/songs");
    songLibraryData = await getSongsFromSupabase();
    return songLibraryData;
  } catch (err) {
    console.error("Failed to load songs from Supabase, falling back to JSON:", err);
    return getSongLibrary();
  }
}

export function getSongById(id: string): LibrarySong | null {
  const library = getSongLibrary();
  return library.find((s) => s.id === id) || null;
}

export function getSongsByCategory(category: SongCategory): LibrarySong[] {
  return getSongLibrary().filter((s) => s.category === category);
}

/**
 * Pattern-match a song title to auto-classify it.
 */
export function classifySong(title: string): SongCategory {
  const t = title.toLowerCase();

  // Mass parts
  if (
    /\bkyrie\b/.test(t) ||
    /\bgloria\b/.test(t) ||
    /\bsanctus\b/.test(t) ||
    /\bholy,?\s*holy/.test(t) ||
    /\bmemorial accl/.test(t) ||
    /\bgreat amen\b/.test(t) ||
    /\blamb of god\b/.test(t) ||
    /\bagnus dei\b/.test(t) ||
    /\blord have mercy\b/.test(t) ||
    /\bpenitential\b/.test(t) ||
    /\bfraction rite\b/.test(t) ||
    /\bmass setting\b/.test(t) ||
    /\bmisa\b/.test(t) ||
    /\blord's prayer\b/.test(t)
  ) {
    return "mass_part";
  }

  // Psalms
  if (
    /^ps\.?\s*\d/.test(t) ||
    /^psalm\s*\d/.test(t) ||
    /\bresponsorial\b/.test(t)
  ) {
    return "psalm";
  }

  // Gospel acclamations
  if (
    /\balleluia\b/.test(t) ||
    /\bgospel accl/.test(t) ||
    /\bverse before/.test(t) ||
    /\blenten gospel/.test(t)
  ) {
    return "gospel_acclamation";
  }

  return "song";
}

/**
 * Filter out local-only resources when running on Vercel (read-only filesystem).
 */
export function getVisibleResources(resources: SongResource[]): SongResource[] {
  if (process.env.VERCEL) {
    return resources.filter((r) => r.source !== "local");
  }
  return resources;
}

/**
 * Classify a resource into a display category for badge/filter purposes.
 */
export function getResourceDisplayCategory(resource: SongResource): ResourceDisplayCategory | null {
  // AIM (highlighted lead sheets)
  if (resource.isHighlighted) return "aim";

  // Audio
  if (resource.type === "audio" || resource.type === "practice_track") return "audio";

  // Choral (SAT arrangements)
  const label = resource.label.toLowerCase();
  if (label.includes("sat") || label.includes("choral") || label.includes("arrangement")) {
    return "choral";
  }

  // Lead sheets (sheet_music PDFs)
  if (resource.type === "sheet_music") {
    // Color PDFs (check filename for clr/color pattern)
    if (resource.filePath) {
      const fp = resource.filePath.toLowerCase();
      if (fp.includes("clr") || fp.includes("color")) return "color";
    }
    return "lead_sheet";
  }

  return null;
}

/**
 * Get the set of display categories present on a song's resources.
 */
export function getSongDisplayCategories(song: LibrarySong): Set<ResourceDisplayCategory> {
  const cats = new Set<ResourceDisplayCategory>();
  for (const r of song.resources) {
    const cat = getResourceDisplayCategory(r);
    if (cat) cats.add(cat);
  }
  return cats;
}

/**
 * Build a Map<normalizedTitle, LibrarySong[]> for fast title matching.
 * Groups all songs that share the same normalized title.
 */
let _titleIndex: Map<string, LibrarySong[]> | null = null;

export function getTitleIndex(): Map<string, LibrarySong[]> {
  if (_titleIndex) return _titleIndex;
  _titleIndex = new Map();
  for (const song of getSongLibrary()) {
    const key = normalizeTitle(song.title);
    const existing = _titleIndex.get(key);
    if (existing) {
      existing.push(song);
    } else {
      _titleIndex.set(key, [song]);
    }
  }
  return _titleIndex;
}

/**
 * Normalize a composer name for comparison.
 * Strips religious titles, "Arr. by", punctuation, collapses whitespace.
 */
export function normalizeComposer(composer: string): string {
  return composer
    .toLowerCase()
    .replace(/\b(sj|rsm|csp|op|osb|csc|osf|cj|ofm|ssj|ssnd|bvm|ihm|rscj|ocd)\b/gi, "")
    .replace(/\barr\.?\s*by\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token-based overlap score (0-1) between two composer strings.
 * Splits on whitespace, counts shared tokens (length > 2),
 * divides by the smaller token count.
 */
export function composerSimilarity(a: string, b: string): number {
  const tokensA = normalizeComposer(a).split(" ").filter((t) => t.length > 2);
  const tokensB = normalizeComposer(b).split(" ").filter((t) => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const shared = tokensA.filter((t) => setB.has(t)).length;
  return shared / Math.min(tokensA.length, tokensB.length);
}

/**
 * Pick the best match from a list of candidate songs sharing the same normalized title.
 * Uses composer hint for disambiguation when available.
 */
export function pickBestMatch(candidates: LibrarySong[], composerHint?: string): LibrarySong | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  if (composerHint) {
    // Exact normalized composer match
    const normHint = normalizeComposer(composerHint);
    const exact = candidates.find(
      (c) => c.composer && normalizeComposer(c.composer) === normHint
    );
    if (exact) return exact;

    // Fuzzy composer match — pick highest score above threshold
    let bestScore = 0;
    let bestMatch: LibrarySong | null = null;
    for (const c of candidates) {
      if (!c.composer) continue;
      const score = composerSimilarity(composerHint, c.composer);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    }
    if (bestMatch && bestScore > 0.3) return bestMatch;
  }

  // Prefer candidate with most resources
  const withResources = [...candidates].sort(
    (a, b) => b.resources.length - a.resources.length
  );
  if (withResources[0].resources.length > 0) return withResources[0];

  // Fall back to highest usageCount
  return [...candidates].sort((a, b) => b.usageCount - a.usageCount)[0];
}

/**
 * Get a playable URL from a SongResource.
 */
export function resourceUrl(resource: SongResource): string | null {
  if (resource.url) return resource.url;
  if (resource.filePath) {
    return `/api/music/${encodeURIComponent(resource.filePath)}`;
  }
  return null;
}

/**
 * Find the best playable resource (audio or youtube) for a library song.
 */
function findPlayableResource(song: LibrarySong): { url: string; type: "audio" | "youtube" } | null {
  // Prefer local audio first
  for (const r of song.resources) {
    if (r.type === "audio" && r.filePath) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio" };
    }
  }
  // Then YouTube
  for (const r of song.resources) {
    if (r.type === "youtube" && r.url) {
      return { url: r.url, type: "youtube" };
    }
  }
  // Then any audio with a URL
  for (const r of song.resources) {
    if (r.type === "audio" && r.url) {
      return { url: r.url, type: "audio" };
    }
  }
  return null;
}

/**
 * Build a Record<normalizedTitle, LibrarySong> for all songs referenced in music plans.
 * Used by the occasion page detail panel.
 */
export function resolveFullSongs(plans: MusicPlan[]): Record<string, LibrarySong> {
  const index = getTitleIndex();
  const result: Record<string, LibrarySong> = {};

  function tryAdd(title: string, composer?: string) {
    const key = normalizeTitle(title);
    if (result[key]) return;
    const candidates = index.get(key);
    if (!candidates) return;
    const song = pickBestMatch(candidates, composer);
    if (song) result[key] = song;
  }

  for (const plan of plans) {
    const songFields: (keyof MusicPlan)[] = [
      "prelude", "gathering", "penitentialAct", "gloria",
      "offertory", "lordsPrayer", "fractionRite", "sending",
    ];
    for (const field of songFields) {
      const val = plan[field];
      if (val && typeof val === "object" && "title" in val) {
        const entry = val as { title: string; composer?: string };
        tryAdd(entry.title, entry.composer);
      }
    }
    if (plan.gospelAcclamation?.title) {
      tryAdd(plan.gospelAcclamation.title, plan.gospelAcclamation.composer);
    }
    if (plan.responsorialPsalm?.psalm) tryAdd(plan.responsorialPsalm.psalm);
    if (plan.communionSongs) {
      for (const s of plan.communionSongs) tryAdd(s.title, s.composer);
    }
  }

  return result;
}

/**
 * Resolve all song titles in an array of MusicPlans against the song library.
 * Optionally injects audio from occasionResources for GA rows that lack it.
 * Returns Record<normalizedTitle, ResolvedSong>.
 */
export function resolveAllSongs(
  plans: MusicPlan[],
  occasionResources?: OccasionResource[],
): Record<string, ResolvedSong> {
  const index = getTitleIndex();
  const result: Record<string, ResolvedSong> = {};

  // Find GA audio from occasion resources (if available)
  const gaAudioUrl = occasionResources
    ?.find((r) => r.category === "gospel_acclamation" && r.type === "audio")
    ?.filePath;

  function tryResolve(title: string, composerHint?: string, category?: "gospel_acclamation") {
    const key = normalizeTitle(title);
    if (result[key]) return; // already resolved
    const candidates = index.get(key);
    if (!candidates) return;
    const song = pickBestMatch(candidates, composerHint);
    if (!song) return;

    const playable = findPlayableResource(song);

    // If no audio from song library and this is a GA, use occasion resource audio
    let audioUrl = playable?.url ?? null;
    let audioType = playable?.type ?? null;
    if (!audioUrl && category === "gospel_acclamation" && gaAudioUrl) {
      audioUrl = `/api/music/${encodeURIComponent(gaAudioUrl)}`;
      audioType = "audio";
    }

    result[key] = {
      id: song.id,
      title: song.title,
      audioUrl,
      audioType,
    };
  }

  for (const plan of plans) {
    // Single song fields
    const songFields: (keyof MusicPlan)[] = [
      "prelude", "gathering", "penitentialAct", "gloria",
      "offertory", "lordsPrayer", "fractionRite", "sending",
    ];
    for (const field of songFields) {
      const val = plan[field];
      if (val && typeof val === "object" && "title" in val) {
        const entry = val as { title: string; composer?: string };
        tryResolve(entry.title, entry.composer);
      }
    }

    // Gospel acclamation — pass category so occasion audio can be injected
    if (plan.gospelAcclamation?.title) {
      tryResolve(plan.gospelAcclamation.title, plan.gospelAcclamation.composer, "gospel_acclamation");
    }

    // Responsorial psalm
    if (plan.responsorialPsalm?.psalm) {
      tryResolve(plan.responsorialPsalm.psalm);
    }

    // Communion songs
    if (plan.communionSongs) {
      for (const s of plan.communionSongs) {
        tryResolve(s.title, s.composer);
      }
    }
  }

  return result;
}
