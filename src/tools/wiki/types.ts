/**
 * Types for the wiki query tool server.
 * Ref: knowledge/ directory — Karpathy-style LLM knowledge base
 */

export interface WikiQueryResult {
  pages: WikiPageMatch[];
  hotCacheHit?: string;
}

export interface WikiPageMatch {
  page: string;
  relevance: number;
  excerpt: string;
}

export interface WikiSearchResult {
  matches: WikiSearchMatch[];
}

export interface WikiSearchMatch {
  page: string;
  line: number;
  context: string;
}
