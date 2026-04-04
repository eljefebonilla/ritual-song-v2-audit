// Types for the Worship Aid & Menu generation pipeline

export interface BrandConfig {
  parishId: string;
  logoUrl: string | null;
  logoStoragePath: string | null;
  parishDisplayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  layoutPreset: "classic" | "modern" | "warm";
  coverStyle: "photo" | "gradient" | "ai";
  headerOverlayMode: "banner" | "replace";
}

export const DEFAULT_BRAND_CONFIG: Omit<BrandConfig, "parishId"> = {
  logoUrl: null,
  logoStoragePath: null,
  parishDisplayName: "",
  primaryColor: "#333333",
  secondaryColor: "#666666",
  accentColor: "#4A90D9",
  headingFont: "Playfair Display",
  bodyFont: "Inter",
  layoutPreset: "modern",
  coverStyle: "gradient",
  headerOverlayMode: "banner",
};

export interface GeneratorConfig {
  parishId: string;
  brand: BrandConfig;
  fonts: FontAsset[];
}

export interface FontAsset {
  family: string;
  weight: number;
  style: "normal" | "italic";
  base64: string;
  format: "truetype" | "opentype" | "woff2";
}

export interface SetlistSong {
  position: string;
  songId: string;
  title: string;
  composer: string | null;
  hymnalNumber: string | null;
  key: string | null;
}

export interface PersonnelAssignment {
  role: string;
  personName: string;
  side?: string;
}

export interface SetlistData {
  massEventId: string;
  occasionName: string;
  occasionDate: string;
  massTime: string;
  ensemble: string;
  celebrant: string | null;
  songs: SetlistSong[];
  personnel: PersonnelAssignment[];
  safetySong: SetlistSong | null;
  massNotes: string[];
}

export interface WorshipAidSong {
  position: string;
  songId: string;
  title: string;
  composer: string | null;
  reprint: ReprintResult | null;
  lyrics: string | null;
}

export interface WorshipAidData {
  massEventId: string;
  occasionName: string;
  occasionDate: string;
  massTime: string;
  ensemble: string;
  songs: WorshipAidSong[];
  readings: WorshipAidReading[];
  coverImage: CoverImageResult;
  psalmResponse: string | null;
}

export interface WorshipAidReading {
  type: "first" | "psalm" | "second" | "gospel_verse" | "gospel";
  citation: string;
  summary: string;
}

export type ReprintResult =
  | { kind: "pdf"; storagePath: string; pageCount?: number }
  | { kind: "gif"; storagePath: string }
  | { kind: "lyrics"; text: string }
  | { kind: "title_only" };

export type CoverImageResult =
  | { kind: "image"; url: string; storagePath: string }
  | { kind: "gradient"; colors: [string, string] };

export interface GenerationResult {
  success: boolean;
  pdfUrl?: string;
  storagePath?: string;
  error?: string;
  warnings: string[];
}
