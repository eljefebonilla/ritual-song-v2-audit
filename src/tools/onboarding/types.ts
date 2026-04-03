/**
 * Parish Onboarding — Types
 * Ref: DESIGN-SPEC-v2.md 11.1, 11.2, Tier 11
 */

export type MusicStyle = "traditional" | "contemporary" | "mixed";
export type OnboardStatus = "pending" | "in_progress" | "complete";

export interface ParishSetupData {
  name: string;
  location: string;
  diocese: string;
  publishers: string[];
  hymnals: string[];
  musicStyle: MusicStyle;
  usesScreens: boolean;
  usesWorshipAids: boolean;
  weekendMassCount: number;
  weekdayMassCount: number;
  repetitionPreference: number;
  ensembles: EnsembleSetup[];
  favoriteSongs: FavoriteSongSeed[];
  generatePlan: boolean;
}

export interface EnsembleSetup {
  name: string;
  color: string;
  description?: string;
  massTimes?: string[];
}

export interface FavoriteSongSeed {
  songId?: string;
  songTitle: string;
  liturgicalFunction: string; // "gathering", "communion", "sending"
}

export interface CreateParishArgs {
  setup: ParishSetupData;
  userId: string;
}

export interface SeedFavoritesArgs {
  parishId: string;
  favorites: FavoriteSongSeed[];
}

export interface GeneratePlanArgs {
  parishId: string;
  cycles?: number; // default 3 (years)
}

export const PUBLISHERS = [
  { id: "ocp", name: "OCP (Oregon Catholic Press)", hymnals: ["Breaking Bread", "Heritage Missal", "Spirit & Song"] },
  { id: "gia", name: "GIA Publications", hymnals: ["Gather 4", "Worship 5", "Hymnal for the Hours"] },
  { id: "wlp", name: "World Library Publications", hymnals: ["Word & Song", "We Celebrate"] },
  { id: "liturgical_press", name: "Liturgical Press", hymnals: ["Respond & Acclaim", "Psallite"] },
  { id: "ignatius", name: "Ignatius Press", hymnals: ["Ignatius Pew Missal", "Adoremus Hymnal"] },
];

export const DEFAULT_ENSEMBLE_PRESETS: EnsembleSetup[] = [
  { name: "9:00am", color: "#2563EB", description: "Traditional choir" },
  { name: "11:00am", color: "#16A34A", description: "Contemporary ensemble" },
  { name: "5:00pm", color: "#9333EA", description: "Young adult / cantor-piano" },
];
