-- Add tags and visibility columns to song_resources_v2 (matching song_resources schema from 013)
ALTER TABLE song_resources_v2 ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE song_resources_v2 ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'all';
