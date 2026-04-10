ALTER TABLE scripture_song_mappings
  ADD COLUMN IF NOT EXISTS matched_verse_label TEXT,
  ADD COLUMN IF NOT EXISTS matched_verse_excerpt TEXT;;
