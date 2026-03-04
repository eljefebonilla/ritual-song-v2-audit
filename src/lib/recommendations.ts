import type { LibrarySong, LiturgicalOccasion, Reading } from "./types";

export interface SongRecommendation {
  song: LibrarySong;
  score: number;
  reasons: string[];
}

interface RecommendOptions {
  limit?: number;
  excludeSongIds?: string[];
  userRankings?: Map<string, number>;
  userHidden?: Set<string>;
}

// Positions that correspond to song function tags
const POSITION_FUNCTION_MAP: Record<string, string[]> = {
  gathering: ["gathering", "entrance"],
  offertory: ["offertory", "preparation_of_gifts"],
  communion1: ["communion"],
  communion2: ["communion"],
  communion3: ["communion"],
  sending: ["sending", "recessional", "closing"],
  prelude: ["prelude", "gathering", "meditation"],
  psalm: ["psalm", "responsorial"],
  gospelAcclamation: ["gospel_acclamation"],
  penitentialAct: ["penitential_act", "kyrie"],
  gloria: ["gloria"],
  lordsPrayer: ["lords_prayer"],
  fractionRite: ["fraction_rite", "lamb_of_god"],
};

/**
 * Parse a scripture citation into book + chapter for matching.
 * e.g., "Mt 4:1-11" → { book: "mt", chapter: 4 }
 * e.g., "Gen 2:7-9; 3:1-7" → { book: "gen", chapter: 2 }
 */
function parseCitation(citation: string): { book: string; chapter: number } | null {
  const m = citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
  if (!m) return null;
  return {
    book: m[1].replace(/\s+/g, "").toLowerCase(),
    chapter: parseInt(m[2], 10),
  };
}

/**
 * Check if a song's scripture reference matches a reading citation.
 * Matches on book + chapter (not verse level).
 */
function scriptureMatch(songRef: string, readingCitation: string): boolean {
  const songParsed = parseCitation(songRef);
  const readParsed = parseCitation(readingCitation);
  if (!songParsed || !readParsed) return false;

  // Normalize common abbreviations
  const normalize = (b: string) =>
    b.replace(/^1/, "1").replace(/^2/, "2").replace(/^3/, "3")
      .replace(/^gen$/, "gn").replace(/^exod$/, "ex").replace(/^deut$/, "dt")
      .replace(/^matt?$/, "mt").replace(/^mark$/, "mk")
      .replace(/^luke$/, "lk").replace(/^john$/, "jn")
      .replace(/^rom$/, "rm").replace(/^phil$/, "ph")
      .replace(/^rev$/, "rv").replace(/^isa?$/, "is");

  const normSong = normalize(songParsed.book);
  const normRead = normalize(readParsed.book);

  return normSong === normRead && songParsed.chapter === readParsed.chapter;
}

/**
 * Extract key themes from reading summaries for topic matching.
 */
function extractThemes(readings: Reading[]): string[] {
  const themes: string[] = [];
  const allText = readings.map((r) => r.summary.toLowerCase()).join(" ");

  const themePatterns: [RegExp, string][] = [
    [/\b(mercy|merciful|compassion)\b/, "mercy"],
    [/\b(forgiv|pardon|reconcil)\b/, "forgiveness"],
    [/\b(love|charity|agape)\b/, "love"],
    [/\b(hope|trust|confiden)\b/, "hope"],
    [/\b(faith|believ)\b/, "faith"],
    [/\b(joy|rejoic|gladness)\b/, "joy"],
    [/\b(peace|tranquil)\b/, "peace"],
    [/\b(light|illumin|lamp)\b/, "light"],
    [/\b(water|bapti|thirst)\b/, "water/baptism"],
    [/\b(bread|eucharist|nourish|feed|hunger)\b/, "eucharist"],
    [/\b(shepherd|sheep|flock|lamb)\b/, "shepherd"],
    [/\b(cross|suffer|passion|death)\b/, "suffering/cross"],
    [/\b(resurrect|risen|rise|eternal life)\b/, "resurrection"],
    [/\b(spirit|holy spirit|pentecost)\b/, "holy spirit"],
    [/\b(kingdom|reign)\b/, "kingdom"],
    [/\b(servant|service|ministry)\b/, "service"],
    [/\b(justice|righteous)\b/, "justice"],
    [/\b(pray|prayer)\b/, "prayer"],
    [/\b(communit|gather|assembl|church|unity)\b/, "community"],
    [/\b(sing|praise|worship|glory|glorif)\b/, "praise"],
    [/\b(lent|penanc|repent|convert)\b/, "repentance"],
    [/\b(advent|prepar|wait|coming)\b/, "preparation"],
    [/\b(christmas|incarnat|birth|born|nativity)\b/, "incarnation"],
    [/\b(heal|cure|whole|restor)\b/, "healing"],
    [/\b(pilgrim|journey|way|path)\b/, "journey"],
    [/\b(covenant|promis)\b/, "covenant"],
    [/\b(creation|creat)\b/, "creation"],
    [/\b(mission|send|go forth|evangeliz)\b/, "mission"],
  ];

  for (const [pattern, theme] of themePatterns) {
    if (pattern.test(allText)) {
      themes.push(theme);
    }
  }

  return themes;
}

/**
 * Map season names to their matching liturgicalUse tags.
 */
const SEASON_LITURGICAL_TAGS: Record<string, string[]> = {
  advent: ["advent"],
  christmas: ["christmas", "nativity"],
  lent: ["lent", "lenten"],
  triduum: ["triduum", "holy week", "paschal", "easter"],
  easter: ["easter", "paschal"],
  ordinary: ["ordinary time", "ordinary"],
  solemnity: ["solemnity"],
  feast: ["feast"],
};

/**
 * Core recommendation engine.
 * Scores songs against an occasion + position and returns top matches.
 */
export function recommendSongs(
  occasion: LiturgicalOccasion,
  position: string,
  allSongs: LibrarySong[],
  options: RecommendOptions = {}
): SongRecommendation[] {
  const { limit = 5, excludeSongIds = [], userRankings, userHidden } = options;

  const excludeSet = new Set(excludeSongIds);
  const readingCitations = (occasion.readings || [])
    .filter((r) => r.citation)
    .map((r) => r.citation);
  const readingThemes = extractThemes(occasion.readings || []);
  const thematicTag = occasion.lectionary?.thematicTag?.toLowerCase() || "";
  const seasonTags = SEASON_LITURGICAL_TAGS[occasion.season] || [];
  const positionFunctions = POSITION_FUNCTION_MAP[position] || [];

  // Determine which categories are eligible for this position
  const eligibleCategories = getEligibleCategories(position);

  const scored: SongRecommendation[] = [];

  for (const song of allSongs) {
    // Skip excluded
    if (excludeSet.has(song.id)) continue;
    // Skip hidden
    if (userHidden?.has(song.id)) continue;
    // Skip globally hidden
    if (song.isHiddenGlobal) continue;

    // Category filter — only suggest songs appropriate for the position
    if (eligibleCategories && song.category && !eligibleCategories.has(song.category)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Scripture match (+30 per match)
    if (song.scriptureRefs && song.scriptureRefs.length > 0) {
      for (const ref of song.scriptureRefs) {
        for (const citation of readingCitations) {
          if (scriptureMatch(ref, citation)) {
            score += 30;
            reasons.push(`Scripture: ${ref}`);
            break; // one match per song ref is enough
          }
        }
      }
    }

    // Topic match (+20 per match, max 60)
    let topicScore = 0;
    if (song.topics && song.topics.length > 0) {
      const songTopics = song.topics.map((t) => t.toLowerCase());

      // Match against reading themes
      for (const theme of readingThemes) {
        if (songTopics.some((t) => t.includes(theme) || theme.includes(t))) {
          topicScore += 20;
          reasons.push(`Topic: ${theme}`);
        }
      }

      // Match against thematic tag
      if (thematicTag) {
        const tagWords = thematicTag.split(/\s+/);
        for (const tw of tagWords) {
          if (tw.length > 3 && songTopics.some((t) => t.includes(tw))) {
            topicScore += 15;
            reasons.push(`Theme: ${occasion.lectionary.thematicTag}`);
            break;
          }
        }
      }
    }
    score += Math.min(topicScore, 60);

    // Season match (+15)
    if (song.liturgicalUse && song.liturgicalUse.length > 0) {
      const songUse = song.liturgicalUse.map((u) => u.toLowerCase());
      for (const tag of seasonTags) {
        if (songUse.some((u) => u.includes(tag))) {
          score += 15;
          reasons.push(`Season: ${occasion.seasonLabel}`);
          break;
        }
      }
    }

    // Function match (+25)
    if (song.functions && song.functions.length > 0) {
      const songFns = song.functions.map((f) => f.toLowerCase());
      for (const fn of positionFunctions) {
        if (songFns.some((sf) => sf.includes(fn) || fn.includes(sf))) {
          score += 25;
          reasons.push(`Function: ${fn}`);
          break;
        }
      }
    }

    // Catalog presence — BB2026 (+5)
    if (song.catalogs?.bb2026) {
      score += 5;
      reasons.push("BB2026");
    }

    // Usage frequency
    const usage = song.usageCount || 0;
    if (usage >= 5 && usage <= 50) {
      score += 10;
    } else if (usage >= 1 && usage <= 4) {
      score += 5;
    } else if (usage > 100) {
      score -= 5;
    }

    // Recency penalty — if song appears in occasions ±2 weeks
    if (song.occasions && song.occasions.length > 0 && occasion.dates?.length > 0) {
      const occasionDate = occasion.dates[0]?.date;
      if (occasionDate) {
        const target = new Date(occasionDate + "T12:00:00");
        const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
        // Check if any of the song's occasions have dates within 2 weeks
        // Simplified: just check if the song is used in adjacent season-order occasions
        const adjacentIds = getAdjacentOccasionIds(occasion);
        const usedNearby = song.occasions.some((oid) => adjacentIds.has(oid));
        if (usedNearby) {
          score -= 20;
          reasons.push("Recently used");
        }
      }
    }

    // User ranking boost
    if (userRankings?.has(song.id)) {
      const ranking = userRankings.get(song.id)!;
      score += ranking * 5;
      reasons.push(`Rated: ${ranking}/5`);
    }

    // Only include if score is meaningful
    if (score >= 10) {
      scored.push({ song, score, reasons: [...new Set(reasons)] });
    }
  }

  // Sort by score descending, then by title alphabetically for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.song.title.localeCompare(b.song.title);
  });

  return scored.slice(0, limit);
}

/**
 * Get categories eligible for a given Mass position.
 */
function getEligibleCategories(position: string): Set<string> | null {
  switch (position) {
    case "gathering":
    case "offertory":
    case "communion1":
    case "communion2":
    case "communion3":
    case "sending":
    case "prelude":
      return new Set(["song"]);
    case "psalm":
      return new Set(["psalm"]);
    case "gospelAcclamation":
      return new Set(["gospel_acclamation_refrain", "gospel_acclamation_verse", "gospel_acclamation"]);
    case "penitentialAct":
      return new Set(["kyrie", "song"]);
    case "gloria":
      return new Set(["gloria", "song"]);
    case "lordsPrayer":
      return new Set(["lords_prayer", "song"]);
    case "fractionRite":
      return new Set(["lamb_of_god", "song"]);
    default:
      return null; // no filtering
  }
}

/**
 * Build a set of occasion IDs adjacent (±2 in season order) to the given occasion.
 */
function getAdjacentOccasionIds(occasion: LiturgicalOccasion): Set<string> {
  const ids = new Set<string>();
  const base = occasion.id;
  // Simple heuristic: construct adjacent IDs by modifying the season order
  const parts = base.match(/^(.+)-(\d+)-(.+)$/);
  if (parts) {
    const [, prefix, numStr, suffix] = parts;
    const num = parseInt(numStr, 10);
    for (let d = -2; d <= 2; d++) {
      if (d === 0) continue;
      const adj = num + d;
      if (adj > 0) {
        ids.add(`${prefix}-${String(adj).padStart(2, "0")}-${suffix}`);
      }
    }
  }
  return ids;
}

/**
 * Recommend songs for all positions of an occasion.
 * Returns a map of position → recommendations.
 */
export function recommendForOccasion(
  occasion: LiturgicalOccasion,
  allSongs: LibrarySong[],
  options: RecommendOptions = {}
): Record<string, SongRecommendation[]> {
  const positions = [
    "gathering", "offertory", "communion1", "communion2",
    "sending", "prelude", "psalm", "gospelAcclamation",
  ];

  const result: Record<string, SongRecommendation[]> = {};
  const usedSongIds: string[] = [...(options.excludeSongIds || [])];

  for (const pos of positions) {
    const recs = recommendSongs(occasion, pos, allSongs, {
      ...options,
      excludeSongIds: usedSongIds,
    });
    result[pos] = recs;
    // Track used songs to avoid recommending the same song for multiple positions
    for (const r of recs.slice(0, 1)) {
      usedSongIds.push(r.song.id);
    }
  }

  return result;
}
