-- ============================================================
-- 022: Multi-Parish Foundation
-- Ref: DESIGN-SPEC-v2.md 11.1, 11.2, 15.7, Tier 11
-- ============================================================

-- Parish entity: the tenant unit
CREATE TABLE IF NOT EXISTS parishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  diocese TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Onboarding state
  onboard_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (onboard_status IN ('pending', 'in_progress', 'complete')),

  -- Publishers / hymnals used
  publishers TEXT[] DEFAULT '{}',
  hymnals TEXT[] DEFAULT '{}',

  -- Parish personality
  music_style TEXT DEFAULT 'mixed'
    CHECK (music_style IN ('traditional', 'contemporary', 'mixed')),
  uses_screens BOOLEAN DEFAULT false,
  uses_worship_aids BOOLEAN DEFAULT false,

  -- Mass schedule
  weekend_mass_count INTEGER DEFAULT 4,
  weekday_mass_count INTEGER DEFAULT 1,

  -- Repetition preference (1=maximum variety, 10=maximum repetition)
  repetition_preference INTEGER DEFAULT 5 CHECK (repetition_preference BETWEEN 1 AND 10),

  -- 3-year plan generation status
  plan_generated BOOLEAN DEFAULT false,
  plan_generated_at TIMESTAMPTZ,

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensembles per parish (custom names + colors)
CREATE TABLE IF NOT EXISTS parish_ensembles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  description TEXT,
  mass_times TEXT[],
  sort_order INTEGER DEFAULT 0,
  UNIQUE(parish_id, name)
);

-- Parish config: the LayeredConfig persistence layer
-- Each row is one key-value pair in the parish config layer
CREATE TABLE IF NOT EXISTS parish_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parish_id, config_key)
);

-- Parish membership (which users belong to which parish)
CREATE TABLE IF NOT EXISTS parish_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'director', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parish_id, profile_id)
);

-- Favorite songs seeded during onboarding
CREATE TABLE IF NOT EXISTS parish_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id),
  song_title TEXT NOT NULL,
  liturgical_function TEXT,
  seeded_during_onboard BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add parish_id to profiles (nullable: St. Monica users predate multi-parish)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parish_id UUID REFERENCES parishes(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parishes_status ON parishes(onboard_status);
CREATE INDEX IF NOT EXISTS idx_parish_config_parish ON parish_config(parish_id);
CREATE INDEX IF NOT EXISTS idx_parish_members_parish ON parish_members(parish_id);
CREATE INDEX IF NOT EXISTS idx_parish_members_profile ON parish_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_parish_favorites_parish ON parish_favorites(parish_id);
CREATE INDEX IF NOT EXISTS idx_profiles_parish ON profiles(parish_id);

-- RLS
ALTER TABLE parishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_ensembles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parish_favorites ENABLE ROW LEVEL SECURITY;

-- Parish members can view their own parish
CREATE POLICY parishes_member_view ON parishes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM parish_members WHERE parish_members.parish_id = id AND parish_members.profile_id = auth.uid())
  );

-- Parish owner/admin can manage
CREATE POLICY parishes_owner_manage ON parishes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM parish_members WHERE parish_members.parish_id = id AND parish_members.profile_id = auth.uid() AND parish_members.role IN ('owner', 'admin'))
  );

-- Ensembles: parish members can view
CREATE POLICY parish_ensembles_view ON parish_ensembles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM parish_members WHERE parish_members.parish_id = parish_ensembles.parish_id AND parish_members.profile_id = auth.uid())
  );

-- Config: parish admins can manage
CREATE POLICY parish_config_manage ON parish_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM parish_members WHERE parish_members.parish_id = parish_config.parish_id AND parish_members.profile_id = auth.uid() AND parish_members.role IN ('owner', 'admin', 'director'))
  );

-- Members: parish admins can manage
CREATE POLICY parish_members_manage ON parish_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM parish_members pm WHERE pm.parish_id = parish_members.parish_id AND pm.profile_id = auth.uid() AND pm.role IN ('owner', 'admin'))
  );

-- Favorites: parish members can view
CREATE POLICY parish_favorites_view ON parish_favorites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM parish_members WHERE parish_members.parish_id = parish_favorites.parish_id AND parish_members.profile_id = auth.uid())
  );

-- Global admin override (St. Monica superadmins)
CREATE POLICY parishes_global_admin ON parishes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Triggers
CREATE TRIGGER parishes_updated BEFORE UPDATE ON parishes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER parish_config_updated BEFORE UPDATE ON parish_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed St. Monica as the first parish
INSERT INTO parishes (id, name, location, diocese, onboard_status, publishers, hymnals, music_style, uses_screens, weekend_mass_count, plan_generated)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'St. Monica Catholic Community',
  'Santa Monica, CA',
  'Archdiocese of Los Angeles',
  'complete',
  ARRAY['OCP', 'GIA'],
  ARRAY['Breaking Bread', 'Gather 4'],
  'mixed',
  true,
  5,
  true
) ON CONFLICT (id) DO NOTHING;
