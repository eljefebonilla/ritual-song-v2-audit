-- ============================================================
-- Migration 002: Booking Grid + Choir Sign-Up + Setlist Builder
-- ============================================================
-- Adds tables for:
--   1. booking_slots   — admin assigns musicians to roles per Mass
--   2. choir_signups   — members self-select Masses to sing at
--   3. mass_comments   — social comment thread per Mass
--   4. setlists        — authored setlists with songs + personnel
-- Also extends mass_events and seeds additional ministry roles.
-- ============================================================

-- ============================================================
-- 1. EXTEND mass_events
-- ============================================================

ALTER TABLE public.mass_events
  ADD COLUMN IF NOT EXISTS booking_status text
    DEFAULT 'pending'
    CHECK (booking_status IN ('confirmed', 'pending', 'needs_attention', 'na')),
  ADD COLUMN IF NOT EXISTS choir_descriptor text
    CHECK (choir_descriptor IN (
      'Volunteers', 'SMPREP', 'Volunteers + SMPREP', 'Cancelled', 'N/A'
    ));

-- ============================================================
-- 2. SEED ADDITIONAL ministry_roles
-- ============================================================
-- Existing roles from schema.sql:
--   Cantor(1), Choir(2), Organist(3), Guitarist(4), Bassist(5),
--   Drummer(6), Instrumentalist(7), Music Director(8), Psalmist(9)
-- New roles fill out the booking grid columns.
-- ON CONFLICT (name) DO NOTHING preserves existing rows.

INSERT INTO public.ministry_roles (name, description, sort_order) VALUES
  ('Director', 'Music Director for this liturgy', 0),
  ('Sound', 'Sound technician', 10),
  ('Playback', 'Playback/tracks operator', 11),
  ('Piano', 'Piano/keyboard/organ', 12),
  ('Soprano', 'Soprano section lead', 13),
  ('Alto', 'Alto section lead', 14),
  ('Tenor', 'Tenor section lead', 15),
  ('Bass (Vocal)', 'Bass vocal section lead', 16),
  ('A. Guitar', 'Acoustic guitar', 17),
  ('E. Guitar', 'Electric guitar', 18),
  ('E. Bass', 'Electric/upright bass', 19),
  ('Drums/Percussion', 'Drums and percussion', 20),
  ('Other', 'Other instrument (violin, woodwinds, etc.)', 21),
  ('Livestream TD', 'Livestream technical director', 22)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. BOOKING SLOTS
-- ============================================================
-- The atomic unit of the booking grid.
-- One row = one person assigned to one role at one Mass.

CREATE TABLE public.booking_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mass_event_id uuid REFERENCES public.mass_events(id) ON DELETE CASCADE NOT NULL,
  ministry_role_id uuid REFERENCES public.ministry_roles(id) ON DELETE CASCADE NOT NULL,

  -- Person identity: profile_id for system users, person_name for non-users
  -- (presiders, guest musicians, "TBD Student", "AUTO")
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  person_name text,

  -- Confirmation status (matches spreadsheet symbols)
  confirmation text NOT NULL DEFAULT 'unconfirmed'
    CHECK (confirmation IN (
      'unconfirmed',  -- name only, no response yet
      'confirmed',    -- explicitly said yes
      'declined',     -- said no / not available
      'pending',      -- asked, awaiting response
      'expected',     -- recurring assignment (staff assumed, contractors need confirm)
      'auto'          -- unattended sound/playback
    )),

  -- Is this a recurring/default assignment?
  -- Staff: is_recurring=true, needs no confirmation each week
  -- Contractors: is_recurring=true, but confirmation still needed
  is_recurring boolean DEFAULT false,

  -- Sort order within cell (when multiple people fill same role)
  slot_order int DEFAULT 0,

  -- Freeform role label for setlist footer (e.g., "MD/A. Guitar")
  -- If null, falls back to ministry_roles.name
  role_label_override text,

  -- Freeform instrument descriptor for "Other" role
  -- e.g., "Violin", "Woodwinds", "WW"
  instrument_detail text,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One profile can only appear once per role per Mass
  CONSTRAINT booking_slots_profile_unique
    UNIQUE NULLS NOT DISTINCT (mass_event_id, ministry_role_id, profile_id),

  -- Must have either a profile or a name (unless auto)
  CONSTRAINT booking_slots_person_check CHECK (
    profile_id IS NOT NULL
    OR person_name IS NOT NULL
    OR confirmation = 'auto'
  )
);

-- RLS
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view booking slots"
  ON public.booking_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage booking slots"
  ON public.booking_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own booking confirmation"
  ON public.booking_slots FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.booking_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_booking_slots_mass ON public.booking_slots(mass_event_id);
CREATE INDEX idx_booking_slots_profile ON public.booking_slots(profile_id);
CREATE INDEX idx_booking_slots_mass_role ON public.booking_slots(mass_event_id, ministry_role_id);

-- ============================================================
-- 4. CHOIR SIGNUPS
-- ============================================================
-- Member-facing self-service.
-- Separate from booking_slots: members manage their own rows
-- vs. admin-managed booking.

CREATE TABLE public.choir_signups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mass_event_id uuid REFERENCES public.mass_events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  voice_part text NOT NULL CHECK (voice_part IN ('Soprano', 'Alto', 'Tenor', 'Bass')),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(mass_event_id, user_id)
);

-- RLS
ALTER TABLE public.choir_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view choir signups"
  ON public.choir_signups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own choir signup"
  ON public.choir_signups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own choir signup"
  ON public.choir_signups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own choir signup"
  ON public.choir_signups FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all choir signups"
  ON public.choir_signups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.choir_signups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_choir_signups_mass ON public.choir_signups(mass_event_id);
CREATE INDEX idx_choir_signups_user ON public.choir_signups(user_id);
CREATE INDEX idx_choir_signups_part ON public.choir_signups(mass_event_id, voice_part);

-- ============================================================
-- 5. MASS COMMENTS
-- ============================================================
-- Social comment thread per Mass (separate from existing
-- comments table which is tied to announcements).

CREATE TABLE public.mass_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mass_event_id uuid REFERENCES public.mass_events(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.mass_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view mass comments"
  ON public.mass_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can post mass comments"
  ON public.mass_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own mass comments"
  ON public.mass_comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own mass comments"
  ON public.mass_comments FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all mass comments"
  ON public.mass_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mass_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_mass_comments_event ON public.mass_comments(mass_event_id);
CREATE INDEX idx_mass_comments_author ON public.mass_comments(author_id);

-- ============================================================
-- 6. SETLISTS
-- ============================================================
-- One setlist per Mass. Songs and personnel stored as JSONB.

CREATE TABLE public.setlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mass_event_id uuid REFERENCES public.mass_events(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Header metadata (overridable for display)
  occasion_name text,
  special_designation text,  -- "Catholic Schools' Week", "Alumni Mass", "3rd Grade Hosts"
  occasion_id text,          -- links to static occasion JSON

  -- Song rows: JSONB array (typed as SetlistSongRow[] in TS)
  songs jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Personnel footer: JSONB array (typed as SetlistPersonnel[] in TS)
  personnel jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Choir footer label
  choir_label text,          -- "Volunteers", "Volunteers + SMPREP", etc.

  -- Safety song
  safety_song jsonb,         -- { title, composer?, hymnal_number? }

  last_edited_by uuid REFERENCES public.profiles(id),
  version int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view setlists"
  ON public.setlists FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage setlists"
  ON public.setlists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_setlists_mass ON public.setlists(mass_event_id);
CREATE INDEX idx_setlists_occasion ON public.setlists(occasion_id);
CREATE INDEX idx_setlists_songs_gin ON public.setlists USING gin(songs);

-- ============================================================
-- 7. AVATAR STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
