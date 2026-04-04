-- ============================================================
-- 026: Scripture Song Mappings
-- Maps NPM Liturgy Help scripture-based music recommendations
-- to occasions and songs. Enables scripture-aware recommendations.
-- ============================================================

CREATE TABLE scripture_song_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to the occasion system (e.g., 'advent-01-a', 'ot-15-b')
  occasion_id TEXT NOT NULL,

  -- Reading section this song is recommended for
  reading_type TEXT NOT NULL CHECK (reading_type IN (
    'entrance_antiphon', 'first_reading', 'second_reading',
    'sequence', 'gospel', 'communion_antiphon'
  )),

  -- Scripture citation (e.g., 'Is 2:1-5', 'Mt 24:37-44')
  reading_reference TEXT,

  -- Summary or antiphon text
  reading_text TEXT,

  -- Song info from NPM
  song_title TEXT NOT NULL,
  song_codes TEXT NOT NULL,          -- Raw codes, e.g. 'OIF 458, VCS 67'

  -- Resolved FK to our library (NULL if unmatched)
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  match_method TEXT,                  -- 'exact_title', 'fuzzy_title', 'catalog_code', NULL

  source TEXT NOT NULL DEFAULT 'npm_liturgy_help',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Primary lookup: all scripture songs for an occasion
CREATE INDEX idx_ssm_occasion ON scripture_song_mappings(occasion_id);

-- Find all scripture mappings for a resolved song
CREATE INDEX idx_ssm_song_id ON scripture_song_mappings(song_id) WHERE song_id IS NOT NULL;

-- Composite for specific reading lookups
CREATE INDEX idx_ssm_occasion_reading ON scripture_song_mappings(occasion_id, reading_type);

-- RLS: read-only for authenticated users
ALTER TABLE scripture_song_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scripture_song_mappings_read"
  ON scripture_song_mappings FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (ingestion script)
CREATE POLICY "scripture_song_mappings_service_write"
  ON scripture_song_mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
