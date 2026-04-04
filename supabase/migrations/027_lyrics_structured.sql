-- ============================================================
-- 027: Structured Lyrics Storage
-- Adds JSONB column for parsed verse/refrain structure
-- alongside the existing plain-text lyrics_text column.
-- ============================================================

ALTER TABLE song_metadata
  ADD COLUMN IF NOT EXISTS lyrics_structured JSONB,
  ADD COLUMN IF NOT EXISTS lyrics_parsed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_song_metadata_lyrics
  ON song_metadata(song_id)
  WHERE lyrics_structured IS NOT NULL;
