# RITUAL SONG V2 — OVERNIGHT BUILD SPECIFICATION

> **Purpose:** This is a self-contained specification for an autonomous overnight agent session. Execute phases in order. Do not stop for human input. If a phase fails to build, fix it before proceeding. Run `npm run build` after every phase.

---

## CONTEXT

**Project:** `/Users/jeffreybonilla/Dropbox/RITUALSONG/ritualsong-app/`
**Stack:** Next.js 16.1.6, React 19.2.3, TypeScript 5, Tailwind CSS v4, Supabase (auth + DB + storage)
**Deploy:** Vercel (auto-deploy from GitHub `eljefebonilla/stmonica-music-ministry`)
**Env vars (already set):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_ACCESS_CODE`

### Current State

**Data layer:** Song library lives in `src/data/song-library.json` (2,660 entries). Occasions live in `src/data/occasions/*.json` (~300 files). Calendar events in Supabase `mass_events` table. Liturgical days in Supabase `liturgical_days` table.

**Song categories (current — 4 values):** `song` (2,248), `psalm` (218), `mass_part` (118), `gospel_acclamation` (76). Auto-classified by regex in `src/lib/song-library.ts:classifySong()`.

**Supabase tables (21 existing):** profiles, emergency_contacts, compliance_types, compliance_records, mass_events, ministry_roles, mass_role_slots, signups, announcements, comments, booking_slots, choir_signups, mass_comments, setlists, song_resources, song_merge_decisions, song_metadata, liturgical_days, liturgical_day_readings, saints, app_settings.

**Supabase client patterns (3):**
- Browser: `src/lib/supabase/client.ts` — `createBrowserClient(url, anon_key)`
- Server: `src/lib/supabase/server.ts` — `createServerClient(url, anon_key, {cookies})`
- Admin: `src/lib/supabase/admin.ts` — `createClient(url, service_role_key)` — bypasses RLS

**Key files to read for implementation context:**
- Types: `src/lib/types.ts` (LibrarySong, MusicPlan, LiturgicalOccasion, SongCategory, etc.)
- Grid: `src/lib/grid-types.ts` (GRID_ROW_KEYS, MASS_SETTING_SUB_ROWS, GridColumn, etc.)
- Song utils: `src/lib/song-library.ts` (getSongLibrary, classifySong, resolveAllSongs, etc.)
- Data loaders: `src/lib/data.ts` (getOccasion, getAllFullOccasions, getSynopsis, etc.)
- Occasion helpers: `src/lib/occasion-helpers.ts` (COMMUNITY_BADGES, MASS_POSITION_ORDER, normalizeTitle)
- Calendar: `src/lib/calendar-utils.ts`, `src/lib/calendar-types.ts`
- Booking: `src/lib/booking-types.ts` (SetlistSongRow, SetlistPersonnel, Setlist)
- Song library UI: `src/components/library/SongLibraryShell.tsx`, `LibraryFilters.tsx`
- Calendar UI: `src/components/calendar/CalendarShell.tsx`
- Planner UI: `src/components/planner/PlannerShell.tsx`, `PlannerGrid.tsx`
- SQL migrations: `sql/schema.sql`, `sql/001_*` through `sql/006_*`

### Target State

A Supabase-backed app with:
1. Songs in Supabase with 14-value expanded taxonomy
2. Mass settings as grouped collections of individually-playable pieces
3. Full admin CRUD with edit propagation to backlinked references
4. Modern calendar showing every liturgical day with colors, ordo, editing, recurring events
5. Song recommendations matching readings/tags/season, prioritizing Lent/Triduum/Easter
6. Song hiding + per-admin ranking (1-5 stars)
7. Rich editable metadata panel showing all enrichment fields
8. Psalm 1-150 horizontal number picker
9. 5 library tabs: Songs, Mass Parts, Psalms, Gospel Acclamations, Antiphons

---

## CONSTRAINT ARCHITECTURE

| Category | Constraint |
|----------|-----------|
| **Must** | Maintain viewport-locked layout: `html,body {height:100%;overflow:hidden}`, AppShell wraps `div.h-screen.overflow-hidden` with `main.h-full.overflow-auto.md:ml-64` |
| **Must** | Use existing Supabase project via env vars. Use `createAdminClient()` for server-side writes and `export const dynamic = "force-dynamic"` on any page that queries Supabase |
| **Must** | Maintain parish brand: parish-gold `#CA8A04`, parish-burgundy, Tailwind v4, existing season color classes (bg-advent, bg-lent, etc.) |
| **Must** | Keep `song-library.json` as backup. Do not delete it. New code reads from Supabase but the JSON stays |
| **Must** | Keep static occasion JSON files (`src/data/occasions/*.json`) as source for readings/antiphons/planningNotes. These do NOT move to Supabase yet |
| **Must** | Run `npm run build` after each phase. Fix any errors before proceeding |
| **Must** | RLS pattern: `auth.role() = 'authenticated'` for SELECT. Admin check via profiles.role for INSERT/UPDATE/DELETE. Service role for migrations |
| **Must Not** | Break existing auth flow (access code gate `/gate` + Supabase auth) |
| **Must Not** | Break the media player (`src/components/music/MediaPlayer.tsx`) or audio playback |
| **Must Not** | Remove existing API routes — other code may depend on them |
| **Must Not** | Create a separate database or project — use the existing Supabase instance |
| **Prefer** | Server Components for data fetching. Client Components only for interactivity |
| **Prefer** | Incremental migration: create new alongside old, swap reads one at a time, verify each |
| **Prefer** | Match existing code patterns (see how `CalendarShell`, `SongLibraryShell`, `SetlistShell` work) |
| **Escalate** | If Supabase SQL execution fails, write the SQL to `sql/007_songs_migration.sql` and document what needs manual execution. Continue with the next phase using mock data if needed |
| **Escalate** | If a build fails and you cannot fix it within 15 minutes of debugging, revert the phase changes and document what went wrong in a `PHASE_N_BLOCKED.md` file, then proceed to the next independent phase |

---

## PHASE 1: DATABASE FOUNDATION

**Deliverable:** New Supabase tables for songs, resources, mass settings, rankings, visibility. All 2,660 songs migrated and reclassified into 14 categories. Mass settings identified and linked.

**Inputs:** `src/data/song-library.json`, existing Supabase instance, `sql/` migration files for pattern reference.

**Steps:**

1. **Create migration file** `sql/007_songs_migration.sql` with these tables:

```sql
-- Expanded song category enum
CREATE TYPE song_category AS ENUM (
  'song', 'antiphon', 'kyrie', 'gloria', 'sprinkling_rite',
  'psalm', 'gospel_acclamation_refrain', 'gospel_acclamation_verse',
  'holy_holy', 'memorial_acclamation', 'great_amen',
  'lamb_of_god', 'lords_prayer', 'sequence'
);

-- Mass Settings (parent groups)
CREATE TABLE mass_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  composer TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs (replaces song-library.json reads)
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  composer TEXT,
  category song_category NOT NULL DEFAULT 'song',
  psalm_number INT,
  mass_setting_id UUID REFERENCES mass_settings(id),
  functions TEXT[] DEFAULT '{}',
  recorded_key TEXT,
  first_line TEXT,
  refrain_first_line TEXT,
  languages TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  scripture_refs TEXT[] DEFAULT '{}',
  liturgical_use TEXT[] DEFAULT '{}',
  catalogs JSONB DEFAULT '{}',
  credits JSONB DEFAULT '{}',
  tune_meter JSONB DEFAULT '{}',
  usage_count INT DEFAULT 0,
  occasions TEXT[] DEFAULT '{}',
  is_hidden_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song Resources (migrated from JSON resources arrays)
CREATE TABLE song_resources_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  url TEXT,
  file_path TEXT,
  storage_path TEXT,
  value TEXT,
  source TEXT,
  is_highlighted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-admin song rankings
CREATE TABLE song_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking INT NOT NULL CHECK (ranking BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);

-- Per-admin song visibility
CREATE TABLE song_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(song_id, user_id)
);

-- Calendar days (full liturgical + civil calendar)
CREATE TABLE calendar_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  liturgical_day_name TEXT,
  celebration_rank TEXT,
  liturgical_color TEXT,
  season TEXT,
  ordo_notes TEXT,
  is_holy_day BOOLEAN DEFAULT FALSE,
  is_holiday BOOLEAN DEFAULT FALSE,
  holiday_name TEXT,
  occasion_id TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT,
  custom_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Song recommendations cache
CREATE TABLE song_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id TEXT NOT NULL,
  position TEXT NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  score FLOAT NOT NULL DEFAULT 0,
  match_reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_songs_category ON songs(category);
CREATE INDEX idx_songs_mass_setting ON songs(mass_setting_id);
CREATE INDEX idx_songs_psalm_number ON songs(psalm_number);
CREATE INDEX idx_songs_legacy_id ON songs(legacy_id);
CREATE INDEX idx_song_resources_v2_song ON song_resources_v2(song_id);
CREATE INDEX idx_song_rankings_song ON song_rankings(song_id);
CREATE INDEX idx_song_rankings_user ON song_rankings(user_id);
CREATE INDEX idx_song_visibility_song ON song_visibility(song_id);
CREATE INDEX idx_calendar_days_date ON calendar_days(date);
CREATE INDEX idx_calendar_days_occasion ON calendar_days(occasion_id);
CREATE INDEX idx_song_recommendations_occasion ON song_recommendations(occasion_id, position);

-- RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_resources_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_recommendations ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated
CREATE POLICY "songs_select" ON songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_resources_v2_select" ON song_resources_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "mass_settings_select" ON mass_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_rankings_select" ON song_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_visibility_select" ON song_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_days_select" ON calendar_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_recommendations_select" ON song_recommendations FOR SELECT TO authenticated USING (true);

-- Write: admin only (songs, resources, mass_settings, calendar_days, recommendations)
CREATE POLICY "songs_admin_insert" ON songs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "songs_admin_update" ON songs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "songs_admin_delete" ON songs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "song_resources_v2_admin_insert" ON song_resources_v2 FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "song_resources_v2_admin_update" ON song_resources_v2 FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "song_resources_v2_admin_delete" ON song_resources_v2 FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "mass_settings_admin_all" ON mass_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "calendar_days_admin_all" ON calendar_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "song_recommendations_admin_all" ON song_recommendations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Write: own rankings and visibility
CREATE POLICY "song_rankings_own_insert" ON song_rankings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "song_rankings_own_update" ON song_rankings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "song_rankings_own_delete" ON song_rankings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "song_visibility_own_insert" ON song_visibility FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "song_visibility_own_update" ON song_visibility FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "song_visibility_own_delete" ON song_visibility FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role for bulk operations
CREATE POLICY "songs_service" ON songs FOR ALL TO service_role USING (true);
CREATE POLICY "song_resources_v2_service" ON song_resources_v2 FOR ALL TO service_role USING (true);
CREATE POLICY "mass_settings_service" ON mass_settings FOR ALL TO service_role USING (true);
CREATE POLICY "calendar_days_service" ON calendar_days FOR ALL TO service_role USING (true);
CREATE POLICY "song_recommendations_service" ON song_recommendations FOR ALL TO service_role USING (true);

-- Updated_at triggers
CREATE TRIGGER songs_updated_at BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER song_rankings_updated_at BEFORE UPDATE ON song_rankings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER calendar_days_updated_at BEFORE UPDATE ON calendar_days
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

2. **Execute the migration.** Write a Node.js script `scripts/migrate-songs.ts` that:
   - Reads the SQL file
   - Executes it via the admin client using `.rpc()` or the Supabase Management API
   - If direct SQL execution isn't available, split into individual CREATE TABLE statements and use the REST API
   - Alternative: use `fetch` against the Supabase SQL endpoint: `POST ${SUPABASE_URL}/rest/v1/rpc` with the service role key

3. **Write the data migration script** `scripts/seed-songs-to-supabase.ts`:
   - Read `src/data/song-library.json`
   - **Identify mass settings** by scanning: (a) parenthetical names like "Lamb of God (Mass of Creation)" → extract "Mass of Creation", (b) umbrella entries with titles starting with "Mass of" or "Misa", (c) entries where composer string contains a mass setting reference. Known settings to seed: Mass of Creation, Mass of Glory, Mass of Joy & Peace, Misa Del Mundo, Misa Gregoriana, Mass of the Incarnate Word, Mass of New Beginnings, Mass of St. Mary Magdalene, Mass of Renewal. Insert these into `mass_settings` table first.
   - **Reclassify each song** using expanded rules:

   ```
   RECLASSIFICATION RULES (apply in order):

   FROM mass_part (118):
   - /kyrie|lord have mercy|misa.*kyrie/i → kyrie
   - /\bgloria\b|glory to god|gloria patri/i → gloria
   - /sprinkling|asperges/i → sprinkling_rite
   - /holy.*holy|sanctus/i → holy_holy
   - /memorial.*accl|mystery.*faith|when we eat|we proclaim|save us.*savior/i → memorial_acclamation
   - /great.*amen/i → great_amen
   - /lamb.*god|agnus.*dei|fraction/i → lamb_of_god
   - /lord.*prayer|our.*father|pater.*noster/i → lords_prayer
   - /\bsequence\b|victimae|veni.*sancte/i → sequence
   - Remaining: inspect functions[] field to determine, default to song

   FROM song (2248):
   - functions includes 'lords_prayer' → lords_prayer
   - functions includes 'fraction_rite' → lamb_of_god
   - functions includes 'gloria' AND title matches /gloria|glory to god/i → gloria
   - functions includes 'penitential_act' AND title matches /kyrie|lord have mercy/i → kyrie
   - Otherwise → song

   FROM gospel_acclamation (76):
   - If title is a base refrain (e.g., "Alleluia (Mass of Joy & Peace)", "Lenten Gospel Acclamation") → gospel_acclamation_refrain
   - If title contains occasion-specific text OR composer field contains occasion identifier (like "O.T. 14 | C") → gospel_acclamation_verse
   - Default → gospel_acclamation_refrain

   FROM psalm (218):
   - Keep as psalm
   - Extract psalm_number: parse /(?:ps\.?|psalm)\s*(\d+)/i from title. If not found, try common names (e.g., "Shepherd Me" → 23, "The Lord Is My Light" → 27)

   MASS SETTING LINKING:
   - For any song with parenthetical "(Mass of X)" in title, look up mass_setting by name and set mass_setting_id
   - For umbrella entries titled "Mass of X" (category would be song with no specific part), set mass_setting_id but keep category as-is
   ```

   - **Insert into Supabase** in batches of 100 (to avoid request size limits):
     - Insert songs into `songs` table
     - Insert resources into `song_resources_v2` table (flatten each song's resources array)
   - Log results: total inserted, per-category counts, any failures

4. **Seed calendar_days** from existing `liturgical_days` table:
   - Query all rows from `liturgical_days`
   - Insert corresponding `calendar_days` entries with liturgical_color, celebration_rank, season, occasion_id, ordo_notes from celebration_name
   - Also insert major US holidays (Thanksgiving, Christmas Day, New Year, etc.) with `is_holiday = true` and `is_recurring = true`
   - Insert school calendar dates (from mass_events where event_type = 'school')

5. **Verify migration:** Query `songs` table, confirm count matches 2,660. Query by category, confirm distribution looks reasonable. Log any songs that couldn't be classified.

**Done when:** `songs` table has 2,660 rows, `mass_settings` has 9+ entries, `song_resources_v2` has resources migrated, `calendar_days` is populated. `npm run build` passes.

**Estimated scope:** L (largest phase — schema + migration + reclassification)

---

## PHASE 2: DATA LAYER SWAP

**Deliverable:** Song library reads from Supabase instead of JSON. New CRUD API routes for songs, rankings, visibility, calendar days. Backward-compatible — components receive the same data shape.

**Inputs:** Phase 1 tables populated. Existing `src/lib/song-library.ts` and `src/lib/data.ts`.

**Steps:**

1. **Create Supabase song data module** `src/lib/supabase/songs.ts`:
   - `getSongsFromSupabase()` — fetches all songs with their resources (join `songs` + `song_resources_v2`). Returns `LibrarySong[]` shaped exactly like the JSON format for backward compat. Map DB fields back to camelCase TypeScript fields.
   - `getSongByIdFromSupabase(id: string)` — fetch by legacy_id or UUID
   - `getSongsByCategoryFromSupabase(category: string)` — filter query
   - `getMassSettingsFromSupabase()` — fetch all mass settings with their linked songs
   - `getSongRankings(userId: string)` — fetch user's rankings
   - `getSongVisibility(userId: string)` — fetch user's hidden songs
   - Uses `createAdminClient()` for server-side (to bypass RLS during server renders)

2. **Create CRUD API routes:**
   - `PUT /api/songs/[id]` — Update ANY song field (title, composer, category, topics, scriptureRefs, etc.). Replace existing PUT that only handles title/composer/category/recordedKey. Write to Supabase `songs` table.
   - `POST /api/songs` — Create new song
   - `DELETE /api/songs/[id]` — Delete song (cascade deletes resources)
   - `POST /api/songs/[id]/ranking` — Upsert ranking for current user
   - `POST /api/songs/[id]/visibility` — Toggle visibility for current user
   - `GET /api/songs/[id]/rankings` — Get all admin rankings for a song
   - `PUT /api/calendar-days/[id]` — Update calendar day (notes, custom fields)
   - `POST /api/calendar-days` — Create calendar day (for custom events)
   - `DELETE /api/calendar-days/[id]` — Delete calendar day

3. **Swap data loaders:**
   - In `src/lib/song-library.ts`, change `getSongLibrary()` to call `getSongsFromSupabase()` instead of reading JSON
   - Keep `classifySong()` as a utility (it's still useful for new songs)
   - Keep all downstream functions (resolveAllSongs, getTitleIndex, etc.) — they work on `LibrarySong[]` regardless of source
   - In library page (`src/app/library/page.tsx`), add `export const dynamic = "force-dynamic"` since it now reads from Supabase

4. **Update TypeScript types** in `src/lib/types.ts`:
   - Expand `SongCategory` type to include all 14 values
   - Add `MassSetting` interface: `{ id: string; name: string; composer?: string; notes?: string; pieces: LibrarySong[] }`
   - Add `SongRanking` interface: `{ songId: string; userId: string; ranking: number; notes?: string }`
   - Add `CalendarDay` interface matching the DB schema
   - Add `psalmNumber?: number` and `massSettingId?: string` to `LibrarySong`

5. **Verify:** Library page loads with Supabase data. Song counts match. Planner grid still works (it uses resolveAllSongs which depends on getSongLibrary). Build passes.

**Done when:** Song library reads from Supabase. CRUD routes work. Types updated. `npm run build` passes.

**Estimated scope:** M

---

## PHASE 3: SONG LIBRARY UI OVERHAUL

**Deliverable:** 5 tabs (Songs, Mass Parts, Psalms, Gospel Acclamations, Antiphons). Mass Parts tab has sub-filter chips. Psalm tab has 1-150 horizontal number picker. Song detail panel shows all metadata and is admin-editable. Song hiding toggle. Song ranking (1-5 stars). "Never performed" filter.

**Inputs:** Phase 2 data layer. Existing `SongLibraryShell.tsx`, `LibraryFilters.tsx`, `SongCard.tsx`, `SongDetailPanel.tsx`.

**Steps:**

1. **Refactor tab system** in `SongLibraryShell.tsx`:
   - Current tabs: Song | Mass Parts | Psalms | Gospel Acclamations
   - New tabs: **Songs** | **Mass Parts** | **Psalms** | **Gospel Acclamations** | **Antiphons**
   - Songs tab: `category === 'song'`
   - Mass Parts tab: `category IN ('kyrie', 'gloria', 'sprinkling_rite', 'holy_holy', 'memorial_acclamation', 'great_amen', 'lamb_of_god', 'lords_prayer', 'sequence')` — with horizontal filter chips for each sub-type
   - Psalms tab: `category === 'psalm'`
   - Gospel Acclamations tab: `category IN ('gospel_acclamation_refrain', 'gospel_acclamation_verse')` — with filter chips for Refrain | Verse
   - Antiphons tab: `category === 'antiphon'`

2. **Mass Parts sub-filtering:** Within the Mass Parts tab, render a horizontal scrollable chip bar:
   ```
   All | Kyries | Glorias | Sprinkling | Holy Holy | Memorial | Amen | Lamb of God | Lord's Prayer | Sequences
   ```
   Each chip filters to its specific category. "All" shows all mass parts.

   **Mass Setting grouping:** When viewing mass parts, add a "Group by Setting" toggle. When active, songs with a `massSettingId` are grouped under their parent setting name as collapsible sections. Each section header shows the setting name + composer, and the pieces underneath show their specific category (Holy, Memorial, Amen, Lamb, etc.).

3. **Psalm 1-150 navigation:** In the Psalms tab, render a horizontal scrollable number bar (like the existing AlphabetJump component but with numbers 1-150). Only numbers that have psalms in the library are active (clickable). Clicking scrolls to that psalm group. Gray out numbers with no psalms.

4. **Song detail panel overhaul** — when a song is selected, the right panel (or mobile bottom sheet) shows:
   - **Header:** Title, Composer, Category badge (colored by category)
   - **Resources section** (existing — keep as-is)
   - **Metadata section** (NEW — below resources):
     - Catalogs: Show all catalog numbers as badges (BB#123, G4#456, SS#789, etc.)
     - Topics: Chip list of topics
     - Scripture Refs: Linked list of scripture references
     - Liturgical Use: Chip list
     - Credits: Text authors, composers, arrangers with dates
     - Tune/Meter: Tune name, meter string, incipit
     - First Line / Refrain First Line
     - Languages
     - Functions: Which Mass positions this song serves
     - Mass Setting: If linked, show parent setting name as a link
     - Psalm Number: If psalm, show prominently
   - **Admin section** (if admin role):
     - Edit button that toggles inline editing for ALL metadata fields
     - Save/Cancel buttons
     - Save calls `PUT /api/songs/[id]` with changed fields
   - **Rankings section:**
     - 5-star rating (clickable by any admin)
     - Shows current user's rating + average of all admin ratings
     - Click calls `POST /api/songs/[id]/ranking`
   - **Visibility toggle:**
     - Eye icon in header. Click toggles hidden status for current user
     - Calls `POST /api/songs/[id]/visibility`

5. **"Never performed" filter:** In `LibraryFilters.tsx`, add a toggle: "Hide unperformed" / "Show only unperformed". Filter by `usageCount === 0`. This lets Jeff hide the ~800+ songs that have never been used.

6. **Song hiding integration:** By default, songs the current user has hidden via `song_visibility` are excluded from all views. Add a "Show hidden" toggle in filters to reveal them (grayed out with a hidden icon).

**Done when:** All 5 tabs render correctly with proper filtering. Mass Parts has sub-chips. Psalms has 1-150 nav. Song detail shows full metadata and is editable. Hiding and ranking work. Build passes.

**Estimated scope:** L

---

## PHASE 4: CALENDAR REDESIGN

**Deliverable:** Modern calendar showing every day of the liturgical year. Each day has liturgical color, celebration rank, ordo notes. Expandable day cards with events. Admin can edit any day. Recurring events supported. Holy days and holidays marked.

**Inputs:** Phase 1 `calendar_days` table. Existing `liturgical_days` table. Existing `mass_events` table. `CalendarShell.tsx` for pattern reference.

**Steps:**

1. **Design the new calendar layout.** Replace the current spreadsheet-style agenda with a modern card-based layout. Two views:

   **Day View (default / agenda):** Scrollable vertical list of days. Each day is a card:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ ● SUN MAR 8        [Violet]  3RD SUNDAY OF LENT    │
   │   Rank: Sunday │ Season: Lent │ Psalter Week III    │
   │   Readings: Ex 17:3-7 / Ps 95 / Rom 5:1-2 / Jn 4  │
   │   ┌─────────────────────────────────────────────┐   │
   │   │ 7:30a  Heritage   Fr. Park      🎵          │   │
   │   │ 9:30a  Generations Msgr. Torg   🎵          │   │
   │   │ 11:30a Foundations Fr. Nestico  🎵          │   │
   │   │ 5:30p  Elevations  Fr. Llonoso  🎵 Auto-Mix│   │
   │   └─────────────────────────────────────────────┘   │
   │   [Edit] [Add Event]                                │
   └─────────────────────────────────────────────────────┘
   ```
   - Left border color = liturgical color of the day
   - Liturgical day name prominent
   - Celebration rank as badge
   - Readings summary (from liturgical_day_readings if available)
   - Mass events nested inside the day card
   - Days with no events still show (feria days, optional memorials)
   - Admin: edit button opens inline editor for custom_notes, holiday_name, etc.
   - Admin: "Add Event" creates a new mass_event or custom calendar entry

   **Month View:** Grid calendar. Each cell shows:
   - Day number
   - Liturgical color dot
   - Abbreviated liturgical day name
   - Number of events badge
   - Click to expand to day detail

2. **Fetch data for calendar page** `src/app/calendar/page.tsx`:
   - Query `calendar_days` for the date range (default: current month ± 1 month)
   - Query `mass_events` for the same range
   - Query `liturgical_days` and `liturgical_day_readings` for the same range
   - Merge into a unified day-level data structure
   - Pass to new `CalendarShellV2` component

3. **Build `CalendarShellV2` component:**
   - Toggle between Day/Agenda and Month views
   - Filters: Season (color the filter chips by season color), Community, Show past days
   - Navigation: Month arrows, "Today" button, season jump dropdown
   - Each day card is expandable (collapsed = one line; expanded = full detail)
   - Liturgical color mapping: violet → `#7C3AED`, white → `#F5F5F4`, red → `#DC2626`, green → `#16A34A`, rose → `#F472B6`, black → `#1C1917`, gold → `#CA8A04`

4. **Admin editing for calendar days:**
   - Click "Edit" on any day card → inline form:
     - Custom notes (textarea)
     - Holiday name (if marking as holiday)
     - Is Holy Day toggle
     - Is Holiday toggle
     - Is Recurring toggle + recurrence type (yearly/weekly)
   - Save calls `PUT /api/calendar-days/[id]`
   - "Add Custom Day" for days not in liturgical calendar (parish events, school dates)

5. **Recurring events:** When `is_recurring = true` and `recurrence_type = 'yearly'`, the system auto-generates next year's entry. Display recurring events with a ♻️ indicator. Admin can break recurrence for a specific year.

6. **Seed complete calendar:** In the migration script (or a separate seed script), ensure EVERY day from Oct 2025 through Sep 2027 exists in `calendar_days`. For days not in `liturgical_days`, create feria entries with season + color from the surrounding liturgical context.

**Done when:** Calendar shows every day with liturgical colors. Events nested in day cards. Admin can edit. Month view works. Build passes.

**Estimated scope:** L

---

## PHASE 5: PLANNER RECOMMENDATIONS + TAGS

**Deliverable:** Each Sunday in the planner shows season + reading tags. Beneath each song position slot, a recommendation panel shows the top 5 matching songs. Recommendations prioritize Lent, Triduum, and Easter seasons.

**Inputs:** Phase 2 Supabase songs with enrichment (topics, scriptureRefs, liturgicalUse). Occasion data (readings, thematicTag, season). Phase 3 mass setting grouping.

**Steps:**

1. **Build recommendation engine** `src/lib/recommendations.ts`:

   ```typescript
   interface SongRecommendation {
     song: LibrarySong;
     score: number;
     reasons: string[]; // ["Scripture: Luke 2:6-18", "Topic: Community", "Season: Lent"]
   }

   function recommendSongs(
     occasion: LiturgicalOccasion,
     position: string, // "gathering", "offertory", "communion", etc.
     allSongs: LibrarySong[],
     options?: {
       limit?: number; // default 5
       excludeSongIds?: string[]; // already selected songs
       userRankings?: Map<string, number>; // boost ranked songs
       userHidden?: Set<string>; // exclude hidden
     }
   ): SongRecommendation[]
   ```

   **Scoring algorithm:**
   - **Scripture match** (+30): song.scriptureRefs contains any reading citation from the occasion (exact book+chapter match, not just book)
   - **Topic match** (+20 per match, max 60): song.topics overlaps with occasion.lectionary.thematicTag or reading summaries parsed for key themes
   - **Season match** (+15): song.liturgicalUse includes the occasion's season
   - **Function match** (+25): song.functions includes the target position (e.g., "communion" for communion slots)
   - **Catalog presence** (+5): song has a BB2026 number (familiar to the parish)
   - **Usage frequency** (+10 if usageCount 5-50, +5 if 1-4, 0 if 0, -5 if >100): prefer songs that are used but not overused
   - **Recency penalty** (-20): if song appears in occasions within ±2 weeks of this occasion (avoid repetition)
   - **User ranking boost** (+ranking * 5): if the current admin has ranked this song
   - **Hidden exclusion**: skip songs in user's hidden list

   Songs with score < 10 are excluded. Return top N sorted by score descending.

2. **Build recommendation seed script** `scripts/seed-recommendations.ts`:
   - Run the recommendation engine for ALL occasions, ALL positions
   - Store top 10 per (occasion, position) in `song_recommendations` table
   - **Priority order:** Process Lent and Easter seasons FIRST, then Advent/Christmas, then Ordinary Time
   - This pre-computation means the UI doesn't need to run the algorithm on every page load

3. **Add recommendation API route** `GET /api/recommendations/[occasionId]`:
   - Fetch from `song_recommendations` table, join with songs
   - Return `{ [position]: SongRecommendation[] }`
   - Fallback: if no cached recommendations, run engine live (slower but works)

4. **Planner UI — tags on Sunday columns:**
   - In `PlannerGrid.tsx`, add a tag row beneath the occasion header for each column
   - Tags: Season badge (colored), Thematic tag (from lectionary.thematicTag), Key reading abbreviation (e.g., "Jn 4 — Woman at the Well")
   - These are already in the occasion data — just render them

5. **Planner UI — recommendations beneath slots:**
   - In the planner card view (mobile) and optionally grid view (desktop), when a song slot is empty or selected:
   - Show a collapsible "Suggestions" section beneath the slot
   - List top 3-5 recommended songs with score reasons as small badges
   - Click a recommendation → fills the slot (calls existing music plan update logic)
   - This requires fetching recommendations for the visible occasions

6. **Occasion detail page — recommendations section:**
   - On `/occasion/[id]`, add a "Recommended Songs" section below music plans
   - Group by Mass position
   - Show top 5 per position with match reasons
   - Click to view song in library

**Done when:** Lent/Triduum/Easter occasions have pre-computed recommendations. Planner shows season/reading tags. Recommendation panels show beneath planner slots. Build passes.

**Estimated scope:** M

---

## PHASE 6: ADMIN EDITING + BACKLINKING

**Deliverable:** Admin can edit songs, and changes propagate to all references. Admin can edit occasion planning notes and music plans. Audit trail for changes.

**Inputs:** Phases 1-5. Existing setlist system. Existing occasion JSON files.

**Steps:**

1. **Song edit propagation:** When a song's title or composer changes in Supabase:
   - Update all `setlists` rows where songs JSONB contains the old title → replace with new title
   - Update all static occasion JSON files where musicPlans reference the old title (write a script that scans and updates)
   - This is the "backlink" behavior Jeff wants — edit once, propagate everywhere

2. **Occasion music plan editing:** Create `PUT /api/occasions/[id]/music-plan`:
   - Accepts: communityId, position (e.g., "gathering"), songEntry (title + composer)
   - Reads occasion JSON, updates the specific plan + position, writes back
   - This enables inline editing in the planner grid

3. **Occasion planning notes editing:** Create `PUT /api/occasions/[id]/planning-notes`:
   - Accepts: planningNotes string array
   - Updates occasion JSON

4. **Calendar day editing** (already created in Phase 4 API routes — wire up the UI)

5. **Audit trail:** Create `change_log` table:
   ```sql
   CREATE TABLE change_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     entity_type TEXT NOT NULL, -- 'song', 'occasion', 'calendar_day', 'setlist'
     entity_id TEXT NOT NULL,
     field_changed TEXT,
     old_value TEXT,
     new_value TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - Log every admin edit
   - Display recent changes on admin dashboard

6. **Inline editing in planner grid:** In `PlannerGrid.tsx`, make song cells clickable for admin:
   - Click empty cell → song picker modal (search library, shows recommendations first)
   - Click filled cell → edit/replace/clear options
   - Changes save via the occasion music plan API

**Done when:** Song edits propagate to setlists. Occasion plans are editable from planner. Audit log captures changes. Build passes.

**Estimated scope:** M

---

## EVALUATION

### Automated Checks
- `npm run build` passes after every phase
- `npm run lint` has no new errors
- Supabase table counts: `songs` = 2660, `mass_settings` >= 9, `calendar_days` >= 365
- Category distribution: no category has 0 entries (except antiphon which may start empty — that's OK)

### Manual Verification (for Jeff to check in the morning)
- [ ] Library page loads and shows 5 tabs
- [ ] Mass Parts tab groups by setting when toggled
- [ ] Psalms tab has working 1-150 number picker
- [ ] Clicking a song shows full metadata on the right
- [ ] Admin can edit a song's title and see it update
- [ ] Admin can hide a song and it disappears from default view
- [ ] Admin can rate a song 1-5 stars
- [ ] Calendar shows liturgical colors and every day
- [ ] Calendar events are editable
- [ ] Planner shows season/reading tags on Sunday columns
- [ ] Recommendation suggestions appear beneath empty planner slots
- [ ] Lent and Easter occasions have recommendations

### Known Failure Modes
- **Supabase rate limits**: Batch inserts of 2,660 songs may hit rate limits. Use batches of 100 with 500ms delays between batches.
- **Type mismatches**: The expanded SongCategory type must be updated everywhere it's referenced (grid-types.ts, song-library.ts, SongLibraryShell.tsx, LibraryFilters.tsx, SongCard.tsx, SongDetailPanel.tsx, SetlistShell.tsx, booking-types.ts)
- **Occasion JSON writes**: Writing to `src/data/occasions/*.json` on Vercel will fail (read-only filesystem). The occasion edit API should only work in dev or when filesystem is writable. On Vercel, queue changes to Supabase and apply on next build.
- **Mass of Joy & Peace edge case**: This setting has 41 occasion-specific gospel acclamation entries where the `composer` field contains the verse text. These should be classified as `gospel_acclamation_verse` and the actual composer ("Tony Alonso") should be extracted and normalized.
- **Duplicate entries**: Intentional duplicates (suffix `-1`, `-2`) exist for community-split copies. Preserve these — don't deduplicate during migration.
- **Context window**: If the agent's context fills up during a long phase, it should checkpoint progress in a `PROGRESS.md` file at the project root, noting which step of which phase was completed, so the next session can continue.

---

## PRIORITY NOTE

**Jeff's most urgent need is Lent/Triduum/Easter planning.** If you're running low on time/context, prioritize:
1. Phase 1 (database foundation — everything depends on it)
2. Phase 3 (library UI — Jeff needs to browse and select songs)
3. Phase 5 (recommendations for Lent/Easter — the whole point)

Phases 4 and 6 are valuable but can be done in a follow-up session.
