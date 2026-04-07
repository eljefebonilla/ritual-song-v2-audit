/**
 * Types for the recommendation tool server.
 * Ref: DESIGN-SPEC-v2.md Section 16.3 — tools/recommendation/
 */

export interface ScoredSong {
  songId: string;
  title: string;
  composer?: string;
  score: number;
  reasons: RecommendationReason[];
  weeksSinceUsed: number | null;
  weeksUntilNext: number | null;
}

export interface RecommendationReason {
  type:
    | "scripture_match"
    | "topic_match"
    | "season_match"
    | "function_match"
    | "familiarity"
    | "user_ranking"
    | "recency_penalty"
    | "semantic_similarity";
  detail: string;
  explanation?: string;
  points: number;
}

export interface RecommendationRequest {
  occasionId: string;
  position: string; // "gathering", "communion1", "psalm", etc.
  season: string;
  readings: { citation: string; summary: string }[];
  excludeSongIds?: string[];
  limit?: number;
}

export interface UsageRecord {
  songId: string;
  lastUsedDate: string; // ISO date
  nextScheduledDate: string | null; // ISO date or null
  timesUsedThisYear: number;
}
