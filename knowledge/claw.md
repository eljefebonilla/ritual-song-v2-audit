# CLAW — Context-Loading Anchor Words

When an LLM session encounters any of these terms, it should look up the associated wiki page before answering.

## Scoring & Recommendations

| Term | Wiki Page |
|---|---|
| recommendation, score, scoring, rank | scoring-rules.md |
| scripture match, NPM mapping, scriptureRefs | scripture-matching.md |
| function match, hard gate, category gate | scoring-rules.md |
| recency penalty, familiarity boost | scoring-rules.md |
| semantic similarity, pgvector, embedding | scoring-rules.md, song-library.md |
| weight, weights, configurable | scoring-rules.md |
| antiphon bonus, entrance antiphon, communion antiphon | scripture-matching.md |

## Positions & Mass Structure

| Term | Wiki Page |
|---|---|
| position, gathering, offertory, communion, sending | liturgical-positions.md |
| psalm, responsorial psalm, gospel acclamation | liturgical-positions.md |
| penitential act, gloria, fraction rite, lamb of god | liturgical-positions.md |
| lord's prayer, mass setting, prelude | liturgical-positions.md |
| sprinkling rite | liturgical-positions.md |
| hard-gated, function required | liturgical-positions.md, scoring-rules.md |

## Seasons & Occasions

| Term | Wiki Page |
|---|---|
| season, advent, christmas, lent, holy week, easter, ordinary time | seasons-and-cycles.md |
| solemnity, feast | seasons-and-cycles.md |
| cycle A, cycle B, cycle C, lectionary year | seasons-and-cycles.md |
| occasion ID, occasion file | seasons-and-cycles.md |
| season conflict, seasonal exclusion | scoring-rules.md |

## Song Library

| Term | Wiki Page |
|---|---|
| song library, 3045 songs | song-library.md |
| category, mass_part, psalm (category), gospel_acclamation | song-library.md |
| topics, scriptureRefs, functions, liturgicalUse | song-library.md |
| usageCount, usage record | song-library.md |
| lead sheet, AIM, Breaking Bread, OCP | song-library.md |
| hymnal ref, BB2026 | song-library.md |
| reprint, worship aid, OCP | song-library.md (resources) |

## Ensembles

| Term | Wiki Page |
|---|---|
| ensemble, reflections, foundations, generations, heritage, elevations | ensemble-structure.md |
| music plan, MusicPlan | ensemble-structure.md |
| Lyric Psalter, Spirit & Psalm | ensemble-structure.md |

## Pipeline & Tools

| Term | Wiki Page |
|---|---|
| recommendation pipeline, rankSongs, scoreSong | recommendation-pipeline.md |
| tool server, createRecommendationTools | recommendation-pipeline.md |
| RuntimeContext, RuntimeConfig | recommendation-pipeline.md |
| legacy engine, recommendations.ts | recommendation-pipeline.md |
| ScoredSong, RecommendationRequest | recommendation-pipeline.md |

## Scripture Parsing

| Term | Wiki Page |
|---|---|
| parseCitation, citation parsing | scripture-matching.md |
| psalm number, extractPsalmNumber | scripture-matching.md |
| USCCB citation, date index | scripture-matching.md |
| reading type, first reading, gospel | scripture-matching.md |
