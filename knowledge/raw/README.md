# Raw Source Data Pointers

This folder does not copy source data. It points to where data lives.

## Song Library

- **File:** `src/data/song-library.json`
- **Count:** 3,045 songs
- **Fields:** id, title, composer, resources, usageCount, occasions, category, functions, topics, scriptureRefs, liturgicalUse, isHiddenGlobal, catalogs

## Occasions

- **Directory:** `src/data/occasions/*.json`
- **Count:** 375 files
- **Format:** One JSON file per liturgical occasion (e.g., `advent-01-a.json`)
- **Fields:** id, name, year, season, seasonLabel, seasonOrder, dates, lectionary, readings, antiphons, planningNotes, occasionResources, musicPlans

## Lectionary Synopses

- **File:** `src/data/lectionary-synopses.json`
- **Content:** Loglines and reading summaries for each occasion ID
- **Fields per entry:** occasion_id, logline, trajectory, readings (first/second/gospel citations + synopses), invitesUsTo

## All Occasions Summary

- **File:** `src/data/all-occasions.json`
- **Content:** Flattened list of all occasions for search/lookup

## Calendar + Date Index

- **File:** `src/data/date-index.json` — Maps ISO dates to occasion IDs
- **File:** `src/data/calendar.json` — Calendar grid data

## USCCB Citation Data

- **File:** `src/data/usccb-2026.json` — USCCB daily citation strings for 2026
- **File:** `src/data/usccb-2027.json` — USCCB daily citation strings for 2027
- **Format:** `{ date: "YYYY-MM-DD", citations: "Is 2:1-5/Ps 122:1-2.../..." }`

## Supabase Tables

| Table | Content |
|---|---|
| `scripture_song_mappings` | 7,715 NPM Liturgy Help song-to-reading mappings (3-year lectionary) |
| `song_embeddings` | 7,703 pgvector embeddings for semantic similarity |
| `mass_events` | Scheduled Mass events with ensemble, date, time |
| `setlists` | Per-ensemble song selections for each mass event |
| `choir_signups` | Musician scheduling data |

## Scoring Engine

- **File:** `src/tools/recommendation/scoring.ts` — Runtime scoring engine with configurable weights
- **File:** `src/lib/recommendations.ts` — Legacy scoring engine used by app UI

## Type Definitions

- **File:** `src/runtime/types.ts` — RuntimeContext, RecommendationWeights, DEFAULT_RECOMMENDATION_WEIGHTS
- **File:** `src/tools/recommendation/types.ts` — ScoredSong, RecommendationRequest, UsageRecord
- **File:** `src/lib/types.ts` — LiturgicalOccasion, LibrarySong, MusicPlan, Reading

## Scripture Matching

- **File:** `src/lib/scripture-matching.ts` — Citation parser, book canonical map, scriptureMatch()
- **File:** `src/lib/psalm-coverage.ts` — extractPsalmNumber(), extractPsalmNumberFromTitle()

## Supabase Scripture Mappings Loader

- **File:** `src/lib/supabase/scripture-mappings.ts` — getScriptureSongsForOccasion(occasionId)

## Ensemble / Grid Config

- **File:** `src/lib/grid-types.ts` — EnsembleId type, GRID_ROW_KEYS, READING_ROWS
- **File:** `src/lib/calendar-utils.ts` — Ensemble colors, getEnsembleColor()

## Wiki Tools

- **File:** `src/tools/wiki/index.ts` — wiki.query and wiki.search tool definitions
- **File:** `src/tools/wiki/types.ts` — WikiQueryResult, WikiPageMatch, WikiSearchResult types
- **Directory:** `knowledge/wiki/` — Processed markdown wiki pages
