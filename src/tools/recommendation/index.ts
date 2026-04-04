/**
 * Recommendation Tool — MCP-style tool server for song recommendations
 * Ref: DESIGN-SPEC-v2.md Section 16.3 — tools/recommendation/
 *
 * Registers tool handlers that the ConversationRuntime can invoke:
 * - recommendation.score: Score songs for a specific occasion + position
 * - recommendation.list: Quick list of top N recommendations
 * - recommendation.explain: Explain why a specific song was recommended
 */

import type { ToolDefinition, RuntimeContext } from "@/runtime/types";
import { rankSongs } from "./scoring";
import type { NpmScriptureMatch } from "./scoring";
import { getScriptureSongsForOccasion } from "@/lib/supabase/scripture-mappings";
import type { RecommendationRequest, UsageRecord, ScoredSong } from "./types";

export type { ScoredSong, RecommendationRequest, UsageRecord } from "./types";

/**
 * Create the recommendation tool definitions.
 * These are registered with the ConversationRuntime.
 */
export function createRecommendationTools(): ToolDefinition[] {
  return [
    {
      name: "recommendation.score",
      description:
        "Score and rank songs for a liturgical occasion and position. Returns top matches with reasons and usage metadata.",
      permissionLevel: "allow",
      handler: async (args, ctx) => {
        const request = args as unknown as RecommendationRequest & {
          candidates: Array<{
            id: string;
            title: string;
            composer?: string;
            scriptureRefs?: string[];
            topics?: string[];
            liturgicalUse?: string[];
            occasions?: string[];
            isHiddenGlobal?: boolean;
          }>;
          usageRecords: UsageRecord[];
          npmScriptureMap?: Record<string, NpmScriptureMatch[]>;
        };

        const usageMap = new Map<string, UsageRecord>();
        for (const record of request.usageRecords ?? []) {
          usageMap.set(record.songId, record);
        }

        const npmMap = request.npmScriptureMap
          ? new Map(Object.entries(request.npmScriptureMap))
          : undefined;

        const results = rankSongs(
          request.candidates ?? [],
          request,
          usageMap,
          ctx.config.recommendationWeights,
          undefined,
          npmMap
        );

        return results;
      },
    },
    {
      name: "recommendation.list",
      description:
        "Quick list of top N song titles for a position. Lightweight version of recommendation.score.",
      permissionLevel: "allow",
      handler: async (args, ctx) => {
        const request = args as unknown as RecommendationRequest & {
          candidates: Array<{
            id: string;
            title: string;
            composer?: string;
            scriptureRefs?: string[];
            topics?: string[];
            liturgicalUse?: string[];
            occasions?: string[];
            isHiddenGlobal?: boolean;
          }>;
          usageRecords: UsageRecord[];
          npmScriptureMap?: Record<string, NpmScriptureMatch[]>;
        };

        const usageMap = new Map<string, UsageRecord>();
        for (const record of request.usageRecords ?? []) {
          usageMap.set(record.songId, record);
        }

        const npmMap = request.npmScriptureMap
          ? new Map(Object.entries(request.npmScriptureMap))
          : undefined;

        const results = rankSongs(
          request.candidates ?? [],
          { ...request, limit: (request.limit ?? 5) },
          usageMap,
          ctx.config.recommendationWeights,
          undefined,
          npmMap
        );

        return results.map((r) => ({
          title: r.title,
          composer: r.composer,
          score: r.score,
          weeksSinceUsed: r.weeksSinceUsed,
        }));
      },
    },
    {
      name: "recommendation.explain",
      description:
        "Explain why a specific song was recommended for a given occasion. Returns detailed scoring breakdown.",
      permissionLevel: "allow",
      handler: async (args, ctx) => {
        const { songId, results } = args as {
          songId: string;
          results: ScoredSong[];
        };

        const match = results.find((r: ScoredSong) => r.songId === songId);
        if (!match) {
          return { error: `Song ${songId} not found in results` };
        }

        return {
          song: { title: match.title, composer: match.composer },
          totalScore: match.score,
          breakdown: match.reasons.map((r) => ({
            category: r.type,
            detail: r.detail,
            explanation: r.explanation,
            points: r.points,
          })),
          weeksSinceUsed: match.weeksSinceUsed,
          weeksUntilNext: match.weeksUntilNext,
          configuredWeights: ctx.config.recommendationWeights,
        };
      },
    },
    {
      name: "recommendation.scripture",
      description:
        "Look up scripture-based song recommendations for a liturgical occasion. Returns matched songs from NPM Liturgy Help data with reading type and scripture reference.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { occasionId } = args as { occasionId: string };
        if (!occasionId) {
          return { error: "occasionId is required" };
        }
        const mappings = await getScriptureSongsForOccasion(occasionId);
        return {
          occasionId,
          totalMappings: mappings.length,
          songs: mappings.map((m) => ({
            songTitle: m.songTitle,
            songId: m.legacyId,
            readingType: m.readingType,
            readingReference: m.readingReference,
          })),
        };
      },
    },
  ];
}
