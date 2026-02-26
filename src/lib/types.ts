// Core liturgical data types for St. Monica Mass Preparation

export type LiturgicalYear = "A" | "B" | "C" | "ABC";

export type LiturgicalSeason =
  | "advent"
  | "christmas"
  | "lent"
  | "easter"
  | "ordinary"
  | "solemnity"
  | "feast";

export interface OccasionDate {
  date: string; // ISO date string
  label: string; // "Year A — Nov 30, 2025 (Sun)"
  dayOfWeek: string;
}

export interface Reading {
  type: "first" | "psalm" | "second" | "gospel_verse" | "gospel";
  citation: string;
  summary: string;
  antiphon?: string; // For psalms
}

export interface Antiphon {
  type: "entrance" | "communion";
  option: number; // 1 or 2
  citation: string;
  text: string;
}

export interface SongEntry {
  title: string;
  composer?: string;
  description?: string;
}

export interface MusicPlan {
  community: string; // "Reflections", "Foundations", etc.
  communityId: string;
  date?: string;
  presider?: string;
  massNotes?: string[];
  prelude?: SongEntry;
  gathering?: SongEntry;
  penitentialAct?: SongEntry;
  gloria?: SongEntry;
  responsorialPsalm?: {
    psalm: string;
    setting?: string;
  };
  gospelAcclamation?: SongEntry & { verse?: string };
  offertory?: SongEntry;
  eucharisticAcclamations?: {
    massSettingName: string;
    composer?: string;
  };
  lordsPrayer?: SongEntry;
  fractionRite?: SongEntry;
  communionSongs?: SongEntry[];
  sending?: SongEntry;
}

export interface LiturgicalOccasion {
  id: string; // slug: "advent-01-a"
  name: string; // "ADVENT 01 [A]"
  year: LiturgicalYear;
  season: LiturgicalSeason;
  seasonLabel: string; // "Advent", "Lent", etc.
  seasonOrder: number;

  // Dates
  dates: OccasionDate[];

  // Lectionary info
  lectionary: {
    number: string; // "022•A"
    gospelTitle: string;
    thematicTag: string;
    thematicDetail?: string;
  };

  // Readings
  readings: Reading[];

  // Antiphons
  antiphons: Antiphon[];

  // Planning notes
  planningNotes: string[];

  // Music plans (one per community)
  musicPlans: MusicPlan[];
}

export interface SeasonGroup {
  id: LiturgicalSeason;
  label: string;
  color: string;
  occasions: Pick<LiturgicalOccasion, "id" | "name" | "year" | "seasonOrder">[];
}

export interface CalendarIndex {
  thisWeek: string | null;
  nextWeek: string | null;
  occasions: {
    id: string;
    name: string;
    season: LiturgicalSeason;
    year: LiturgicalYear;
    nextDate: string | null;
  }[];
}

// ===== SONG LIBRARY TYPES =====

export type SongResourceType =
  | "audio"
  | "sheet_music"
  | "practice_track"
  | "hymnal_ref"
  | "notation"
  | "lyrics"
  | "ocp_link"
  | "youtube"
  | "other";

export type SongResourceSource =
  | "local"
  | "ocp_bb"
  | "ocp_ss"
  | "youtube"
  | "manual";

export interface SongResource {
  id: string;
  type: SongResourceType;
  label: string; // "Lead Sheet (AIM)", "Breaking Bread #639", "YouTube"
  url?: string; // External link (OCP page, YouTube)
  filePath?: string; // Local file path (for Music folder resources)
  value?: string; // For non-URL resources like hymnal numbers
  source?: SongResourceSource;
  isHighlighted?: boolean; // true for "AIM" files (priority lead sheets)
}

export interface LibrarySong {
  id: string; // slug from title+composer
  title: string;
  composer?: string;
  resources: SongResource[];
  usageCount: number; // how many times this song appears in music plans
  occasions: string[]; // occasion IDs where this song is used
}
