# Knowledge Base Changelog

## 2026-04-10 — Wiki initialized from codebase analysis. 7 core pages created.

Files created:
- `knowledge/index.md` — Master index
- `knowledge/log.md` — This file
- `knowledge/claw.md` — Context-Loading Anchor Words
- `knowledge/hot-cache.md` — Frequently accessed facts
- `knowledge/raw/README.md` — Source data pointers
- `knowledge/wiki/scoring-rules.md` — Full scoring engine documentation
- `knowledge/wiki/liturgical-positions.md` — All 16+ Mass positions
- `knowledge/wiki/scripture-matching.md` — NPM + scriptureRefs matching systems
- `knowledge/wiki/seasons-and-cycles.md` — Liturgical year structure
- `knowledge/wiki/song-library.md` — 3,045-song library structure
- `knowledge/wiki/ensemble-structure.md` — 5 ensembles and music plans
- `knowledge/wiki/recommendation-pipeline.md` — End-to-end recommendation flow

Tool files created:
- `src/tools/wiki/types.ts` — WikiQueryResult, WikiPageMatch, WikiSearchResult types
- `src/tools/wiki/index.ts` — wiki.query and wiki.search tool definitions

Source files analyzed:
- `src/tools/recommendation/scoring.ts`
- `src/tools/recommendation/types.ts`
- `src/tools/recommendation/index.ts`
- `src/lib/recommendations.ts`
- `src/lib/types.ts`
- `src/lib/scripture-matching.ts`
- `src/lib/grid-types.ts`
- `src/runtime/types.ts`
- `src/data/song-library.json` (3,045 songs)
- `src/data/occasions/advent-01-a.json` (sample)
