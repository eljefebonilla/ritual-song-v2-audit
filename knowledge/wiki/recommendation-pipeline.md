# Recommendation Pipeline

Source: `src/tools/recommendation/index.ts`, `src/tools/recommendation/scoring.ts`, `src/lib/recommendations.ts`

## Two Engines

The app has two recommendation engines:

| Engine | Location | Context |
|---|---|---|
| Legacy engine | `src/lib/recommendations.ts` | Used by app UI; simpler scoring |
| Runtime engine | `src/tools/recommendation/scoring.ts` | MCP-style tool server; configurable weights |

This page documents the runtime engine (scoring.ts), which is the authoritative system.

## Tool Definitions

Three tools are registered via `createRecommendationTools()`:

| Tool | Description |
|---|---|
| `recommendation.score` | Full scoring run; returns ScoredSong[] with reasons |
| `recommendation.list` | Lightweight; returns titles + scores only |
| `recommendation.explain` | Explains scoring breakdown for a specific song |
| `recommendation.scripture` | NPM scripture lookup for an occasion |

## End-to-End Flow

```
1. Caller builds RecommendationRequest
   {
     occasionId: "advent-01-a",
     position: "gathering",
     season: "advent",
     readings: [{ citation: "Is 2:1-5", summary: "..." }, ...],
     excludeSongIds: [...],
     limit: 10
   }

2. Caller loads candidates from song-library.json
   (filtered by ensemble if needed before passing)

3. Caller loads NPM scripture mappings from Supabase
   getScriptureSongsForOccasion(occasionId)
   → Map<legacyId, NpmScriptureMatch[]>

4. Caller loads semantic similarity scores from Supabase
   pgvector cosine similarity: occasion embedding vs. song embeddings
   → Map<songId, number>  (0.0 – 1.0)

5. Caller loads usage records
   Per-ensemble usage tracking (lastUsedDate, timesUsedThisYear, nextScheduledDate)
   → Map<songId, UsageRecord>

6. Call rankSongs(candidates, request, usageMap, weights, today, npmMap, semMap)

7. rankSongs() filters candidates:
   - Remove excluded IDs and globally hidden songs
   - Apply category gate (POSITION_ELIGIBLE_CATEGORIES)
   - Apply function hard gate (FUNCTION_REQUIRED_POSITIONS)
   - Apply psalm number hard gate (psalm position only)
   - Exclude season-conflicting songs

8. For each passing candidate, call scoreSong():
   - NPM scripture match (+30 or +60 if antiphon match)
   - Fallback scriptureRefs match (+30, only if no NPM match)
   - Topic match (+20 per hit, max 3 hits)
   - Season match (+15 per season hit + exact occasion bonus)
   - Function match (+25) or mismatch penalty (−15)
   - Recency penalty (−5 per week within 4 weeks)
   - Familiarity boost (+10 if used 2–8x this year)
   - Semantic similarity (+0 to +20 scaled by cosine score)
   - Catalog baseline (+3 if score still 0)

9. Filter out songs with score ≤ 0

10. Sort descending by score

11. Return top N (limit, default 10)
```

## RecommendationRequest Type

```typescript
interface RecommendationRequest {
  occasionId: string;
  position: string;       // "gathering", "communion1", "psalm", etc.
  season: string;         // "advent", "lent", "easter", "ordinary", etc.
  readings: {
    citation: string;     // "Is 2:1-5"
    summary: string;      // "All nations shall stream to the mountain..."
  }[];
  excludeSongIds?: string[];
  limit?: number;         // default 10
}
```

## ScoredSong Output Type

```typescript
interface ScoredSong {
  songId: string;
  title: string;
  composer?: string;
  score: number;
  reasons: RecommendationReason[];
  weeksSinceUsed: number | null;
  weeksUntilNext: number | null;
}

interface RecommendationReason {
  type: "scripture_match" | "topic_match" | "season_match" | "function_match"
      | "familiarity" | "user_ranking" | "recency_penalty" | "semantic_similarity";
  detail: string;
  explanation?: string;  // Human-readable explanation
  points: number;        // Positive = boost, negative = penalty
}
```

## Configurable Weights

Weights come from `RuntimeContext.config.recommendationWeights` (type: `RecommendationWeights`).

Default values from `DEFAULT_RECOMMENDATION_WEIGHTS`:
```
scriptureMatch:     30
topicMatch:         20
seasonMatch:        15
functionMatch:      25
recencyPenalty:     5
familiarityBoost:   10
userRankingBoost:   15
semanticSimilarity: 20
```

Weights can be overridden per parish via `RuntimeConfig` stored in Supabase.

## Runtime Context

Every tool handler receives a `RuntimeContext`:

```typescript
interface RuntimeContext {
  config: RuntimeConfig;       // includes weights
  conversationId: string;
  parishId?: string;
  userId?: string;
  isAdmin: boolean;
}
```

## Legacy Engine Differences

The legacy `recommendations.ts` engine differs from scoring.ts in:
- Does not use `npmScriptureMap` (NPM data)
- Does not use `semanticSimilarityMap` (pgvector)
- Uses global `usageCount` on the song, not per-ensemble `UsageRecord`
- Topic extraction uses regex patterns on reading summaries, not song `topics` field directly
- Adjacent-occasion recency detection is ID-based heuristic, not date-based
- Returns `SongRecommendation[]` (song object + score + reasons array of strings)

## Multi-Position Planning

The legacy `recommendForOccasion()` function runs recommendations for all standard positions in sequence, tracking used songs to avoid repeats across positions:

```
positions: gathering → offertory → communion1 → communion2 → sending → prelude → psalm → gospelAcclamation
```

The first-choice song for each position is excluded from subsequent positions.
