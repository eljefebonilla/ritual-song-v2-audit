# Scripture Matching

Source: `src/lib/scripture-matching.ts`, `src/tools/recommendation/scoring.ts`

## Two Scripture Matching Systems

The app uses two separate systems for scripture matching, applied in priority order:

### 1. NPM Scripture Mappings (Primary)
Stored in Supabase table `scripture_song_mappings`. Contains 7,715 song-to-reading mappings scraped from NPM Liturgy Help, covering a 3-year lectionary cycle.

Fields per mapping:
- `songTitle` — the song name
- `legacyId` — the song's library ID
- `readingType` — one of the types below
- `readingReference` — the scripture citation (e.g., "Psalm 122:1–2")
- `matchedVerseLabel` — verse number or "Refrain"
- `matchedVerseExcerpt` — text snippet confirming the match

Reading types in the NPM data:
| Type | Meaning |
|---|---|
| entrance_antiphon | Matches the Entrance Antiphon |
| first_reading | Matches the First Reading |
| second_reading | Matches the Second Reading |
| sequence | Matches the Sequence (rare) |
| gospel | Matches the Gospel |
| communion_antiphon | Matches the Communion Antiphon |

When NPM data is present for a song, it takes priority over the song's own `scriptureRefs` field. Only one `scripture_match` reason is attached per song.

### 2. Song scriptureRefs (Fallback)
Each song in the library can have a `scriptureRefs` array (e.g., `["Matthew 12:40", "1 Corinthians 15:37"]`). Matching is done at the **book + chapter level** (not verse).

```
parseCitation("Mt 4:1-11") → { book: "matt", chapter: 4 }
parseCitation("Isaiah 43:2-3") → { book: "isa", chapter: 43 }

scriptureMatch(songRef, readingCitation):
  return songParsed.book === readParsed.book
      && songParsed.chapter === readParsed.chapter
```

1,107 songs in the library have `scriptureRefs` populated (as of wiki init).

## Position-Aware Antiphon Bonus

When the NPM mapping's `readingType` matches the position's canonical antiphon type, the score is doubled:

| Position | Canonical Antiphon Type |
|---|---|
| gathering | entrance_antiphon |
| communion / communion1–3 | communion_antiphon |

Example: a song matched to `entrance_antiphon` in a `gathering` slot gets `scriptureMatch × 2` = 60 points instead of 30.

## Best Match Selection

When a song has multiple NPM mappings for an occasion, the engine selects the "best" match in this priority:
1. Reading type matches position's antiphon AND has a verse excerpt
2. Reading type matches position's antiphon (no verse excerpt)
3. Any mapping with a verse excerpt
4. First mapping in the array

## Psalm Number Extraction

For `psalm` and `responsorialPsalm` positions, the prescribed psalm is extracted from reading citations:

```
extractPsalmNumber("Ps 122:1-2, 3-4") → 122
```

The engine then calls `extractPsalmNumberFromTitle(song.title)` on each candidate and excludes any song whose psalm number doesn't match. This enforces lectionary compliance: music directors choose a **setting of the prescribed psalm**, not any psalm.

## Citation Parsing

The `parseCitation()` function normalizes citations through a canonical book name map with 100+ variants:
- "Mt" → "matt"
- "Mk" → "mark"
- "Lk" → "luke"
- "Jn" → "john"
- "Is" → "isa"
- "Ps" → "ps"
- "Rv" → "rev"
- "1 Cor" → "1cor"
- "Song of Songs" → "song"

USCCB-format citations (slash-delimited, with lectionary number suffix) are parsed via `parseUSCCBCitations()`.

## Reading Types in Occasion Data

Each occasion's `readings` array uses these types:
- `first` — First Reading
- `psalm` — Responsorial Psalm
- `second` — Second Reading
- `gospel_verse` — Gospel Acclamation verse (Alleluia verse)
- `gospel` — Gospel
- `custom` — Non-standard additions

## Data Sources

- NPM mappings: Supabase `scripture_song_mappings` table
- Song scriptureRefs: `src/data/song-library.json` (per-song array)
- Occasion readings: `src/data/occasions/*.json` (375 files)
- Synopses with citations: `src/data/lectionary-synopses.json`
- USCCB citation fallback: `src/data/usccb-2026.json`, `usccb-2027.json`
- Date-to-occasion index: `src/data/date-index.json`
