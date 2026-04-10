# Ensemble Structure

Source: `src/lib/grid-types.ts`, `src/lib/types.ts`, `src/lib/calendar-utils.ts`

## The 5 Ensembles

St. Monica has five music communities, each with its own weekly Mass and music planning:

| ID | Display Name | Color (UI) | Character |
|---|---|---|---|
| reflections | Reflections | bg #f1f4f6 / text #5a6a78 | Gray-blue |
| foundations | Foundations | bg #f5e9e5 / text #8b6b5a | Warm brown |
| generations | Generations | bg #fff8da / text #8a7a3a | Gold/yellow |
| heritage | Heritage | bg #eef1eb / text #5a6b54 | Green |
| elevations | Elevations | bg #eeebf6 / text #6b5a8a | Purple |

```typescript
type EnsembleId = "reflections" | "foundations" | "generations" | "heritage" | "elevations"
```

## Psalm Book Assignments

Different ensembles use different psalm settings:
- **Lyric Psalter:** serves Reflections, Foundations, Heritage
- **Spirit & Psalm:** serves Generations, Elevations

(Source: `src/lib/occasion-helpers.ts`)

## Music Plan per Occasion

Each occasion file (`src/data/occasions/*.json`) contains a `musicPlans` array — one plan per ensemble. A `MusicPlan` object contains:

| Field | Type | Notes |
|---|---|---|
| ensemble | string | Display name ("Reflections") |
| ensembleId | string | Slug ("reflections") |
| date | string (optional) | ISO date for this specific performance |
| presider | string (optional) | Celebrant's name |
| massNotes | string[] | Director notes for this Mass |
| prelude | SongEntry | Song before Mass begins |
| gathering | SongEntry | Entrance procession |
| sprinklingRite | SongEntry | Easter season only |
| penitentialAct | SongEntry | Kyrie/penitential song |
| gloria | SongEntry | Gloria setting |
| responsorialPsalm | object | `{ psalm, setting, youtubeUrl }` |
| gospelAcclamation | SongEntry + verse | Alleluia + verse text |
| offertory | SongEntry | Preparation of gifts |
| eucharisticAcclamations | object | Mass setting name + composer |
| lordsPrayer | SongEntry | Our Father |
| fractionRite | SongEntry | Lamb of God |
| communionSongs | SongEntry[] | Array of communion songs (1–4) |
| sending | SongEntry | Recessional |

## SongEntry Fields

```typescript
interface SongEntry {
  title: string;
  composer?: string;
  description?: string;
  youtubeUrl?: string;
}
```

## Mass Events in Supabase

The `mass_events` table tracks actual scheduled performances:
- `id`, `title` (liturgical name), `event_date`, `start_time_12h`
- `ensemble` — string matching ensemble display name
- `occasion_id` — links to occasions data
- `season` — liturgical season

Linked tables: `setlists` (per-ensemble song selections), `choir_signups`.

## Grid View

The Planner grid shows all occasions as columns and positions as rows, with cells for each ensemble's song at each position. The `YearCycleFilter` allows filtering by cycle A/B/C or all.

## Custom Slots

Ensembles can add custom slots (non-standard positions) via `custom_slots` table fields:
- `ensembleId`, `slotType`, `label`, `orderPosition`, `content`

## Ensemble in Recommendations

When requesting recommendations, the ensemble context can affect:
1. Which psalm book is preferred (Lyric Psalter vs. Spirit & Psalm)
2. Which songs the ensemble has used recently (per-ensemble usage tracking)
3. Which songs the ensemble has ranked/hidden

The `RecommendationRequest` currently does not include an ensemble field — ensemble filtering is handled at the calling layer before candidates are passed to `rankSongs()`.
