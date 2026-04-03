-- ============================================================
-- 019: Sub-Request Cascade System
-- Sequential SMS cascade for finding musician substitutes
-- Ref: DESIGN-SPEC-v2.md 11.11, 15.2, 16.3
-- ============================================================

-- Add seniority + sub-availability to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seniority_tier INTEGER DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_for_subs BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.seniority_tier IS '1=First Chair, 2=Second Chair, 3=General Pool';
COMMENT ON COLUMN profiles.available_for_subs IS 'Opt-in for receiving sub request SMS';

-- Cascade request: one per "need a sub" action
CREATE TABLE IF NOT EXISTS cascade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_slot_id UUID NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  mass_event_id UUID NOT NULL REFERENCES mass_events(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES profiles(id),
  original_musician_id UUID REFERENCES profiles(id),
  ministry_role_id UUID REFERENCES ministry_roles(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'filled', 'exhausted', 'cancelled')),
  urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('normal', 'urgent')),
  timeout_minutes INTEGER NOT NULL DEFAULT 15,
  message_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filled_at TIMESTAMPTZ,
  filled_by UUID REFERENCES profiles(id)
);

-- Cascade candidates: ordered list of people to contact
CREATE TABLE IF NOT EXISTS cascade_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cascade_request_id UUID NOT NULL REFERENCES cascade_requests(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  seniority_tier INTEGER NOT NULL,
  contact_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'contacted', 'accepted', 'declined', 'timeout', 'skipped')),
  contacted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  sms_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cascade_requests_status ON cascade_requests(status);
CREATE INDEX IF NOT EXISTS idx_cascade_requests_mass_event ON cascade_requests(mass_event_id);
CREATE INDEX IF NOT EXISTS idx_cascade_candidates_request ON cascade_candidates(cascade_request_id);
CREATE INDEX IF NOT EXISTS idx_cascade_candidates_status ON cascade_candidates(cascade_request_id, status);
CREATE INDEX IF NOT EXISTS idx_cascade_candidates_profile ON cascade_candidates(profile_id, status);

-- Auto-update updated_at on cascade_requests
CREATE OR REPLACE FUNCTION update_cascade_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cascade_request_updated ON cascade_requests;
CREATE TRIGGER cascade_request_updated
  BEFORE UPDATE ON cascade_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_cascade_request_timestamp();

-- RLS policies
ALTER TABLE cascade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_candidates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY cascade_requests_admin ON cascade_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY cascade_candidates_admin ON cascade_candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Musicians can see their own candidate records
CREATE POLICY cascade_candidates_own ON cascade_candidates
  FOR SELECT USING (profile_id = auth.uid());
