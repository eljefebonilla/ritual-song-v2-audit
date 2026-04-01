/**
 * Recommendation Scoring Engine
 * Ref: DESIGN-SPEC-v2.md Section 16.3 — tools/recommendation/
 *
 * Wraps the existing src/lib/recommendations.ts engine with the
 * runtime's config-driven weights, usage history tracking, and
 * "weeks since / weeks until" metadata.
 *
 * The existing engine handles: scripture matching, topic extraction,
 * season filtering, function filtering, user rankings, and category
 * gating. This module adds: configurable weights, recency penalty,
 * familiarity scoring, and structured output.
 */

import type { RecommendationWeights } from "@/runtime/types";
import type {
  ScoredSong,
  RecommendationReason,
  RecommendationRequest,
  UsageRecord,
} from "./types";

interface SongCandidate {
  id: string;
  title: string;
  composer?: string;
  category?: string;
  scriptureRefs?: string[];
  topics?: string[];
  liturgicalUse?: string[];
  isHiddenGlobal?: boolean;
}

/**
 * Compute the number of weeks between two ISO date strings.
 */
function weeksBetween(dateA: string, dateB: string): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round(Math.abs(b - a) / msPerWeek);
}

/**
 * Score a single song against a recommendation request.
 */
export function scoreSong(
  song: SongCandidate,
  request: RecommendationRequest,
  usage: UsageRecord | undefined,
  weights: RecommendationWeights,
  today: string
): ScoredSong {
  const reasons: RecommendationReason[] = [];
  let total = 0;

  // Scripture match
  if (song.scriptureRefs) {
    for (const ref of song.scriptureRefs) {
      const refLower = ref.toLowerCase();
      for (const reading of request.readings) {
        if (reading.citation.toLowerCase().includes(refLower) ||
            refLower.includes(reading.citation.toLowerCase().split(" ")[0])) {
          const pts = weights.scriptureMatch;
          total += pts;
          reasons.push({
            type: "scripture_match",
            detail: `Matches ${reading.citation}`,
            points: pts,
          });
          break;
        }
      }
    }
  }

  // Topic match (from reading summaries)
  if (song.topics) {
    const readingText = request.readings
      .map((r) => r.summary.toLowerCase())
      .join(" ");
    let topicHits = 0;
    for (const topic of song.topics) {
      if (readingText.includes(topic.toLowerCase()) && topicHits < 3) {
        const pts = weights.topicMatch;
        total += pts;
        topicHits++;
        reasons.push({
          type: "topic_match",
          detail: `Topic: ${topic}`,
          points: pts,
        });
      }
    }
  }

  // Season match
  if (song.liturgicalUse) {
    const seasonLower = request.season.toLowerCase();
    if (song.liturgicalUse.some((u) => u.toLowerCase().includes(seasonLower))) {
      const pts = weights.seasonMatch;
      total += pts;
      reasons.push({
        type: "season_match",
        detail: `Season: ${request.season}`,
        points: pts,
      });
    }
  }

  // Recency penalty: songs used recently score lower
  let weeksSinceUsed: number | null = null;
  if (usage?.lastUsedDate) {
    weeksSinceUsed = weeksBetween(usage.lastUsedDate, today);
    if (weeksSinceUsed < 4) {
      const penalty = weights.recencyPenalty * (4 - weeksSinceUsed);
      total -= penalty;
      reasons.push({
        type: "recency_penalty",
        detail: `Used ${weeksSinceUsed} week(s) ago`,
        points: -penalty,
      });
    }
  }

  // Familiarity boost: songs used moderately this year get a boost
  if (usage && usage.timesUsedThisYear >= 2 && usage.timesUsedThisYear <= 8) {
    const pts = weights.familiarityBoost;
    total += pts;
    reasons.push({
      type: "familiarity",
      detail: `Used ${usage.timesUsedThisYear}x this year (familiar to assembly)`,
      points: pts,
    });
  }

  return {
    songId: song.id,
    title: song.title,
    composer: song.composer,
    score: Math.max(0, total),
    reasons,
    weeksSinceUsed,
    weeksUntilNext: usage?.nextScheduledDate
      ? weeksBetween(today, usage.nextScheduledDate)
      : null,
  };
}

/**
 * Score and rank all candidate songs for a recommendation request.
 */
export function rankSongs(
  candidates: SongCandidate[],
  request: RecommendationRequest,
  usageMap: Map<string, UsageRecord>,
  weights: RecommendationWeights,
  today: string = new Date().toISOString().slice(0, 10)
): ScoredSong[] {
  const excludeSet = new Set(request.excludeSongIds ?? []);

  const scored = candidates
    .filter((s) => !excludeSet.has(s.id) && !s.isHiddenGlobal)
    .map((s) => scoreSong(s, request, usageMap.get(s.id), weights, today))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, request.limit ?? 10);
}
