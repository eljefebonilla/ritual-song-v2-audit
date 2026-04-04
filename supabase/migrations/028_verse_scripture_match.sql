-- ============================================================
-- 028: Verse-Scripture Match Columns
-- Stores which verse of a song best matches the scripture reading,
-- enabling "V3: 'lyric text...'" display in recommendations.
-- ============================================================

ALTER TABLE scripture_song_mappings
  ADD COLUMN IF NOT EXISTS matched_verse_label TEXT,
  ADD COLUMN IF NOT EXISTS matched_verse_excerpt TEXT;
