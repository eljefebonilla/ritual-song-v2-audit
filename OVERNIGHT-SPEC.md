# Overnight Spec: Intelligent Music Planning System

## Context — What We Just Built

We extracted and merged publisher indexes from 3 hymnals into the song library:

### Data Now Available on Songs
- **scriptureRefs**: Array of scripture references (e.g., `["Isaiah 43:2-3", "Matthew 5:3-4,10"]`) — 615 songs (27% of songs)
- **topics**: Array of topical tags (e.g., `["Comfort", "Healing", "Hope"]`) — 892 songs (39% of songs)
- **catalogs**: Existing catalog numbers for bb2026, gather4, novum, aahh, voices, spiritandsong

### Data Sources Already Wired
- `usccb-2026.json` — USCCB calendar with citations per day
- `date-index.json` — Maps dates to occasion IDs
- `lectionary-synopses.json` — 194 occasion synopses with individual reading citations
- `scripture-matching.ts` — Has getReadingsForDate(), getCitationsForSubFilter(), scriptureMatch()
- `recommendations.ts` — Has parseCitation() and scriptureMatch() for chapter-level matching
- Scripture Match UI in LibraryFilters.tsx — toggle + sub-filter radios

### Existing Architecture
- **SongLibraryShell.tsx** — Main library shell with filter pipeline
- **LibraryFilters.tsx** — Left sidebar filters (Calendar, Ensemble, Season, Genre, Resources)
- **SongCard.tsx** — Song cards in library grid
- **SongDetailPanel.tsx** — Song detail slide-out panel
- **LiturgicalCalendar.tsx** — Mini calendar with season coloring

### File Locations
- App root: `/Users/jeffreybonilla/Dropbox/RITUALSONG/ritualsong-app/`
- Songs: `src/data/song-library.json`
- Scripture matching: `src/lib/scripture-matching.ts`
- Recommendations: `src/lib/recommendations.ts`
- Library shell: `src/components/library/SongLibraryShell.tsx`
- Library filters: `src/components/library/LibraryFilters.tsx`
- Song card: `src/components/library/SongCard.tsx`
- Song detail: `src/components/library/SongDetailPanel.tsx`

---

## Objective

Build an intelligent music planning system that leverages ALL data (scripture refs, topics, lectionary data, liturgical seasons) to make the Music Library dramatically more useful.

---

## Phase 1: Fix & Enhance Scripture Match Filter

The Scripture Match filter exists in the UI but needs to work correctly with new data.

### Steps:
1. Read scripture-matching.ts and verify it handles USCCB abbreviations (Is, Mt, Jas) vs full names (Isaiah, Matthew, James)
2. Read SongLibraryShell.tsx and verify the scripture match filtering pipeline
3. Test: selecting a date + Scripture Match ON should show matching songs
4. Add "Psalm" sub-filter alongside existing All/1st/2nd/Gospel

### Done When:
- Dec 14 (Nm 24/Mt 21) with Scripture Match shows matches
- 3rd Sunday of Advent (Is 35/Mt 11) shows Isaiah 35 and Matthew 11 matches
- Sub-filters correctly narrow to specific readings
- TypeScript compiles clean

---

## Phase 2: Topic-Based Smart Filtering

### Steps:
1. Extract unique topics from songs, group into categories (Liturgical, Sacramental, Thematic, Functional)
2. Add "Topics" collapsible section to LibraryFilters after Genre
3. Implement multi-select topic filtering (OR logic)
4. Show topic count badges per option
5. Add topic pills to SongCard

### Done When:
- Topics section in filters with categorized groups
- Multi-select works as OR filter
- Song cards show topic badges
- Build passes

---

## Phase 3: Smart Recommendations Panel

### Steps:
1. Create SmartRecommendations.tsx component
2. When date selected: get readings, find scripture matches, find topic matches, score/rank
3. Display grouped by "Scripture Matches", "Thematic Matches", "Season Picks"
4. Show WHY each was recommended
5. Integrate into SongLibraryShell

### Done When:
- Selecting a Sunday shows recommendations panel
- Songs scored and ranked by relevance
- Match reasons displayed
- Build passes

---

## Phase 4: Scripture & Topic Display on Song Cards

### Steps:
1. Add scripture refs section to SongDetailPanel
2. Show topic pills on song cards
3. When Scripture Match active, highlight matching refs
4. Show "Matches: Isaiah 35:1-6" badges on matching cards

### Done When:
- Detail panel shows all scripture refs and topics
- Cards show topic pills
- Scripture match highlights working
- Build passes

---

## Phase 5: Topic-Aware Search

### Steps:
1. In search, include topic-matched songs when query matches a topic name
2. Add "Search by topic" hint in placeholder
3. Searching "Isaiah 35" shows songs with that ref
4. Show topic suggestion chips

### Done When:
- "comfort" search shows Comfort-tagged songs
- "Isaiah 35" shows songs with that ref
- Build passes

---

## Constraints

| Must | TypeScript compiles, build passes, existing features unbroken |
| Must | Use existing UI patterns (Tailwind, stone palette) |
| Must | Preserve existing Scripture Match toggle |
| Must | Bump version before each commit |
| Must Not | Modify song-library.json structure |
| Must Not | Add npm dependencies |
| Must Not | Break existing filter pipeline |
| Prefer | Simple focused components |
| Prefer | Read existing code first |
| Prefer | Clean, information-dense UI |

---

## Execution

Ralph loop — Phase 1 first, then 2-5 sequentially. After each phase:
```bash
cd /Users/jeffreybonilla/Dropbox/RITUALSONG/ritualsong-app
npx tsc --noEmit && npm run build
npm version patch --no-git-tag-version
git add -A && git commit -m "feat: [phase description]"
```
Push after all phases pass: `git push origin main`
