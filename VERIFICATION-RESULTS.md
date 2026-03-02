# Verification Results — 2026-03-01

## Phase 1: Psalm Wiring
- [x] 2,660 songs in Supabase `songs` table
- [x] 218 psalm songs with category='psalm'
- [x] 1,262 Organized Psalms files linked as song_resources_v2 rows
  - 425 previously linked + 837 newly wired
  - 233 unmatched (instrumentals without psalm numbers, canticles)
- [x] Psalm resources include both Lyric Psalter and Spirit & Psalm sources
- [x] Resource labels identify psalter source (e.g., "Lyric Psalter - Choral", "Spirit & Psalm")
- [ ] 90 psalm songs still have no resources (alternative/catalog settings without matching PDFs)

## Phase 2: Community-to-Psalter Mapping
- [x] `COMMUNITY_PSALTER` mapping added to `occasion-helpers.ts`
  - Reflections, Foundations, Heritage → lyric_psalter
  - Generations, Elevations → spirit_and_psalm
- [x] `filterPsalmResourcesByCommunity()` function available for UI filtering
- [x] `getPsalterSourceFromLabel()` parses psalter source from resource labels
- [x] Build passes

## Phase 3: Supabase Storage Migration — COMPLETE
- [x] song-resources bucket created in Supabase Storage (public, 100MB limit)
- [x] **2,995 / 3,196 resources migrated (94%)**
  - 1,262 psalm resources (285MB)
  - 221 audio resources
  - 2,177 PDF/sheet music resources
- [x] 6 remaining: 5 files not found on disk (1 song: "A Rightful Place"), 1 oversized WAV (60MB)
- [x] 195 external resources (YouTube, OCP links, hymnal refs) — no storage needed
- [x] Resource URLs updated in song_resources_v2 with storage_path and public url
- [x] Source field updated to "supabase" for migrated resources
- [x] Verified: Supabase public URLs return HTTP 200 with correct content type
- [x] `resourceUrl()` updated to prioritize: url > storagePath > filePath (local fallback)
- [x] `getVisibleResources()` updated for Vercel (shows resources with url/storagePath/external)
- [x] `findPlayableResource()` updated to prefer Supabase-hosted audio
- [x] `batch-audio` endpoint updated to query song_resources_v2 with Supabase URLs
- [x] SongDetailPanel `resourceUrl()` and `isPlayableAudio` updated for storagePath
- [x] Unicode sanitization for accented filenames (NFD normalization)
- [x] Bracket sanitization for `[JTB EDIT]` style filenames

## Phase 4: Admin Edit-Everywhere Propagation
- [x] Song edit API (`PUT /api/songs/[id]`) invalidates server-side song cache
- [x] Song delete API (`DELETE /api/songs/[id]`) invalidates cache
- [x] Change log audit trail: song updates logged to `change_log` table
- [x] Build passes
- [ ] Inline editing from planner/occasion views (deferred — not blocking for Lent)

## Phase 5: Performance
- [x] Server-side 5-minute cache for song library (avoids re-fetching 2,660 songs per page load)
- [x] Cache invalidation on song create/update/delete via `invalidateSongLibraryCache()`
- [x] Build passes

## Phase 6: Full Site Verification

### Build & Deploy
- [x] `npm run build` passes (TypeScript, no errors)
- [x] Pushed to GitHub (dev branch), Vercel auto-deploy triggered
- [x] Latest Vercel deployment: Ready (Preview environment)

### Critical Path: Psalm Resources
- [x] Psalm songs have linked resources in Supabase
- [x] Resources have public Supabase Storage URLs (HTTP 200 verified)
- [x] Psalter source identifiable from resource labels

### Resource URL Resolution
- [x] Supabase URL (priority 1): Direct public URL from storage migration
- [x] StoragePath URL (priority 2): Constructed from Supabase URL + storage path
- [x] Local fallback (priority 3): `/api/music/[...path]` for dev server
- [x] Vercel filter: Only shows resources with url/storagePath/external links

### Data Integrity
- [x] Songs: 2,660 in Supabase
- [x] Resources: 3,196 in song_resources_v2
- [x] 2,995 with Supabase Storage (94% coverage)
- [x] Mass settings: 20
- [x] Recommendations: 13,230 pre-computed
- [x] Calendar days: 767
- [x] song-library.json preserved as backup

## Known Issues / Remaining Work

1. **5 missing files** — All from "A Rightful Place" (Angrisano). Song folder likely moved or renamed on disk. Not blocking.

2. **1 large audio file skipped** — "Bread of Life - Michael John Poirier.wav" (60MB) exceeds the 50MB upload limit. Consider converting to MP3 or raising the limit.

3. **90 psalm songs without resources** — These are catalog-imported alternative settings (from BB, Gather, etc.) that don't have corresponding files in Organized Psalms/. Not blocking.

4. **233 Organized Psalms files unmatched** — Mostly instrumentals without psalm numbers in filename (Ps-X) and canticles (Luke 1, Isaiah 12). Would need psalm songs created for these canticles.

5. **Community psalter filtering wired into UI** — SongDetailPanel now filters psalm resources by community psalter when viewed from occasion pages. Reflections/Foundations/Heritage see Lyric Psalter; Generations/Elevations see Spirit & Psalm.

6. **Planner inline editing** — Not implemented yet. Songs can be edited from the library detail panel but not directly from the planner grid.
