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
  occasions?: string[];
  functions?: string[];
  isHiddenGlobal?: boolean;
}

/**
 * Position-to-function mapping for slot-aware filtering.
 * A psalm slot should ONLY show psalms. A gathering slot shows gathering songs.
 */
const POSITION_FUNCTIONS: Record<string, string[]> = {
  gathering: ["gathering", "entrance"],
  offertory: ["offertory", "preparation_of_gifts", "preparation of the gifts"],
  communion: ["communion"],
  communion1: ["communion"],
  communion2: ["communion"],
  communion3: ["communion"],
  sending: ["sending", "recessional", "closing"],
  prelude: ["prelude", "gathering", "meditation"],
  psalm: ["psalm", "responsorial"],
  gospelAcclamation: ["gospel_acclamation", "gospel acclamation"],
  gospel_acclamation: ["gospel_acclamation", "gospel acclamation"],
};

/**
 * Category gating: which song categories are eligible for each position.
 * Prevents mass parts from appearing in communion suggestions, etc.
 */
const POSITION_ELIGIBLE_CATEGORIES: Record<string, Set<string>> = {
  gathering: new Set(["song"]),
  offertory: new Set(["song"]),
  communion: new Set(["song"]),
  communion1: new Set(["song"]),
  communion2: new Set(["song"]),
  communion3: new Set(["song"]),
  sending: new Set(["song"]),
  prelude: new Set(["song"]),
  psalm: new Set(["psalm"]),
  gospelAcclamation: new Set(["gospel_acclamation", "gospel_acclamation_refrain"]),
  gospel_acclamation: new Set(["gospel_acclamation", "gospel_acclamation_refrain"]),
  penitentialAct: new Set(["song", "mass_part"]),
  penitential_act: new Set(["song", "mass_part"]),
  gloria: new Set(["song", "mass_part"]),
  fractionRite: new Set(["song", "mass_part"]),
  fraction_rite: new Set(["song", "mass_part"]),
  lordsPrayer: new Set(["song", "mass_part"]),
  lords_prayer: new Set(["song", "mass_part"]),
};

/**
 * Generate a liturgically intelligent explanation of why a song fits.
 */
function buildExplanation(type: string, detail: string, position: string): string {
  switch (type) {
    case "scripture_match":
      return `This song draws directly from ${detail}, one of today's readings. The assembly will hear these words proclaimed and then sing them.`;
    case "topic_match":
      return `The theme of "${detail}" in today's readings resonates with this song's message.`;
    case "season_match":
      return `Well-suited for ${detail}. Using seasonal music helps the assembly enter into the liturgical time.`;
    case "function_match":
      return `Written as a ${detail} song. The music and text are composed for this moment in the liturgy.`;
    case "familiarity":
      return `Your community knows this song (${detail}). Familiar songs encourage full, active participation.`;
    case "recency_penalty":
      return `${detail}. Rotating songs prevents fatigue while building repertoire.`;
    default:
      return detail;
  }
}

function formatReadingType(type: string): string {
  const map: Record<string, string> = {
    entrance_antiphon: "Entrance Ant.",
    first_reading: "1st Reading",
    second_reading: "2nd Reading",
    sequence: "Sequence",
    gospel: "Gospel",
    communion_antiphon: "Communion Ant.",
  };
  return map[type] || type;
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
 * Major liturgical seasons that conflict with each other.
 * A song tagged for one should not appear during another.
 */
const SEASON_PREFIXES: Record<string, string> = {
  advent: "advent",
  christmas: "christmas",
  "holy-family": "christmas",
  "baptism-of-the-lord": "christmas",
  "the-epiphany": "christmas",
  "2nd-sun-after-christmas": "christmas",
  lent: "lent",
  "palm-sunday": "lent",
  easter: "easter",
  pentecost: "easter",
  ascension: "easter",
};

/** Title patterns that strongly indicate a seasonal song (for untagged songs) */
const SEASONAL_TITLE_PATTERNS: Array<{ pattern: RegExp; season: string }> = [
  { pattern: /\bchristmas\b/i, season: "christmas" },
  { pattern: /\bnoel\b/i, season: "christmas" },
  { pattern: /\bnativity\b/i, season: "christmas" },
  { pattern: /\bmanger\b/i, season: "christmas" },
  { pattern: /\binfant holy\b/i, season: "christmas" },
  { pattern: /\bsilent night\b/i, season: "christmas" },
  { pattern: /\bo holy night\b/i, season: "christmas" },
  { pattern: /\baway in a\b/i, season: "christmas" },
  { pattern: /\bangels we have heard\b/i, season: "christmas" },
  { pattern: /\bhark.+herald\b/i, season: "christmas" },
  { pattern: /\bjoy to the world\b/i, season: "christmas" },
  { pattern: /\bo little town\b/i, season: "christmas" },
  { pattern: /\bwhat child is this\b/i, season: "christmas" },
  { pattern: /\bo come.*(emmanuel|faithful)\b/i, season: "advent" },
  { pattern: /\badvent\b/i, season: "advent" },
  { pattern: /\blenten\b/i, season: "lent" },
  { pattern: /\bash wednesday\b/i, season: "lent" },
];

function seasonFromOccasionId(occasionId: string): string | null {
  for (const [prefix, season] of Object.entries(SEASON_PREFIXES)) {
    if (occasionId.startsWith(prefix)) return season;
  }
  if (occasionId.startsWith("ordinary-time")) return "ordinary";
  return null;
}

function getSongSeasons(occasions: string[]): Set<string> {
  const seasons = new Set<string>();
  for (const occ of occasions) {
    const s = seasonFromOccasionId(occ);
    if (s) seasons.add(s);
  }
  return seasons;
}

function isSeasonConflict(songSeasons: Set<string>, requestSeason: string): boolean {
  if (songSeasons.size === 0) return false;
  const targetSeason = requestSeason.toLowerCase();
  // Map the request season string to our canonical names
  let canonical = "ordinary";
  if (targetSeason.includes("advent")) canonical = "advent";
  else if (targetSeason.includes("christmas")) canonical = "christmas";
  else if (targetSeason.includes("lent")) canonical = "lent";
  else if (targetSeason.includes("easter")) canonical = "easter";
  // Conflict if song is ONLY tagged for different major seasons (not ordinary)
  const majorSeasons = new Set([...songSeasons].filter(s => s !== "ordinary"));
  if (majorSeasons.size === 0) return false;
  return !majorSeasons.has(canonical);
}

export interface NpmScriptureMatch {
  readingType: string;
  readingReference: string | null;
  matchedVerseLabel?: string | null;
  matchedVerseExcerpt?: string | null;
}

/**
 * Score a single song against a recommendation request.
 */
export function scoreSong(
  song: SongCandidate,
  request: RecommendationRequest,
  usage: UsageRecord | undefined,
  weights: RecommendationWeights,
  today: string,
  npmScripture?: NpmScriptureMatch[]
): ScoredSong {
  const reasons: RecommendationReason[] = [];
  let total = 0;

  // NPM scripture match (from scripture_song_mappings table)
  if (npmScripture && npmScripture.length > 0) {
    // Prefer the match that has a verse excerpt
    const best = npmScripture.find((m) => m.matchedVerseExcerpt) || npmScripture[0];
    const label = formatReadingType(best.readingType);
    const detail = best.readingReference
      ? `${label} (${best.readingReference})`
      : label;
    const verseTag = best.matchedVerseLabel
      ? (best.matchedVerseLabel === "Refrain" ? "Ref" : `V${best.matchedVerseLabel}`)
      : null;
    const verseNote = verseTag && best.matchedVerseExcerpt
      ? ` — ${verseTag}: "${best.matchedVerseExcerpt}"`
      : "";
    const pts = weights.scriptureMatch;
    total += pts;
    reasons.push({
      type: "scripture_match",
      detail,
      explanation: buildExplanation("scripture_match", detail, request.position) + verseNote,
      points: pts,
    });
  }

  // Scripture match (from song's own scriptureRefs) -- skip if NPM already matched
  // Only one scripture_match reason per song (first match wins)
  const hasNpmMatch = npmScripture && npmScripture.length > 0;
  if (!hasNpmMatch && song.scriptureRefs) {
    let foundScriptureMatch = false;
    for (const ref of song.scriptureRefs) {
      if (foundScriptureMatch) break;
      const refLower = ref.toLowerCase();
      for (const reading of request.readings) {
        if (reading.citation.toLowerCase().includes(refLower) ||
            refLower.includes(reading.citation.toLowerCase().split(" ")[0])) {
          const pts = weights.scriptureMatch;
          total += pts;
          reasons.push({
            type: "scripture_match",
            detail: reading.citation,
            explanation: buildExplanation("scripture_match", reading.citation, request.position),
            points: pts,
          });
          foundScriptureMatch = true;
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
          detail: topic,
          explanation: buildExplanation("topic_match", topic, request.position),
          points: pts,
        });
      }
    }
  }

  // Season match (from liturgicalUse tags or derived from occasion tags)
  let seasonMatched = false;
  if (song.liturgicalUse && song.liturgicalUse.length > 0) {
    const seasonLower = request.season.toLowerCase();
    if (song.liturgicalUse.some((u) => u.toLowerCase().includes(seasonLower))) {
      seasonMatched = true;
    }
  }
  if (!seasonMatched && song.occasions && song.occasions.length > 0) {
    const songSeasons = getSongSeasons(song.occasions);
    const targetSeason = request.season.toLowerCase();
    let canonical = "ordinary";
    if (targetSeason.includes("advent")) canonical = "advent";
    else if (targetSeason.includes("christmas")) canonical = "christmas";
    else if (targetSeason.includes("lent")) canonical = "lent";
    else if (targetSeason.includes("easter")) canonical = "easter";
    if (songSeasons.has(canonical)) seasonMatched = true;
    // Extra boost: song is tagged for this exact occasion
    if (song.occasions.includes(request.occasionId)) {
      const pts = weights.seasonMatch * 2;
      total += pts;
      reasons.push({
        type: "season_match",
        detail: `Tagged for this Sunday`,
        explanation: `This song is specifically recommended for this liturgical occasion.`,
        points: pts,
      });
    }
  }
  if (seasonMatched) {
    const pts = weights.seasonMatch;
    total += pts;
    reasons.push({
      type: "season_match",
      detail: request.season,
      explanation: buildExplanation("season_match", request.season, request.position),
      points: pts,
    });
  }

  // Function match: does this song's purpose match the slot?
  if (song.functions && song.functions.length > 0) {
    const positionFns = POSITION_FUNCTIONS[request.position] || [];
    const songFns = song.functions.map((f) => f.toLowerCase());
    for (const fn of positionFns) {
      if (songFns.some((sf) => sf.includes(fn) || fn.includes(sf))) {
        const pts = weights.functionMatch;
        total += pts;
        reasons.push({
          type: "function_match",
          detail: fn,
          explanation: buildExplanation("function_match", fn, request.position),
          points: pts,
        });
        break;
      }
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
        explanation: buildExplanation("recency_penalty", `Used ${weeksSinceUsed} week(s) ago`, request.position),
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
      detail: `Used ${usage.timesUsedThisYear}x this year`,
      explanation: buildExplanation("familiarity", `used ${usage.timesUsedThisYear} times this year`, request.position),
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
 * npmScriptureMap: keyed by legacy song ID, value is array of reading matches.
 */
export function rankSongs(
  candidates: SongCandidate[],
  request: RecommendationRequest,
  usageMap: Map<string, UsageRecord>,
  weights: RecommendationWeights,
  today: string = new Date().toISOString().slice(0, 10),
  npmScriptureMap?: Map<string, NpmScriptureMatch[]>
): ScoredSong[] {
  const excludeSet = new Set(request.excludeSongIds ?? []);

  const eligible = POSITION_ELIGIBLE_CATEGORIES[request.position];

  const scored = candidates
    .filter((s) => {
      if (excludeSet.has(s.id) || s.isHiddenGlobal) return false;
      // Category gating: only allow eligible categories for this position
      if (eligible && s.category && !eligible.has(s.category)) return false;
      // Exclude songs tagged for conflicting seasons (via occasion tags)
      if (s.occasions && s.occasions.length > 0) {
        const songSeasons = getSongSeasons(s.occasions);
        if (isSeasonConflict(songSeasons, request.season)) return false;
      }
      // Exclude songs with seasonal titles when in a conflicting season
      for (const rule of SEASONAL_TITLE_PATTERNS) {
        if (rule.pattern.test(s.title)) {
          const fakeSeason = new Set([rule.season]);
          if (isSeasonConflict(fakeSeason, request.season)) return false;
          break;
        }
      }
      return true;
    })
    .map((s) =>
      scoreSong(s, request, usageMap.get(s.id), weights, today, npmScriptureMap?.get(s.id))
    )
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, request.limit ?? 10);
}
