-- ============================================================
-- 017: Wedding Portal — events, songs, cantor profiles, selections
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Wedding/Funeral song catalog (curated picks per liturgical step)
CREATE TABLE sacramental_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  composer TEXT,
  liturgy_type TEXT NOT NULL CHECK (liturgy_type IN ('wedding', 'funeral')),
  step_number INT NOT NULL,
  step_label TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  instrumentation TEXT,
  is_starred BOOLEAN DEFAULT FALSE,
  is_bilingual BOOLEAN DEFAULT FALSE,
  language TEXT DEFAULT 'en',
  together_for_life_code TEXT,
  psalm_number INT,
  notes TEXT,
  song_id UUID REFERENCES songs(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sacramental_songs_type ON sacramental_songs(liturgy_type);
CREATE INDEX idx_sacramental_songs_step ON sacramental_songs(liturgy_type, step_number);
-- Cantor profiles (for wedding/funeral selection)
CREATE TABLE cantor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  display_name TEXT NOT NULL,
  is_bilingual BOOLEAN DEFAULT FALSE,
  voice_type TEXT,
  bio TEXT,
  favorite_wedding_songs TEXT[],
  regular_masses TEXT[],
  audio_samples JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Wedding/Funeral event planning
CREATE TABLE sacramental_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('wedding', 'funeral')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'confirmed', 'completed', 'cancelled')),

  -- People
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  couple_names TEXT,
  deceased_name TEXT,

  -- Logistics
  event_date DATE,
  event_time TIME,
  rehearsal_date DATE,
  rehearsal_time TIME,
  celebrant TEXT,
  location TEXT DEFAULT 'St. Monica Catholic Community',

  -- Music
  cantor_id UUID REFERENCES cantor_profiles(id),
  musicians JSONB DEFAULT '[]',
  payment_notes TEXT,
  payment_amount DECIMAL(10,2),

  -- Selections (step_number -> song choice)
  selections JSONB DEFAULT '{}',
  custom_notes TEXT,

  -- Sharing
  share_token TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sacramental_events_type ON sacramental_events(event_type);
CREATE INDEX idx_sacramental_events_date ON sacramental_events(event_date);
CREATE INDEX idx_sacramental_events_token ON sacramental_events(share_token);
-- RLS
ALTER TABLE sacramental_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cantor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacramental_events ENABLE ROW LEVEL SECURITY;
-- Songs: everyone can read
CREATE POLICY "Anyone can view sacramental songs"
  ON sacramental_songs FOR SELECT USING (true);
CREATE POLICY "Admins manage sacramental songs"
  ON sacramental_songs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
-- Cantor profiles: everyone can read active
CREATE POLICY "Anyone can view active cantors"
  ON cantor_profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage cantor profiles"
  ON cantor_profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
-- Events: creator + admins + anyone with share token
CREATE POLICY "Creators and admins can view events"
  ON sacramental_events FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
CREATE POLICY "Admins manage events"
  ON sacramental_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
-- Trigger for updated_at
CREATE TRIGGER set_updated_at_sacramental_events
  BEFORE UPDATE ON sacramental_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_cantor_profiles
  BEFORE UPDATE ON cantor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
