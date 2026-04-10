-- Music plan edits: stores per-field overrides on top of static occasion JSON
-- Each row represents one admin edit to a music plan field for a specific community.
-- value = null means "explicitly cleared" (overrides static JSON with nothing).
-- Absence of a row means "use the static JSON value."

CREATE TABLE music_plan_edits (
  occasion_id text NOT NULL,
  community_id text NOT NULL,
  field text NOT NULL,
  value jsonb,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (occasion_id, community_id, field)
);
-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON music_plan_edits
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
-- RLS: service_role only (all access goes through admin-verified API routes)
ALTER TABLE music_plan_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON music_plan_edits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Allow authenticated users to read (for client-side fetching)
CREATE POLICY "Authenticated read access" ON music_plan_edits
  FOR SELECT TO authenticated USING (true);
-- Allow anon read too (gate-code users aren't authenticated via Supabase)
CREATE POLICY "Anon read access" ON music_plan_edits
  FOR SELECT TO anon USING (true);
