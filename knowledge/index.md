# Ritual Song Knowledge Base — Master Index

Karpathy-style LLM wiki for the Ritual Song app at `~/Dropbox/RITUALSONG/ritualsong-app/`.

Initialized: 2026-04-10. See `log.md` for changelog.

## Wiki Pages

| Page | Description |
|---|---|
| [scoring-rules.md](wiki/scoring-rules.md) | Full scoring engine: weights, position mappings, category gates, hard gates, penalty logic |
| [liturgical-positions.md](wiki/liturgical-positions.md) | All 16+ Mass positions, what songs go where, hard-gated vs soft-scored slots |
| [scripture-matching.md](wiki/scripture-matching.md) | NPM mappings vs scriptureRefs fallback, antiphon bonus, psalm number hard gate, citation parsing |
| [seasons-and-cycles.md](wiki/seasons-and-cycles.md) | Liturgical year A/B/C cycles, all seasons, occasion ID format, 375 occasion files |
| [song-library.md](wiki/song-library.md) | 3,045 songs — fields, categories, resources, embeddings, usage patterns |
| [ensemble-structure.md](wiki/ensemble-structure.md) | 5 ensembles (Reflections/Foundations/Generations/Heritage/Elevations), music plans per occasion |
| [recommendation-pipeline.md](wiki/recommendation-pipeline.md) | End-to-end recommendation flow, tool definitions, request/response types, legacy vs runtime engine |

## Quick Reference

- Songs: 3,045 in `src/data/song-library.json`
- Occasions: 375 in `src/data/occasions/*.json`
- Ensembles: 5 (reflections, foundations, generations, heritage, elevations)
- Embeddings: 7,703 pgvector vectors in Supabase `song_embeddings`
- NPM mappings: 7,715 in Supabase `scripture_song_mappings`

## Source Data Pointers

See `raw/README.md` for full source file inventory.

## Anchor Terms

See `claw.md` for the full list of Context-Loading Anchor Words that trigger wiki lookups.
