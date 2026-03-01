-- ============================================================
-- 007: Songs Migration — Expanded Taxonomy & Mass Settings
-- Adds songs, mass_settings, song_resources_v2, song_rankings,
-- song_visibility, calendar_days, song_recommendations tables.
-- ============================================================

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

-- Audit log for admin edits
CREATE TABLE change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
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
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated
CREATE POLICY "songs_select" ON songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_resources_v2_select" ON song_resources_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "mass_settings_select" ON mass_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_rankings_select" ON song_rankings FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_visibility_select" ON song_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_days_select" ON calendar_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "song_recommendations_select" ON song_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "change_log_select" ON change_log FOR SELECT TO authenticated USING (true);

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

CREATE POLICY "change_log_admin_insert" ON change_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

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
CREATE POLICY "change_log_service" ON change_log FOR ALL TO service_role USING (true);

-- Updated_at triggers
CREATE TRIGGER songs_updated_at BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER song_rankings_updated_at BEFORE UPDATE ON song_rankings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER calendar_days_updated_at BEFORE UPDATE ON calendar_days
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
