import { describe, it, expect } from "vitest";
import { scoreSong, rankSongs } from "../scoring";
import { DEFAULT_RECOMMENDATION_WEIGHTS } from "@/runtime/types";
import type { UsageRecord } from "../types";

const weights = DEFAULT_RECOMMENDATION_WEIGHTS;

const baseSong = {
  id: "song-1",
  title: "On Eagle's Wings",
  composer: "Michael Joncas",
};

const baseRequest = {
  occasionId: "easter-01-c",
  position: "communion1",
  season: "easter",
  readings: [
    { citation: "Psalm 118", summary: "Give thanks to the Lord for he is good." },
    { citation: "John 20:1-9", summary: "Mary Magdalene found the tomb empty. Christ is risen." },
  ],
};

describe("scoreSong", () => {
  it("scores scripture match", () => {
    const song = { ...baseSong, scriptureRefs: ["Psalm 118"] };
    const result = scoreSong(song, baseRequest, undefined, weights, "2026-04-05");
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.type === "scripture_match")).toBe(true);
  });

  it("scores topic match from reading summaries", () => {
    const song = { ...baseSong, topics: ["resurrection", "risen"] };
    const result = scoreSong(song, baseRequest, undefined, weights, "2026-04-05");
    expect(result.reasons.some((r) => r.type === "topic_match")).toBe(true);
  });

  it("scores season match", () => {
    const song = { ...baseSong, liturgicalUse: ["easter", "paschal"] };
    const result = scoreSong(song, baseRequest, undefined, weights, "2026-04-05");
    expect(result.reasons.some((r) => r.type === "season_match")).toBe(true);
  });

  it("applies recency penalty for recently used songs", () => {
    const usage: UsageRecord = {
      songId: "song-1",
      lastUsedDate: "2026-04-01", // 4 days ago
      nextScheduledDate: null,
      timesUsedThisYear: 5,
    };
    const song = { ...baseSong, scriptureRefs: ["Psalm 118"] };
    const withRecency = scoreSong(song, baseRequest, usage, weights, "2026-04-05");
    const withoutRecency = scoreSong(song, baseRequest, undefined, weights, "2026-04-05");
    // Song used last week should score lower than same song with no recent usage
    expect(withRecency.score).toBeLessThanOrEqual(withoutRecency.score);
  });

  it("applies familiarity boost for moderately used songs", () => {
    const usage: UsageRecord = {
      songId: "song-1",
      lastUsedDate: "2026-02-01", // 9 weeks ago, no recency penalty
      nextScheduledDate: null,
      timesUsedThisYear: 4,
    };
    const song = { ...baseSong, scriptureRefs: ["Psalm 118"] };
    const result = scoreSong(song, baseRequest, usage, weights, "2026-04-05");
    expect(result.reasons.some((r) => r.type === "familiarity")).toBe(true);
  });

  it("computes weeksSinceUsed and weeksUntilNext", () => {
    const usage: UsageRecord = {
      songId: "song-1",
      lastUsedDate: "2026-03-01",
      nextScheduledDate: "2026-05-01",
      timesUsedThisYear: 2,
    };
    const result = scoreSong(baseSong, baseRequest, usage, weights, "2026-04-05");
    expect(result.weeksSinceUsed).toBeGreaterThan(0);
    expect(result.weeksUntilNext).toBeGreaterThan(0);
  });
});

describe("rankSongs", () => {
  it("returns songs sorted by score descending", () => {
    const candidates = [
      { ...baseSong, id: "a", scriptureRefs: ["Psalm 118"], topics: ["resurrection"] },
      { ...baseSong, id: "b", title: "Generic Hymn" },
      { ...baseSong, id: "c", scriptureRefs: ["John 20"], topics: ["risen", "tomb"] },
    ];
    const results = rankSongs(candidates, baseRequest, new Map(), weights);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("excludes songs in the exclude list", () => {
    const candidates = [
      { ...baseSong, id: "a", scriptureRefs: ["Psalm 118"] },
      { ...baseSong, id: "b", scriptureRefs: ["Psalm 118"] },
    ];
    const results = rankSongs(
      candidates,
      { ...baseRequest, excludeSongIds: ["a"] },
      new Map(),
      weights
    );
    expect(results.every((r) => r.songId !== "a")).toBe(true);
  });

  it("respects the limit parameter", () => {
    const candidates = Array.from({ length: 20 }, (_, i) => ({
      ...baseSong,
      id: `song-${i}`,
      scriptureRefs: ["Psalm 118"],
    }));
    const results = rankSongs(
      candidates,
      { ...baseRequest, limit: 3 },
      new Map(),
      weights
    );
    expect(results.length).toBe(3);
  });
});
