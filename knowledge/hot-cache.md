# Hot Cache — Frequently Accessed Facts

Quick-reference for common queries. No lookups needed.

## Core Numbers

| Fact | Value |
|---|---|
| Total songs | 3,045 |
| Total occasion files | 375 |
| Total ensembles | 5 |
| Song embeddings (pgvector) | 7,703 |
| NPM scripture mappings | 7,715 |
| Songs with topics | 1,372 |
| Songs with scriptureRefs | 1,107 |

## Default Weights (copy-paste ready)

```json
{
  "scriptureMatch": 30,
  "topicMatch": 20,
  "seasonMatch": 15,
  "functionMatch": 25,
  "recencyPenalty": 5,
  "familiarityBoost": 10,
  "userRankingBoost": 15,
  "semanticSimilarity": 20
}
```

## Position → Function Tags (compact)

| Position | Function Tags |
|---|---|
| gathering | gathering, entrance |
| offertory | offertory, preparation_of_gifts |
| communion/1/2/3 | communion |
| sending | sending, recessional, closing |
| prelude | prelude, gathering, meditation |
| psalm | psalm, responsorial |
| gospelAcclamation | gospel_acclamation, gospel acclamation |
| fractionRite | fraction_rite, lamb_of_god |
| gloria | gloria |
| penitentialAct | penitential_act, kyrie |
| lordsPrayer | lords_prayer |

## Hard-Gated Positions (function tag required, no exceptions)

```
psalm, gospelAcclamation, gospel_acclamation,
fractionRite, fraction_rite,
gloria,
lordsPrayer, lords_prayer,
penitentialAct, penitential_act
```

Note: `psalm` position has an additional hard gate — only settings of the specific prescribed psalm number appear.

## Position → Category Gate

| Position | Allowed Categories |
|---|---|
| gathering, offertory, communion*, sending, prelude | song |
| psalm | psalm |
| gospelAcclamation | gospel_acclamation, gospel_acclamation_refrain |
| penitentialAct, gloria, fractionRite, lordsPrayer | song, mass_part |
| massSetting | mass_part |

## Antiphon Bonus

- gathering → entrance_antiphon match → scriptureMatch × 2 (60 pts)
- communion/* → communion_antiphon match → scriptureMatch × 2 (60 pts)

## Ensembles

| ID | Label | Psalm Book |
|---|---|---|
| reflections | Reflections | Lyric Psalter |
| foundations | Foundations | Lyric Psalter |
| generations | Generations | Spirit & Psalm |
| heritage | Heritage | Lyric Psalter |
| elevations | Elevations | Spirit & Psalm |

## Seasons

- Cycles: A (2025–26, 2028–29), B (2026–27, 2029–30), C (2024–25, 2027–28)
- Seasons: advent, christmas, lent, holyweek, easter, ordinary, solemnity, feast

## Key File Paths

| Resource | Path |
|---|---|
| Song library | src/data/song-library.json |
| Occasions | src/data/occasions/*.json (375 files) |
| Scoring engine | src/tools/recommendation/scoring.ts |
| Legacy engine | src/lib/recommendations.ts |
| Types | src/runtime/types.ts |
| Scripture matching | src/lib/scripture-matching.ts |
| Wiki query tool | src/tools/wiki/index.ts |

## Song Categories in JSON

Current categories in song-library.json: `song`, `psalm`, `mass_part`, `gospel_acclamation`, `gospel_acclamation_refrain`
