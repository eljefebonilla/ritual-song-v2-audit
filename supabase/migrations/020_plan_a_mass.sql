-- ============================================================
-- 020: Plan a Mass — Planning sessions with collaborative editing
-- Ref: DESIGN-SPEC-v2.md 11.5, 16.3
-- ============================================================

-- Mass planning sessions (the Plan a Mass wizard state)
CREATE TABLE IF NOT EXISTS planning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mass type classification
  mass_type TEXT NOT NULL DEFAULT 'weekend'
    CHECK (mass_type IN ('weekday', 'weekend', 'school', 'sacramental', 'holy_day', 'special')),
  school_level TEXT CHECK (school_level IN ('all', 'upper', 'lower', 'middle')),

  -- Logistics
  title TEXT,
  event_date DATE,
  event_time TIME,
  celebrant TEXT,
  is_bishop_celebrating BOOLEAN DEFAULT false,
  has_music BOOLEAN DEFAULT true,
  ensemble TEXT,

  -- Music configuration
  cantor_requested BOOLEAN DEFAULT true,
  piano_requested BOOLEAN DEFAULT true,
  instrument_requests JSONB DEFAULT '[]',

  -- Readings
  uses_daily_readings BOOLEAN DEFAULT true,
  custom_readings JSONB DEFAULT '[]',
  reading_synopses JSONB DEFAULT '{}',

  -- Song selections (position -> song array, like wedding)
  selections JSONB DEFAULT '{}',

  -- Personnel assignments
  personnel JSONB DEFAULT '{}',

  -- Notes
  planning_notes TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'review', 'confirmed', 'completed')),

  -- Collaboration
  share_token TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  collaborators UUID[] DEFAULT '{}',

  -- Links to existing entities
  mass_event_id UUID REFERENCES mass_events(id),
  occasion_id TEXT,

  -- Runtime session (for AI chat persistence)
  conversation_state JSONB DEFAULT '{}',

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collaborator invitation records
CREATE TABLE IF NOT EXISTS planning_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  invited_email TEXT,
  role TEXT NOT NULL DEFAULT 'editor'
    CHECK (role IN ('viewer', 'editor', 'admin')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(session_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_planning_sessions_date ON planning_sessions(event_date);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_status ON planning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_token ON planning_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_planning_sessions_creator ON planning_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_planning_collaborators_session ON planning_collaborators(session_id);
CREATE INDEX IF NOT EXISTS idx_planning_collaborators_profile ON planning_collaborators(profile_id);

-- RLS
ALTER TABLE planning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_collaborators ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY planning_sessions_admin ON planning_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Creator can manage their sessions
CREATE POLICY planning_sessions_creator ON planning_sessions
  FOR ALL USING (created_by = auth.uid());

-- Collaborators can view/edit
CREATE POLICY planning_sessions_collaborator ON planning_sessions
  FOR SELECT USING (
    auth.uid() = ANY(collaborators)
  );

CREATE POLICY planning_sessions_collaborator_update ON planning_sessions
  FOR UPDATE USING (
    auth.uid() = ANY(collaborators)
  );

-- Collaborator records
CREATE POLICY planning_collaborators_admin ON planning_collaborators
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY planning_collaborators_own ON planning_collaborators
  FOR SELECT USING (profile_id = auth.uid());

-- Auto-update timestamp
CREATE TRIGGER planning_sessions_updated
  BEFORE UPDATE ON planning_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
