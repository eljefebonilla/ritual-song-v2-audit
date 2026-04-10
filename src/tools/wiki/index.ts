/**
 * Wiki Tool Server — query and search the Ritual Song knowledge base.
 * Ref: knowledge/ directory — Karpathy-style LLM wiki for the recommendation engine.
 *
 * Registers two tools:
 * - wiki.query: keyword/semantic lookup → returns relevant wiki pages
 * - wiki.search: term search across all wiki files → returns matching excerpts
 */

import * as fs from "fs";
import * as path from "path";
import type { ToolDefinition } from "@/runtime/types";
import type {
  WikiQueryResult,
  WikiPageMatch,
  WikiSearchResult,
  WikiSearchMatch,
} from "./types";

export type {
  WikiQueryResult,
  WikiPageMatch,
  WikiSearchResult,
  WikiSearchMatch,
} from "./types";

// Paths relative to process.cwd() (project root)
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const WIKI_DIR = path.join(KNOWLEDGE_DIR, "wiki");
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "index.md");
const CLAW_PATH = path.join(KNOWLEDGE_DIR, "claw.md");
const HOT_CACHE_PATH = path.join(KNOWLEDGE_DIR, "hot-cache.md");

/**
 * All wiki page filenames and their associated keyword groups.
 * This is a static map to avoid reading claw.md on every query.
 */
const PAGE_KEYWORDS: Record<string, string[]> = {
  "scoring-rules.md": [
    "scoring", "score", "weight", "weights", "rank", "recommendation",
    "scripture match", "scripture_match", "function match", "function_match",
    "hard gate", "category gate", "recency penalty", "familiarity boost",
    "semantic similarity", "antiphon bonus", "reason", "points",
    "POSITION_FUNCTIONS", "POSITION_ELIGIBLE_CATEGORIES",
    "FUNCTION_REQUIRED_POSITIONS", "season conflict",
  ],
  "liturgical-positions.md": [
    "position", "gathering", "offertory", "communion", "sending", "prelude",
    "psalm", "gospel acclamation", "gospelAcclamation", "penitential act",
    "penitentialAct", "gloria", "fraction rite", "fractionRite", "lamb of god",
    "lord's prayer", "lordsPrayer", "sprinkling rite", "sprinklingRite",
    "mass setting", "massSetting", "hard gate", "soft score", "mass structure",
    "entrance antiphon",
  ],
  "scripture-matching.md": [
    "scripture", "citation", "parseCitation", "scriptureRefs", "npm",
    "npm mapping", "scripture_song_mappings", "antiphon", "psalm number",
    "extractPsalmNumber", "reading type", "first reading", "second reading",
    "gospel", "entrance_antiphon", "communion_antiphon", "USCCB",
    "date index", "book canon", "canonical", "lectionary",
  ],
  "seasons-and-cycles.md": [
    "season", "advent", "christmas", "lent", "holy week", "easter",
    "ordinary time", "ordinary", "solemnity", "feast", "cycle", "year a",
    "year b", "year c", "lectionary year", "occasion id", "occasion file",
    "seasonal exclusion", "season conflict", "375",
  ],
  "song-library.md": [
    "song library", "library", "3045", "3,045", "song", "category",
    "mass_part", "gospel_acclamation", "topics", "functions", "scriptureRefs",
    "liturgicalUse", "usageCount", "usage count", "resources", "lead sheet",
    "aim", "breaking bread", "ocp", "hymnal", "bb2026", "embedding",
    "7703", "7,703", "isHiddenGlobal", "seasonal title",
  ],
  "ensemble-structure.md": [
    "ensemble", "reflections", "foundations", "generations", "heritage",
    "elevations", "music plan", "musicPlan", "lyric psalter", "spirit & psalm",
    "spirit and psalm", "mass event", "setlist", "choir", "custom slot",
    "5 ensembles",
  ],
  "recommendation-pipeline.md": [
    "pipeline", "rankSongs", "scoreSong", "tool server", "createRecommendationTools",
    "RuntimeContext", "RuntimeConfig", "legacy engine", "ScoredSong",
    "RecommendationRequest", "UsageRecord", "recommendation.score",
    "recommendation.list", "recommendation.explain", "recommendation.scripture",
    "end-to-end", "flow", "filter", "candidate",
  ],
};

/**
 * Hot-cache terms — single-word or phrase queries that can be answered
 * directly from hot-cache.md without reading full wiki pages.
 */
const HOT_CACHE_TRIGGERS = [
  "how many songs", "total songs", "3045", "song count",
  "how many occasions", "total occasions", "375",
  "how many ensembles", "ensembles", "5 ensembles",
  "embeddings", "7703", "npm mappings", "7715",
  "default weights", "weights", "scriptureMatch",
  "hard gate", "hard-gated positions",
  "ensemble colors", "psalm book",
  "key paths", "file paths",
];

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function scorePageRelevance(query: string, pageName: string): number {
  const queryLower = query.toLowerCase();
  const keywords = PAGE_KEYWORDS[pageName] || [];
  let score = 0;
  for (const kw of keywords) {
    if (queryLower.includes(kw.toLowerCase())) {
      // Longer keyword matches are more specific — weight by length
      score += kw.length > 10 ? 3 : kw.length > 5 ? 2 : 1;
    }
  }
  return score;
}

function getExcerpt(content: string, maxLines = 20): string {
  const lines = content.split("\n");
  return lines.slice(0, maxLines).join("\n");
}

function searchInFile(content: string, term: string, pageName: string): WikiSearchMatch[] {
  const matches: WikiSearchMatch[] = [];
  const lines = content.split("\n");
  const termLower = term.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(termLower)) {
      const contextStart = Math.max(0, i - 1);
      const contextEnd = Math.min(lines.length - 1, i + 1);
      const context = lines.slice(contextStart, contextEnd + 1).join("\n");
      matches.push({
        page: pageName,
        line: i + 1,
        context,
      });
      if (matches.length >= 5) break; // cap at 5 matches per file
    }
  }

  return matches;
}

function isHotCacheQuery(query: string): boolean {
  const queryLower = query.toLowerCase();
  return HOT_CACHE_TRIGGERS.some((trigger) => queryLower.includes(trigger.toLowerCase()));
}

/**
 * Create the wiki tool definitions.
 * These are registered with the ConversationRuntime.
 */
export function createWikiTools(): ToolDefinition[] {
  return [
    {
      name: "wiki.query",
      description:
        "Query the Ritual Song knowledge base. Provide a natural language question or keyword query. Returns relevant wiki pages about the scoring engine, liturgical positions, seasons, song library, ensembles, or recommendation pipeline. Use this before answering questions about how the recommendation system works.",
      permissionLevel: "allow",
      handler: async (args): Promise<WikiQueryResult> => {
        const { query, scope } = args as { query: string; scope?: string };

        if (!query) {
          return { pages: [] };
        }

        // Check hot-cache first for quick factual queries
        if (isHotCacheQuery(query)) {
          const hotCache = readFileSafe(HOT_CACHE_PATH);
          if (hotCache) {
            return {
              pages: [],
              hotCacheHit: hotCache,
            };
          }
        }

        // Score all wiki pages for relevance
        const wikiFiles = fs.existsSync(WIKI_DIR)
          ? fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"))
          : [];

        // Filter by scope if provided
        const scopedFiles = scope
          ? wikiFiles.filter((f) => f.includes(scope))
          : wikiFiles;

        const scored: Array<{ pageName: string; relevance: number }> = scopedFiles
          .map((pageName) => ({
            pageName,
            relevance: scorePageRelevance(query, pageName),
          }))
          .filter((p) => p.relevance > 0)
          .sort((a, b) => b.relevance - a.relevance);

        // If no scored matches, fall back to index
        if (scored.length === 0) {
          const indexContent = readFileSafe(INDEX_PATH);
          return {
            pages: [
              {
                page: "index.md",
                relevance: 0,
                excerpt: indexContent
                  ? getExcerpt(indexContent, 30)
                  : "Index not found.",
              },
            ],
          };
        }

        // Return top 3 pages with excerpts
        const topPages = scored.slice(0, 3);
        const pages: WikiPageMatch[] = [];

        for (const { pageName, relevance } of topPages) {
          const filePath = path.join(WIKI_DIR, pageName);
          const content = readFileSafe(filePath);
          pages.push({
            page: pageName,
            relevance,
            excerpt: content ? content : `Could not read ${pageName}`,
          });
        }

        return { pages };
      },
    },
    {
      name: "wiki.search",
      description:
        "Search across all Ritual Song wiki pages for a specific term. Returns matching lines with surrounding context. Useful for finding exact definitions, values, or code references in the knowledge base.",
      permissionLevel: "allow",
      handler: async (args): Promise<WikiSearchResult> => {
        const { term } = args as { term: string };

        if (!term) {
          return { matches: [] };
        }

        const wikiFiles = fs.existsSync(WIKI_DIR)
          ? fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"))
          : [];

        const allMatches: WikiSearchMatch[] = [];

        for (const pageName of wikiFiles) {
          const filePath = path.join(WIKI_DIR, pageName);
          const content = readFileSafe(filePath);
          if (!content) continue;

          const matches = searchInFile(content, term, pageName);
          allMatches.push(...matches);

          // Also search hot-cache and index for quick hits
        }

        // Also search hot-cache
        const hotCache = readFileSafe(HOT_CACHE_PATH);
        if (hotCache) {
          const hotMatches = searchInFile(hotCache, term, "hot-cache.md");
          allMatches.push(...hotMatches);
        }

        return { matches: allMatches.slice(0, 20) }; // cap total at 20
      },
    },
  ];
}
