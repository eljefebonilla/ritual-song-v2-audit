import type { LibrarySong, SongResource, SongCategory, ResourceDisplayCategory, MusicPlan, ResolvedSong, OccasionResource } from "./types";
import { normalizeTitle } from "./occasion-helpers";

let songLibraryData: LibrarySong[] | null = null;

export function getSongLibrary(): LibrarySong[] {
  if (songLibraryData) return songLibraryData;
  try {
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
 * Build a Map<normalizedTitle, LibrarySong> for fast title matching.
 */
let _titleIndex: Map<string, LibrarySong> | null = null;

export function getTitleIndex(): Map<string, LibrarySong> {
  if (_titleIndex) return _titleIndex;
  _titleIndex = new Map();
  for (const song of getSongLibrary()) {
    _titleIndex.set(normalizeTitle(song.title), song);
  }
  return _titleIndex;
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

  function tryAdd(title: string) {
    const key = normalizeTitle(title);
    if (result[key]) return;
    const song = index.get(key);
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
        tryAdd((val as { title: string }).title);
      }
    }
    if (plan.gospelAcclamation?.title) tryAdd(plan.gospelAcclamation.title);
    if (plan.responsorialPsalm?.psalm) tryAdd(plan.responsorialPsalm.psalm);
    if (plan.communionSongs) {
      for (const s of plan.communionSongs) tryAdd(s.title);
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

  function tryResolve(title: string, category?: "gospel_acclamation") {
    const key = normalizeTitle(title);
    if (result[key]) return; // already resolved
    const song = index.get(key);
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
        tryResolve((val as { title: string }).title);
      }
    }

    // Gospel acclamation — pass category so occasion audio can be injected
    if (plan.gospelAcclamation?.title) {
      tryResolve(plan.gospelAcclamation.title, "gospel_acclamation");
    }

    // Responsorial psalm
    if (plan.responsorialPsalm?.psalm) {
      tryResolve(plan.responsorialPsalm.psalm);
    }

    // Communion songs
    if (plan.communionSongs) {
      for (const s of plan.communionSongs) {
        tryResolve(s.title);
      }
    }
  }

  return result;
}
