CREATE TABLE scripture_song_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id TEXT NOT NULL,
  reading_type TEXT NOT NULL CHECK (reading_type IN (
    'entrance_antiphon', 'first_reading', 'second_reading',
    'sequence', 'gospel', 'communion_antiphon'
  )),
  reading_reference TEXT,
  reading_text TEXT,
  song_title TEXT NOT NULL,
  song_codes TEXT NOT NULL,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  match_method TEXT,
  source TEXT NOT NULL DEFAULT 'npm_liturgy_help',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ssm_occasion ON scripture_song_mappings(occasion_id);
CREATE INDEX idx_ssm_song_id ON scripture_song_mappings(song_id) WHERE song_id IS NOT NULL;
CREATE INDEX idx_ssm_occasion_reading ON scripture_song_mappings(occasion_id, reading_type);

ALTER TABLE scripture_song_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scripture_song_mappings_read"
  ON scripture_song_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "scripture_song_mappings_service_write"
  ON scripture_song_mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);;
