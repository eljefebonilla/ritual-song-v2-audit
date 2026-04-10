/**
 * Core types for the Worship Aid Builder module.
 * Ported from the standalone builder at ~/Desktop/Claude/worship-aid-builder/.
 */

export interface WorshipAidConfig {
  occasionId: string;
  ensembleId: string;
  parishName: string;
  parishLogo?: string; // URL or path
  includeReadings: boolean;
  includeMusicalNotation: boolean;
  pageSize: "letter" | "half-letter"; // 8.5x11 or 5.5x8.5
  layout: "fit-page" | "flow"; // fit-page clips to one page per song, flow lets content run
}

export interface WorshipAidPage {
  id: string;
  type: "cover" | "song" | "reading" | "prayer" | "blank";
  title: string;
  subtitle?: string;
  content: string; // HTML content for this page
  resourcePath?: string; // Path to the resolved image/PDF
  resourceType?: "gif" | "tiff" | "pdf" | "placeholder";
  position: string; // liturgical position (gathering, communion1, etc.)
  editable: boolean;
  cropTop?: number; // percentage to crop from top (for removing baked-in headers)
}

export interface WorshipAid {
  id: string;
  config: WorshipAidConfig;
  pages: WorshipAidPage[];
  createdAt: string;
  updatedAt: string;
}

export type ResourceTier = "ocp-gif" | "wa-gif" | "tiff" | "pdf" | "placeholder";

export interface ResolvedResource {
  tier: ResourceTier;
  path: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface MusicPlanEntry {
  title: string;
  composer?: string;
  description?: string;
}

export interface MusicPlan {
  community?: string;
  communityId?: string;
  ensemble?: string;
  ensembleId?: string;
  gathering?: MusicPlanEntry;
  penitentialAct?: MusicPlanEntry;
  responsorialPsalm?: { psalm: string; setting: string };
  gospelAcclamation?: MusicPlanEntry;
  offertory?: MusicPlanEntry;
  eucharisticAcclamations?: { massSettingName: string; composer?: string };
  communionSongs?: MusicPlanEntry[];
  sending?: MusicPlanEntry;
}
