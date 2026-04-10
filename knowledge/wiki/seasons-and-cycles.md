# Seasons and Cycles

Source: `src/lib/types.ts`, `src/tools/recommendation/scoring.ts`, `src/data/occasions/`

## Liturgical Year Cycles

The Roman Rite rotates through three annual lectionary cycles:

| Cycle | Years (recent/upcoming) |
|---|---|
| A | 2025–2026, 2028–2029 |
| B | 2026–2027, 2029–2030 |
| C | 2024–2025, 2027–2028 |

Some occasions are cycle-independent (marked `ABC`), such as Easter Sunday and solemnities that always use the same readings.

## Liturgical Seasons

```typescript
type LiturgicalSeason =
  | "advent" | "christmas" | "lent" | "holyweek"
  | "easter" | "ordinary" | "solemnity" | "feast" | "holiday"
```

| Season | ID | seasonLabel | Notes |
|---|---|---|---|
| Advent | advent | Advent | 4 Sundays before Christmas |
| Christmas | christmas | Christmas | Christmas Day through Baptism of the Lord |
| Lent | lent | Lent | Ash Wednesday through Palm Sunday |
| Holy Week | holyweek | Holy Week | Palm Sunday through Holy Saturday |
| Easter | easter | Easter | Easter Sunday through Pentecost (50 days) |
| Ordinary Time | ordinary | Ordinary Time | ~34 Sundays; two periods each year |
| Solemnity | solemnity | Solemnity | Fixed-date celebrations (Trinity, Body of Christ, etc.) |
| Feast | feast | Feast | Secondary celebrations (patron saints, etc.) |
| Holiday | holiday | Holiday | Civic/special occasions |

## Occasion ID Format

Occasion IDs follow the pattern `{season}-{number}-{cycle}`:
- `advent-01-a` — First Sunday of Advent, Year A
- `ordinary-time-23-b` — 23rd Sunday of Ordinary Time, Year B
- `easter-sunday-abc` — Easter Sunday (all cycles)
- `lent-01-c` — First Sunday of Lent, Year C
- `solemnity-most-holy-trinity-a`
- `christmas-midnight-abc`

## Season Prefixes (for scoring engine conflict detection)

| Occasion ID starts with | Maps to season |
|---|---|
| advent | advent |
| christmas, holy-family, baptism-of-the-lord, the-epiphany, 2nd-sun-after-christmas | christmas |
| lent, palm-sunday | lent |
| easter, pentecost, ascension | easter |
| ordinary-time | ordinary |

Songs tagged for one major season are excluded when the current occasion is in a different major season.

## 375 Occasion Files

Location: `src/data/occasions/*.json`

Each file contains:
- `id`, `name`, `year`, `season`, `seasonLabel`, `seasonOrder`
- `dates[]` — all past/future dates for that occasion (multi-year)
- `lectionary` — number, gospelTitle, thematicTag
- `readings[]` — first, psalm, second, gospel_verse, gospel
- `antiphons[]` — entrance and communion antiphons (option 1 and 2)
- `planningNotes[]` — liturgy-specific director notes
- `occasionResources[]` — sheet music, audio, YouTube links
- `musicPlans[]` — one plan per ensemble (gathering, offertory, communion1–4, sending, psalm, etc.)

## Season Ordering

Within `seasons.json`, occasions are grouped by season and sorted by `seasonOrder`. This governs display order in the Planner grid and adjacent-occasion recency detection.

## Liturgical Color Reference

| Season | Color |
|---|---|
| Advent | Purple/Violet |
| Christmas | White/Gold |
| Lent | Purple |
| Holy Week | Red (Palm Sunday), Black (Good Friday) |
| Easter | White/Gold |
| Ordinary Time | Green |
| Solemnities | White/Gold |
| Martyrs' feasts | Red |

## Season-to-Liturgical-Use Tag Mapping (recommendations.ts)

The legacy engine maps seasons to `liturgicalUse` tags:

| Season | Accepted liturgicalUse tags |
|---|---|
| advent | advent |
| christmas | christmas, nativity |
| lent | lent, lenten |
| holyweek | triduum, holy week, paschal, easter |
| easter | easter, paschal |
| ordinary | ordinary time, ordinary |
| solemnity | solemnity |
| feast | feast |
