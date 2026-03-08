/**
 * Song Explorer — Neural network data builder for the vine visualization.
 *
 * Takes readings for a date, extracts themes, matches songs with hard constraints,
 * and produces a graph structure for the SVG vine renderer.
 */

import type { LibrarySong } from "./types";
import {
  getReadingsForDate,
  getCitationsForSubFilter,
  scriptureMatch,
  parseCitation,
  type DayReadings,
} from "./scripture-matching";

// --- Hard Constraint Engine ---

/** Seasons where Alleluia is forbidden */
const NO_ALLELUIA_SEASONS = new Set(["lent"]);

/** Songs with these words in the title are flagged for Alleluia check */
function containsAlleluia(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("alleluia") || lower.includes("hallelujah");
}

/** Season compatibility — which seasons a song is appropriate for */
const SEASON_EXCLUSIVE_TOPICS: Record<string, Set<string>> = {
  advent: new Set(["Advent", "Second Coming", "Preparation"]),
  christmas: new Set(["Christmas", "Incarnation", "Nativity"]),
  lent: new Set(["Lent", "Lenten", "Repentance", "Fasting", "Temptation"]),
  easter: new Set(["Easter", "Resurrection", "Paschal Mystery"]),
};

/** Check if a song is seasonally inappropriate */
function isSeasonInappropriate(song: LibrarySong, currentSeason: string): boolean {
  if (!song.topics || song.topics.length === 0) return false;

  for (const [season, exclusiveTopics] of Object.entries(SEASON_EXCLUSIVE_TOPICS)) {
    if (season === currentSeason) continue; // Same season = fine
    // If the song has a topic exclusive to another season, it's inappropriate
    for (const topic of song.topics) {
      if (exclusiveTopics.has(topic)) return true;
    }
  }
  return false;
}

/** Function appropriateness — gathering songs shouldn't be used for sending, etc. */
const FUNCTION_COMPATIBILITY: Record<string, Set<string>> = {
  gathering: new Set(["gathering", "entrance", "prelude"]),
  offertory: new Set(["offertory", "preparation_of_gifts"]),
  communion: new Set(["communion"]),
  sending: new Set(["sending", "recessional", "closing", "mission"]),
};

function isFunctionAppropriate(song: LibrarySong, targetFunction?: string): boolean {
  if (!targetFunction) return true; // No target = all OK
  if (!song.functions || song.functions.length === 0) return true; // No function tags = OK

  const compatible = FUNCTION_COMPATIBILITY[targetFunction];
  if (!compatible) return true; // Unknown function = no filtering

  // If song has function tags, at least one must be compatible
  // But only filter if the song has EXCLUSIVE function tags
  const exclusiveFunctions = new Set(["gathering", "entrance", "sending", "recessional", "closing"]);
  const hasExclusive = song.functions.some((f) => exclusiveFunctions.has(f));

  if (!hasExclusive) return true; // Song has no exclusive function = OK for anything

  return song.functions.some((f) => compatible.has(f));
}

// --- Theme Extraction ---

/** Map reading themes to song topics */
const THEME_TO_TOPICS: Record<string, string[]> = {
  mercy: ["Mercy", "Compassion", "Forgiveness"],
  forgiveness: ["Reconciliation", "Mercy", "Forgiveness", "Repentance"],
  love: ["Love of God for Us", "Love for Others", "Love for God"],
  hope: ["Hope", "Trust", "Courage"],
  faith: ["Faith", "Trust", "Discipleship"],
  joy: ["Joy", "Praise", "Celebration"],
  peace: ["Peace", "Comfort", "Rest"],
  light: ["Light", "Truth", "Guidance"],
  healing: ["Healing", "Comfort", "Wholeness"],
  water: ["Water", "Baptism"],
  eucharist: ["Eucharist", "Communion", "Bread", "Food"],
  shepherd: ["Good Shepherd", "Shepherd", "Guidance", "Providence"],
  cross: ["Cross", "Suffering", "Sacrifice", "Paschal Mystery"],
  resurrection: ["Resurrection", "Easter", "New Life", "Eternal Life"],
  spirit: ["Holy Spirit", "Trinity"],
  kingdom: ["Kingdom / Reign of God", "Kingdom"],
  service: ["Service", "Ministry", "Mission", "Discipleship"],
  justice: ["Justice", "Social Concern"],
  prayer: ["Petition / Prayer", "Presence of God"],
  community: ["Community", "Unity", "Church", "Gathering"],
  praise: ["Praise", "Song", "Worship", "Thanksgiving"],
  repentance: ["Repentance", "Reconciliation", "Conversion", "Sin"],
  preparation: ["Advent", "Second Coming", "Hope"],
  incarnation: ["Incarnation", "Christmas", "Jesus Christ"],
  journey: ["Journey", "Discipleship", "Pilgrimage"],
  covenant: ["Covenant", "Promise of God", "Faithfulness of God"],
  creation: ["Creation", "Providence", "Stewardship"],
  mission: ["Mission", "Sending Forth", "Evangelization", "Witness"],
};

/** Extract themes from reading citations using book-level heuristics */
function extractThemesFromCitations(readings: DayReadings): string[] {
  const themes: string[] = [];
  const citations = readings.all;

  for (const cit of citations) {
    const parsed = parseCitation(cit);
    if (!parsed) continue;

    // Book-level theme associations
    const bookThemes: Record<string, string[]> = {
      isa: ["hope", "justice", "covenant", "light", "healing"],
      jer: ["covenant", "repentance", "hope"],
      ezek: ["shepherd", "spirit", "resurrection"],
      hos: ["love", "covenant", "forgiveness"],
      mic: ["justice", "mercy", "peace"],
      amos: ["justice", "service"],
      matt: ["kingdom", "discipleship", "service"],
      mark: ["faith", "healing", "mission"],
      luke: ["mercy", "joy", "prayer", "justice"],
      john: ["light", "love", "eucharist", "resurrection"],
      rom: ["faith", "grace", "love"],
      "1cor": ["community", "love", "eucharist"],
      "2cor": ["service", "grace", "cross"],
      gal: ["faith", "freedom", "spirit"],
      eph: ["community", "love", "praise"],
      phil: ["joy", "service", "praise"],
      col: ["praise", "community"],
      heb: ["faith", "covenant", "cross"],
      jas: ["faith", "justice", "prayer"],
      "1pet": ["hope", "faith", "cross"],
      ps: ["praise", "prayer"],
      gen: ["creation", "covenant"],
      exod: ["covenant", "journey", "freedom"],
      deut: ["covenant", "love"],
    };

    const bt = bookThemes[parsed.book];
    if (bt) {
      for (const t of bt) {
        if (!themes.includes(t)) themes.push(t);
      }
    }
  }

  return themes;
}

// --- Graph Builder ---

export interface ExplorerNode {
  id: string;
  type: "reading" | "theme" | "song";
  label: string;
  sublabel?: string;
  score?: number;
  songId?: string;
  usageCount?: number;
  reasons?: string[];
}

export interface ExplorerEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ExplorerGraph {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  readingNodes: ExplorerNode[];
  themeNodes: ExplorerNode[];
  songNodes: ExplorerNode[];
}

/**
 * Build the explorer graph for a given date.
 *
 * @param dateStr YYYY-MM-DD date
 * @param songs All library songs
 * @param season Current liturgical season (for hard constraints)
 * @param targetFunction Optional mass position (gathering, communion, etc.)
 * @param limit Max songs per theme branch
 */
export function buildExplorerGraph(
  dateStr: string,
  songs: LibrarySong[],
  season: string,
  targetFunction?: string,
  limit = 5
): ExplorerGraph {
  const readings = getReadingsForDate(dateStr);
  const themes = extractThemesFromCitations(readings);
  const isLent = NO_ALLELUIA_SEASONS.has(season);

  // Build reading nodes
  const readingNodes: ExplorerNode[] = [];
  if (readings.first) {
    readingNodes.push({ id: "r-first", type: "reading", label: readings.first, sublabel: "1st Reading" });
  }
  if (readings.psalm) {
    readingNodes.push({ id: "r-psalm", type: "reading", label: readings.psalm, sublabel: "Psalm" });
  }
  if (readings.second) {
    readingNodes.push({ id: "r-second", type: "reading", label: readings.second, sublabel: "2nd Reading" });
  }
  if (readings.gospel) {
    readingNodes.push({ id: "r-gospel", type: "reading", label: readings.gospel, sublabel: "Gospel" });
  }

  // Build theme nodes
  const themeNodes: ExplorerNode[] = themes.map((t) => ({
    id: `t-${t}`,
    type: "theme" as const,
    label: t.charAt(0).toUpperCase() + t.slice(1),
  }));

  // Connect readings → themes
  const readingThemeEdges: ExplorerEdge[] = [];
  for (const rNode of readingNodes) {
    const parsed = parseCitation(rNode.label);
    if (!parsed) continue;

    const bookThemes: Record<string, string[]> = {
      isa: ["hope", "justice", "covenant", "light", "healing"],
      jer: ["covenant", "repentance", "hope"],
      ezek: ["shepherd", "spirit", "resurrection"],
      matt: ["kingdom", "discipleship", "service"],
      mark: ["faith", "healing", "mission"],
      luke: ["mercy", "joy", "prayer", "justice"],
      john: ["light", "love", "eucharist", "resurrection"],
      rom: ["faith", "grace", "love"],
      ps: ["praise", "prayer"],
    };

    const bt = bookThemes[parsed.book] || [];
    for (const t of bt) {
      if (themes.includes(t)) {
        readingThemeEdges.push({
          from: rNode.id,
          to: `t-${t}`,
          weight: 1,
        });
      }
    }
  }

  // Score songs per theme
  const songNodes: ExplorerNode[] = [];
  const themeSongEdges: ExplorerEdge[] = [];
  const seenSongs = new Set<string>();

  // Also find scripture matches directly
  const allCitations = readings.all;
  const directMatches: { song: LibrarySong; matchingRefs: string[] }[] = [];

  for (const song of songs) {
    // Hard constraints
    if (song.category && song.category !== "song") continue;
    if (song.isHiddenGlobal) continue;
    if (isLent && containsAlleluia(song.title)) continue;
    if (isSeasonInappropriate(song, season)) continue;
    if (!isFunctionAppropriate(song, targetFunction)) continue;

    // Check direct scripture match
    if (song.scriptureRefs && song.scriptureRefs.length > 0) {
      const matchingRefs: string[] = [];
      for (const ref of song.scriptureRefs) {
        for (const cit of allCitations) {
          if (scriptureMatch(ref, cit)) {
            matchingRefs.push(ref);
            break;
          }
        }
      }
      if (matchingRefs.length > 0) {
        directMatches.push({ song, matchingRefs });
      }
    }
  }

  // Add direct scripture matches as high-priority songs
  for (const { song, matchingRefs } of directMatches.slice(0, 15)) {
    if (seenSongs.has(song.id)) continue;
    seenSongs.add(song.id);

    const nodeId = `s-${song.id}`;
    songNodes.push({
      id: nodeId,
      type: "song",
      label: song.title,
      sublabel: song.composer,
      songId: song.id,
      usageCount: song.usageCount,
      score: 90 + (song.usageCount > 5 ? 10 : 0),
      reasons: matchingRefs.map((r) => `Scripture: ${r}`),
    });

    // Connect to relevant reading nodes
    for (const ref of matchingRefs) {
      const refParsed = parseCitation(ref);
      if (!refParsed) continue;
      for (const rNode of readingNodes) {
        const rParsed = parseCitation(rNode.label);
        if (rParsed && rParsed.book === refParsed.book) {
          themeSongEdges.push({ from: rNode.id, to: nodeId, weight: 3 });
        }
      }
    }
  }

  // Add topic-matched songs per theme
  for (const theme of themes) {
    const topicNames = THEME_TO_TOPICS[theme] || [theme];
    const themeSongs: { song: LibrarySong; matchCount: number }[] = [];

    for (const song of songs) {
      if (seenSongs.has(song.id)) continue;
      if (song.category && song.category !== "song") continue;
      if (song.isHiddenGlobal) continue;
      if (isLent && containsAlleluia(song.title)) continue;
      if (isSeasonInappropriate(song, season)) continue;
      if (!isFunctionAppropriate(song, targetFunction)) continue;

      if (song.topics && song.topics.length > 0) {
        let matchCount = 0;
        for (const tn of topicNames) {
          if (song.topics.includes(tn)) matchCount++;
        }
        if (matchCount > 0) {
          themeSongs.push({ song, matchCount });
        }
      }
    }

    // Sort by match count then usage, take top N
    themeSongs.sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.song.usageCount - a.song.usageCount;
    });

    for (const { song, matchCount } of themeSongs.slice(0, limit)) {
      if (seenSongs.has(song.id)) continue;
      seenSongs.add(song.id);

      const nodeId = `s-${song.id}`;
      songNodes.push({
        id: nodeId,
        type: "song",
        label: song.title,
        sublabel: song.composer,
        songId: song.id,
        usageCount: song.usageCount,
        score: 50 + matchCount * 15 + Math.min(song.usageCount, 20),
        reasons: [`Topic: ${theme}`],
      });

      themeSongEdges.push({
        from: `t-${theme}`,
        to: nodeId,
        weight: matchCount,
      });
    }
  }

  // Sort song nodes by score
  songNodes.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    nodes: [...readingNodes, ...themeNodes, ...songNodes],
    edges: [...readingThemeEdges, ...themeSongEdges],
    readingNodes,
    themeNodes,
    songNodes,
  };
}
