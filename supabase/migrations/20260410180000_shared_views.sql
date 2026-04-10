CREATE TABLE IF NOT EXISTS shared_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  config jsonb NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS shared_views_active_idx
  ON shared_views (active)
  WHERE active = true;

ALTER TABLE shared_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active ON shared_views;
CREATE POLICY public_read_active ON shared_views
  FOR SELECT
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

INSERT INTO shared_views (name, config, created_by)
SELECT
  'Easter 2026 — Members View' AS name,
  '{
    "types": ["planner", "calendar", "library"],
    "yearCycle": "A",
    "season": "easter",
    "ensembleId": "generations",
    "startOccasionId": "easter-02-divine-mercy-a",
    "endOccasionId": "pentecost-a",
    "hiddenOccasionIds": ["easter-07-a", "pentecost-ext-vigil-abc"],
    "hidePastWeeks": false
  }'::jsonb AS config,
  'system-seed' AS created_by
WHERE NOT EXISTS (
  SELECT 1
  FROM shared_views
  WHERE name = 'Easter 2026 — Members View'
);
