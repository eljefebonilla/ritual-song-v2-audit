/**
 * Core types for the Worship Aid Builder module.
 * Pages carry both rendered HTML (for preview iframes) and
 * structured data (for interactive editing controls).
 */

import type { BrandConfig, ReprintResult } from "@/lib/generators/types";

export interface WorshipAidConfig {
  occasionId: string;
  ensembleId: string;
  parishId: string;
  includeReadings: boolean;
  layout: "fit-page" | "flow";
}

export interface WorshipAidPage {
  id: string;
  type: "cover" | "song" | "reading" | "giving" | "links";
  title: string;
  subtitle?: string;
  position: string;

  // Pre-rendered HTML for iframe preview (rebuilt when edits occur)
  content: string;

  // Structured data per page type
  coverData?: CoverPageData;
  readingData?: ReadingPageData;
  songData?: SongPageData;

  // Edit state (mutable by UI)
  removed: boolean;
  cropTop: number;        // 0–30, percent clipped from image top
  customLinks: LinkItem[];
  givingBlock: boolean;   // show QR giving block on this page
}

export interface CoverPageData {
  parishName: string;
  occasionName: string;
  occasionSubtitle?: string;
  date: string;
  seasonLabel: string;
  seasonColor: string;
  logoUrl: string | null;
  coverArtUrl: string | null;
  logoScale?: number;     // 0.3–2.0, default 1
  logoOffsetY?: number;   // -50 to 50 percent, default 0
}

export interface ReadingPageData {
  readings: { type: string; citation: string; summary: string }[];
}

export interface SongPageData {
  songId: string;
  title: string;
  composer: string | null;
  positionLabel: string;
  reprint: ReprintResult;
  reprintUrl: string | null; // Supabase storage URL for image (null for lyrics/title_only)
  lyrics: string | null;
}

export interface LinkItem {
  label: string;
  url: string;
  icon?: string;
}

export interface WorshipAid {
  id: string;
  config: WorshipAidConfig;
  pages: WorshipAidPage[];
  brand: BrandConfig;
  createdAt: string;
}

// Kept for render-html.ts backward compat (maps to WorshipAid)
export type { BrandConfig };

// ─── Legacy types (kept for resolve-resource.ts and tools/worship-aid/) ────────

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
