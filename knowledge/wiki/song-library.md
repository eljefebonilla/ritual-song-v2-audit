# Song Library

Source: `src/data/song-library.json`, `src/lib/types.ts`

## Library Stats (as of wiki init — 2026-04-10)

- **Total songs:** 3,045
- **With topics:** 1,372
- **With scriptureRefs:** 1,107
- **With liturgicalUse:** 0 (field exists in type but not populated in JSON)
- **Embeddings in Supabase:** 7,703 pgvector vectors (more than song count due to verse-level embeddings)

## Song Fields (in song-library.json)

| Field | Type | Description |
|---|---|---|
| id | string | Slug ID (e.g., `amazing-grace--john-newton`) |
| title | string | Display title |
| composer | string (optional) | Composer / arranger / source |
| resources | SongResource[] | Lead sheets, audio, hymnal refs, YouTube links |
| usageCount | number | Cumulative usage across all occasions |
| occasions | string[] | Occasion IDs this song is tagged for |
| category | SongCategory | See categories below |
| functions | string[] | Liturgical function tags (e.g., "gathering", "communion") |
| topics | string[] | Thematic keywords (e.g., "Resurrection", "Mercy") |
| scriptureRefs | string[] | Scripture citations (e.g., "Matthew 12:40") |
| liturgicalUse | string[] | Season/use tags (not populated in current JSON) |
| isHiddenGlobal | boolean (optional) | True = excluded from all recommendations |
| catalogs | object (optional) | e.g., `{ bb2026: 639 }` (hymnal number) |

## Song Categories

Categories as stored in the JSON:

| Category ID | Description |
|---|---|
| song | General congregational hymn or song |
| psalm | Responsorial psalm setting |
| mass_part | Legacy umbrella for Mass ordinary/proper parts |
| gospel_acclamation | Gospel acclamation (Alleluia / Lenten verse) |
| gospel_acclamation_refrain | Refrain portion only |

Expanded type system (in `types.ts`, for future use):

| Category | Use |
|---|---|
| antiphon | Entrance or communion antiphon |
| kyrie | Kyrie eleison |
| gloria | Gloria in Excelsis |
| sprinkling_rite | Asperges / Vidi Aquam |
| gospel_acclamation_refrain | Alleluia refrain |
| gospel_acclamation_verse | Alleluia verse |
| holy_holy | Sanctus |
| memorial_acclamation | Mystery of Faith |
| great_amen | Amen at Doxology |
| lamb_of_god | Agnus Dei |
| lords_prayer | Our Father |
| sequence | Easter / Pentecost sequence |
| mass_setting | Complete Mass ordinary set |

## Resources Structure

Each `resources` entry contains:
- `type`: audio, sheet_music, practice_track, hymnal_ref, notation, lyrics, ocp_link, youtube, other
- `source`: local, supabase, ocp_bb, ocp_ss, youtube, manual
- `label`: Display name (e.g., "Lead Sheet (AIM)", "Breaking Bread #639")
- `url` / `filePath` / `storagePath` / `value`: Location data
- `isHighlighted`: true for AIM (priority lead sheets)
- `tags`: Structured classification (e.g., ["GTR", "AIM"])
- `visibility`: "all" or "admin"

## Embeddings in Supabase

Table: `song_embeddings`
- 7,703 total vectors (more than 3,045 songs because verses are embedded separately)
- Dimension: 1536 (OpenAI text-embedding-ada-002 or equivalent)
- Used for semantic similarity scoring in recommendations

## Song Function Tags (for filtering in UI)

Songs tab filter chips:
- prelude, gathering, offertory, communion, meditation, sending, postlude

Service Music tab filter chips (by expanded category):
- kyrie, gloria, sprinkling_rite, holy_holy, memorial_acclamation, great_amen, lamb_of_god, lords_prayer, sequence

## Usage Count Ranges (for recommendations.ts familiarity logic)

| usageCount | Signal |
|---|---|
| 1–4 | Learning phase (+5 in legacy engine) |
| 5–50 | Familiar, good for recommendations (+10 in legacy engine) |
| 51–100 | Very frequently used (neutral) |
| > 100 | Overused (−5 in legacy engine) |

The current scoring.ts engine uses a separate `UsageRecord` per-ensemble tracking (2–8x this year → familiarityBoost) rather than the global `usageCount`.

## Seasonal Title Pattern Detection

The scoring engine auto-detects seasonal songs from titles even without explicit `occasions` tags. Detected titles are excluded during conflicting seasons:

| Pattern | Season |
|---|---|
| "Christmas", "Noel", "Nativity", "Silent Night", "O Holy Night", etc. | christmas |
| "O Come O Come Emmanuel", "Advent" | advent |
| "Lenten", "Ash Wednesday" | lent |
| "Easter", "Resurrection", "He Is Risen", "Christ Is Risen" | easter |
