ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_url_verified_at TIMESTAMPTZ;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_url_source TEXT;

COMMENT ON COLUMN songs.youtube_url IS 'YouTube video URL for song playback fallback';
COMMENT ON COLUMN songs.youtube_url_verified_at IS 'Last time oEmbed confirmed this URL is live';
COMMENT ON COLUMN songs.youtube_url_source IS 'How the URL was obtained: manual, ai_auto, ai_reviewed, occasion_json';;
