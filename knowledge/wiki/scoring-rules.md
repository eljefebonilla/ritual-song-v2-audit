# Scoring Rules

Source: `src/tools/recommendation/scoring.ts` + `src/runtime/types.ts`

## Default Weights

| Factor | Weight | Notes |
|---|---|---|
| scriptureMatch | 30 | Doubled (60) if reading type matches position's antiphon |
| functionMatch | 25 | Hard gate for structural positions (see below) |
| semanticSimilarity | 20 | pgvector cosine similarity, scaled from 0.3–1.0 range |
| topicMatch | 20 | Per topic hit, max 3 hits per song |
| seasonMatch | 15 | Per matching season or exact occasion bonus |
| userRankingBoost | 15 | Not yet wired into scoring.ts (defined in types) |
| familiarityBoost | 10 | Songs used 2–8x this year |
| recencyPenalty | 5 | Per-week penalty for songs used in last 4 weeks |

Weights live in `RuntimeConfig.recommendationWeights` and are configurable per parish.

## Position-to-Function Mapping (POSITION_FUNCTIONS)

| Position | Accepted Function Tags |
|---|---|
| gathering | gathering, entrance |
| offertory | offertory, preparation_of_gifts, preparation of the gifts |
| communion / communion1–3 | communion |
| sending | sending, recessional, closing |
| prelude | prelude, gathering, meditation |
| psalm | psalm, responsorial |
| gospelAcclamation / gospel_acclamation | gospel_acclamation, gospel acclamation |
| fractionRite / fraction_rite | fraction_rite, lamb_of_god |
| gloria | gloria |
| penitentialAct / penitential_act | penitential_act, kyrie |
| lordsPrayer / lords_prayer | lords_prayer |

Both camelCase and snake_case aliases exist for each position.

## Category Gating (POSITION_ELIGIBLE_CATEGORIES)

| Position | Allowed Categories |
|---|---|
| gathering, offertory, communion1–3, sending, prelude | song |
| psalm | psalm |
| gospelAcclamation | gospel_acclamation, gospel_acclamation_refrain |
| penitentialAct, gloria, fractionRite, lordsPrayer | song, mass_part |
| massSetting | mass_part |

Songs whose `category` field does not match are filtered out before scoring.

## Hard-Gated Positions (FUNCTION_REQUIRED_POSITIONS)

These positions require a matching function tag. Songs without the correct function tag are excluded entirely (not just penalized).

```
psalm, gospelAcclamation, gospel_acclamation,
fractionRite, fraction_rite,
gloria,
lordsPrayer, lords_prayer,
penitentialAct, penitential_act
```

## Psalm Hard Gate

For `psalm` and `responsorialPsalm` positions, the system extracts the psalm number from the reading citation (e.g., "Ps 122" → 122) and only shows settings of that specific psalm. This enforces the lectionary's prescribed responsorial psalm.

## Antiphon Bonus (POSITION_ANTIPHON)

When a song's NPM scripture mapping matches the position's canonical antiphon type, the scriptureMatch weight is doubled.

| Position | Antiphon Type |
|---|---|
| gathering | entrance_antiphon |
| communion / communion1–3 | communion_antiphon |

## Function Mismatch Penalty

If a song has a function tag but it does NOT match the current position, a penalty of `functionMatch × 0.6` (rounded) is subtracted.

## Recency Penalty Logic

```
if weeksSinceUsed < 4:
  penalty = recencyPenalty × (4 - weeksSinceUsed)
```

A song used 1 week ago loses `recencyPenalty × 3` points. A song used 3 weeks ago loses `recencyPenalty × 1` point.

## Familiarity Boost Logic

Songs used 2–8 times this year receive `familiarityBoost` points. Songs used fewer than 2 or more than 8 times do not receive the boost.

## Semantic Similarity Scaling

```
if similarity > 0.3:
  scale = min(1, (similarity - 0.3) / 0.5)
  pts = round(semanticSimilarity × scale)
```

Similarity below 0.3 is ignored. Similarity of 0.8+ gets full weight.

## Catalog Baseline

Untagged songs with score = 0 receive a baseline of 3 points to remain visible.

## Season Conflict Filtering

Songs tagged with occasion IDs from conflicting major seasons are excluded before scoring. Seasonal title patterns (e.g., "Silent Night", "O Come O Come Emmanuel") also trigger exclusion when the current season conflicts.

Season groupings used for conflict detection:
- advent → advent
- christmas, holy-family, baptism-of-the-lord, the-epiphany → christmas
- lent, palm-sunday → lent
- easter, pentecost, ascension → easter
- ordinary-time-* → ordinary

## Reason Types

| Type | Explanation Template |
|---|---|
| scripture_match | "This song draws directly from [reading]. The assembly will hear these words proclaimed and then sing them." |
| topic_match | "The theme of '[topic]' in today's readings resonates with this song's message." |
| season_match | "Well-suited for [season]. Using seasonal music helps the assembly enter into the liturgical time." |
| function_match | "Written as a [function] song. The music and text are composed for this moment in the liturgy." |
| familiarity | "Your community knows this song ([usage]). Familiar songs encourage full, active participation." |
| recency_penalty | "[usage detail]. Rotating songs prevents fatigue while building repertoire." |
| semantic_similarity | "This song's lyrics echo the themes and language of today's readings ([pct]% thematic match)." |
