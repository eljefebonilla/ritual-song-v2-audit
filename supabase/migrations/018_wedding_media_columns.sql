-- ============================================================
-- 018: Add audio/YouTube preview links to sacramental songs
-- ============================================================

ALTER TABLE sacramental_songs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE sacramental_songs ADD COLUMN IF NOT EXISTS youtube_url TEXT;
