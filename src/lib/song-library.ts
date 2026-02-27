import type { LibrarySong, SongResource, SongCategory, ResourceDisplayCategory } from "./types";

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
