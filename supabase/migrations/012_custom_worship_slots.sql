-- ============================================================
-- Migration 012: Custom Worship Slots
-- ============================================================
-- Stores admin-defined worship slots that extend the static
-- occasion worship plan. Each row is a custom slot for a
-- specific occasion + ensemble combination.
-- ============================================================

CREATE TABLE custom_worship_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  occasion_id text NOT NULL,
  ensemble_id text NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('song','reading','ritual_moment','note','mass_part')),
  label text NOT NULL,
  order_position integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON custom_worship_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- Index for fast lookups by occasion
CREATE INDEX idx_custom_worship_slots_occasion
  ON custom_worship_slots(occasion_id);
-- Composite index for occasion + ensemble queries
CREATE INDEX idx_custom_worship_slots_occasion_ensemble
  ON custom_worship_slots(occasion_id, ensemble_id);
-- RLS: service_role only (all writes go through admin-verified API routes)
ALTER TABLE custom_worship_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON custom_worship_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Allow authenticated users to read (for client-side fetching)
CREATE POLICY "Authenticated read access" ON custom_worship_slots
  FOR SELECT TO authenticated USING (true);
-- Allow anon read too (gate-code users aren't authenticated via Supabase)
CREATE POLICY "Anon read access" ON custom_worship_slots
  FOR SELECT TO anon USING (true);
