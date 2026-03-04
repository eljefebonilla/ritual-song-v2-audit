// Core liturgical data types for St. Monica Mass Preparation

export type LiturgicalYear = "A" | "B" | "C" | "ABC";

export type LiturgicalSeason =
  | "advent"
  | "christmas"
  | "lent"
  | "holyweek"
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
  type: "first" | "psalm" | "second" | "gospel_verse" | "gospel" | "custom";
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
  ensemble: string; // "Reflections", "Foundations", etc.
  ensembleId: string;
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

  // Occasion-specific resources (gospel acclamations, antiphon recordings, etc.)
  occasionResources?: OccasionResource[];

  // Music plans (one per ensemble)
  musicPlans: MusicPlan[];
}

export interface OccasionResource {
  id: string;
  type: "sheet_music" | "audio";
  label: string;
  filePath: string;
  source: "local";
  category: "antiphon" | "gospel_acclamation";
}

export interface LectionarySynopsis {
  occasion_id: string;
  logline: string;
  trajectory: string | null;
  readings: {
    first: { citation: string | null; synopsis: string };
    second: { citation: string | null; synopsis: string };
    gospel: { citation: string | null; synopsis: string };
  };
  invitesUsTo: string;
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
  | "supabase"
  | "ocp_bb"
  | "ocp_ss"
  | "youtube"
  | "manual";

export interface SongResource {
  id: string;
  type: SongResourceType;
  label: string; // "Lead Sheet (AIM)", "Breaking Bread #639", "YouTube"
  url?: string; // External link (OCP page, YouTube, Supabase public URL)
  filePath?: string; // Local file path (for Music folder resources)
  storagePath?: string; // Supabase Storage path (for deletion)
  value?: string; // For non-URL resources like hymnal numbers
  source?: SongResourceSource;
  isHighlighted?: boolean; // true for "AIM" files (priority lead sheets)
  tags?: string[]; // e.g. ["GTR", "AIM"] — structured classification
  visibility?: "all" | "admin"; // who can see this resource
}

export type SongCategory =
  | "song" | "antiphon" | "kyrie" | "gloria" | "sprinkling_rite"
  | "psalm" | "gospel_acclamation_refrain" | "gospel_acclamation_verse"
  | "holy_holy" | "memorial_acclamation" | "great_amen"
  | "lamb_of_god" | "lords_prayer" | "sequence"
  // Legacy categories (kept for backward compat with existing code)
  | "mass_part" | "gospel_acclamation";

/** New expanded categories (14 values, no legacy) */
export type ExpandedSongCategory =
  | "song" | "antiphon" | "kyrie" | "gloria" | "sprinkling_rite"
  | "psalm" | "gospel_acclamation_refrain" | "gospel_acclamation_verse"
  | "holy_holy" | "memorial_acclamation" | "great_amen"
  | "lamb_of_god" | "lords_prayer" | "sequence";

/** Mass parts = all expanded categories that are parts of the Mass Ordinary/Proper */
export const MASS_PART_CATEGORIES: ExpandedSongCategory[] = [
  "kyrie", "gloria", "sprinkling_rite", "holy_holy",
  "memorial_acclamation", "great_amen", "lamb_of_god",
  "lords_prayer", "sequence",
];

/** Gospel acclamation categories */
export const GOSPEL_ACCLAMATION_CATEGORIES: ExpandedSongCategory[] = [
  "gospel_acclamation_refrain", "gospel_acclamation_verse",
];

/** Map expanded category to display label */
export const SONG_CATEGORY_LABELS: Record<ExpandedSongCategory, string> = {
  song: "Song",
  antiphon: "Antiphon",
  kyrie: "Kyrie",
  gloria: "Gloria",
  sprinkling_rite: "Sprinkling Rite",
  psalm: "Psalm",
  gospel_acclamation_refrain: "Gospel Accl. Refrain",
  gospel_acclamation_verse: "Gospel Accl. Verse",
  holy_holy: "Holy, Holy",
  memorial_acclamation: "Memorial Accl.",
  great_amen: "Great Amen",
  lamb_of_god: "Lamb of God",
  lords_prayer: "Lord's Prayer",
  sequence: "Sequence",
};

export type ResourceDisplayCategory = "lead_sheet" | "choral" | "aim" | "color" | "audio";

export const RESOURCE_DISPLAY_LABELS: Record<ResourceDisplayCategory, string> = {
  lead_sheet: "Lead Sheet",
  choral: "Choral",
  aim: "AIM",
  color: "Color",
  audio: "Audio",
};

export interface CreditPerson {
  name: string;
  dates?: string; // e.g. "1707-1788", "b. 1950", "c.760-821"
}

export interface SongCredits {
  textAuthors?: CreditPerson[];
  composers?: CreditPerson[];
  arrangers?: CreditPerson[];
  textSources?: string[];
  tuneSources?: string[];
}

export interface TuneMeter {
  tuneName?: string;
  meter?: string; // e.g. "8.7.8.7.D", "6.6.8.6"
  incipit?: string; // melodic incipit (numeric string)
}

export interface LibrarySong {
  id: string; // slug from title+composer (legacy_id in Supabase)
  supabaseId?: string; // UUID from Supabase songs table
  title: string;
  composer?: string;
  category?: SongCategory;
  functions?: string[]; // liturgical functions: gathering, offertory, communion, etc.
  recordedKey?: string; // Key of the primary audio recording (e.g., "C", "Bb")
  psalmNumber?: number; // Psalm 1-150 (only for category=psalm)
  massSettingId?: string; // FK to mass_settings table
  massSettingName?: string; // Denormalized name for display

  // Cross-publisher enrichment fields
  catalogs?: { bb2026?: number; gather4?: number; spiritSong?: number; voices?: number; novum?: number; aahh?: number };
  credits?: SongCredits;
  tuneMeter?: TuneMeter;
  firstLine?: string;
  refrainFirstLine?: string;
  languages?: string[];
  topics?: string[];
  scriptureRefs?: string[];
  liturgicalUse?: string[];

  resources: SongResource[];
  usageCount: number; // how many times this song appears in music plans
  occasions: string[]; // occasion IDs where this song is used
  isHiddenGlobal?: boolean; // admin-hidden from all users
}

export interface MassSetting {
  id: string;
  name: string;
  composer?: string;
  notes?: string;
  pieces: LibrarySong[];
}

export interface SongRanking {
  songId: string;
  userId: string;
  ranking: number;
  notes?: string;
}

export interface CalendarDay {
  id: string;
  date: string;
  liturgicalDayName?: string;
  celebrationRank?: string;
  liturgicalColor?: string;
  season?: string;
  ordoNotes?: string;
  isHolyDay: boolean;
  isHoliday: boolean;
  holidayName?: string;
  occasionId?: string;
  isRecurring: boolean;
  recurrenceType?: string;
  customNotes?: string;
}

export interface ResolvedSong {
  id: string;
  audioUrl: string | null;
  audioType: "audio" | "youtube" | null;
  title: string;
}

// ===== WORSHIP SLOT TYPES =====

export type SlotKind = "song" | "reading" | "antiphon" | "mass_setting" | "resource" | "note" | "ritual_moment";

export interface WorshipSlot {
  id: string;
  section: "pre_mass" | "introductory" | "word" | "eucharist" | "concluding";
  role: string;
  label: string;
  kind: SlotKind;
  order: number;

  // Song slots
  song?: SongEntry;
  resolvedSong?: ResolvedSong;

  // Psalm slots
  psalm?: { psalm: string; setting?: string };

  // Mass setting slots
  massSetting?: { name: string; composer?: string };

  // Reading slots
  reading?: Reading;

  // Antiphon slots
  antiphon?: Antiphon;
  optionNumber?: number; // Only set when there are multiple antiphons of same type

  // Occasion resources (GA audio, antiphon PDFs)
  resources?: OccasionResource[];

  // Annotations
  annotations?: string[];

  // Custom slot fields (from custom_worship_slots table)
  customContent?: Record<string, unknown>;  // raw content from custom_worship_slots
  customSlotId?: string;                     // UUID from DB, for edit/delete operations
  isCustom?: boolean;                        // true for custom slots
}

export interface CustomSlotRow {
  id: string;
  occasion_id: string;
  ensemble_id: string;
  slot_type: 'song' | 'reading' | 'ritual_moment' | 'note' | 'mass_part';
  label: string;
  order_position: number;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ===== LITURGICAL CALENDAR TYPES =====

export type LiturgicalColor = "violet" | "white" | "red" | "green" | "rose" | "black";

export type CelebrationRank =
  | "solemnity"
  | "feast"
  | "memorial"
  | "optional_memorial"
  | "sunday"
  | "weekday";

export interface LiturgicalDay {
  id: string;
  date: string;
  celebrationName: string;
  rank: CelebrationRank;
  season: LiturgicalSeason;
  colorPrimary: LiturgicalColor;
  colorSecondary: LiturgicalColor | null;
  gloria: boolean;
  alleluia: boolean;
  lectionaryNumber: number | null;
  psalterWeek: string | null;
  occasionId: string | null;
  saintName: string | null;
  saintTitle: string | null;
  isHolyday: boolean;
  isTransferred: boolean;
  ecclesiasticalProvince: string | null;
  optionalMemorials: string[];
  isBVM: boolean;
  readings?: LiturgicalDayReading[];
}

export interface LiturgicalDayReading {
  readingOrder: number;
  readingType: "first" | "psalm" | "second" | "gospel_verse" | "gospel";
  bookAbbrev: string;
  chapterVerse: string;
  fullCitation: string;
}
