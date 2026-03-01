-- ============================================================
-- 005: Liturgical Calendar Tables
-- Adds liturgical_days, liturgical_day_readings, app_settings,
-- saints, and song_metadata tables for full calendar enrichment.
-- ============================================================

-- Core: one row per calendar date
CREATE TABLE IF NOT EXISTS public.liturgical_days (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  celebration_name text NOT NULL,
  rank text NOT NULL,                -- solemnity|feast|memorial|optional_memorial|sunday|weekday
  season text NOT NULL,              -- advent|christmas|lent|easter|ordinary
  color_primary text NOT NULL,       -- violet|white|red|green|rose|black
  color_secondary text,              -- for dual-color days
  gloria boolean NOT NULL DEFAULT false,
  alleluia boolean NOT NULL DEFAULT true,
  lectionary_number int,
  psalter_week text,                 -- I|II|III|IV|Prop
  occasion_id text,                  -- FK to static JSON occasion slug (null for weekdays)
  saint_name text,
  saint_title text,                  -- "Priest and Doctor of the Church"
  is_holyday boolean DEFAULT false,
  is_transferred boolean DEFAULT false,
  ecclesiastical_province text,      -- null for universal, or province identifier for dual entries
  liturgical_year_label text,        -- "2025-2026" or "2026-2027"
  sunday_cycle char(1),              -- A|B|C
  weekday_cycle char(1),             -- 1|2
  source_pdf text,                   -- "usccb-2026" or "usccb-2027"
  optional_memorials text[],         -- array of optional memorial names
  is_bvm boolean DEFAULT false,      -- BVM Saturday option available
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: date + province (allows dual Ascension entries)
CREATE UNIQUE INDEX IF NOT EXISTS liturgical_days_date_province_idx
  ON public.liturgical_days (date, COALESCE(ecclesiastical_province, '__universal__'));

-- Index for common queries
CREATE INDEX IF NOT EXISTS liturgical_days_date_idx ON public.liturgical_days (date);
CREATE INDEX IF NOT EXISTS liturgical_days_season_idx ON public.liturgical_days (season);
CREATE INDEX IF NOT EXISTS liturgical_days_occasion_id_idx ON public.liturgical_days (occasion_id);

-- Readings: one row per reading per day
CREATE TABLE IF NOT EXISTS public.liturgical_day_readings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  liturgical_day_id uuid NOT NULL REFERENCES public.liturgical_days(id) ON DELETE CASCADE,
  reading_order int NOT NULL,
  reading_type text NOT NULL,        -- first|psalm|second|gospel_verse|gospel
  book_abbrev text NOT NULL,
  chapter_verse text NOT NULL,
  full_citation text NOT NULL
);

CREATE INDEX IF NOT EXISTS liturgical_day_readings_day_idx
  ON public.liturgical_day_readings (liturgical_day_id);

-- App-level settings (diocese, zip, transfers)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('parish_name', '"St. Monica Catholic Community"'),
  ('diocese', '"Archdiocese of Los Angeles"'),
  ('zip_code', '"90403"'),
  ('ascension_transferred_to_sunday', 'true'),
  ('epiphany_transferred_to_sunday', 'true'),
  ('assumption_obligation_abrogated_on_saturday', 'true')
ON CONFLICT (key) DO NOTHING;

-- Saints reference data
CREATE TABLE IF NOT EXISTS public.saints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  title text,                        -- "Bishop and Doctor of the Church"
  feast_month int,
  feast_day int,
  rank text,
  description text,                  -- 2-3 sentence hagiography for cantor cards
  patron_of text,                    -- for relevance to parish/school
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saints_name_idx ON public.saints (name);

-- Song lyrics + alleluia detection
CREATE TABLE IF NOT EXISTS public.song_metadata (
  song_id text PRIMARY KEY,          -- matches song-library.json slug
  lyrics_text text,
  has_alleluia boolean DEFAULT false,
  lyrics_source text,                -- manual|auto_scanned|title_match
  updated_at timestamptz DEFAULT now()
);

-- Add needs_volunteers column to mass_events
ALTER TABLE public.mass_events ADD COLUMN IF NOT EXISTS needs_volunteers boolean DEFAULT false;

-- ============================================================
-- Row Level Security
-- ============================================================

-- liturgical_days: public read, admin write
ALTER TABLE public.liturgical_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liturgical_days_public_read"
  ON public.liturgical_days
  FOR SELECT
  USING (true);

CREATE POLICY "liturgical_days_admin_write"
  ON public.liturgical_days
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- liturgical_day_readings: public read, admin write
ALTER TABLE public.liturgical_day_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liturgical_day_readings_public_read"
  ON public.liturgical_day_readings
  FOR SELECT
  USING (true);

CREATE POLICY "liturgical_day_readings_admin_write"
  ON public.liturgical_day_readings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- app_settings: authenticated read, admin write
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_authenticated_read"
  ON public.app_settings
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "app_settings_admin_write"
  ON public.app_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- saints: public read, admin write
ALTER TABLE public.saints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saints_public_read"
  ON public.saints
  FOR SELECT
  USING (true);

CREATE POLICY "saints_admin_write"
  ON public.saints
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- song_metadata: authenticated read, admin write
ALTER TABLE public.song_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "song_metadata_authenticated_read"
  ON public.song_metadata
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "song_metadata_admin_write"
  ON public.song_metadata
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
