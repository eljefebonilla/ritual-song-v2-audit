-- ============================================================
-- 013: Resource Tags — structured tag system for song resources
-- ============================================================

-- Add tags array column (e.g. ['GTR', 'AIM'])
ALTER TABLE public.song_resources ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add visibility column (all = everyone, admin = admins only)
ALTER TABLE public.song_resources ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'all'
  CHECK (visibility IN ('all', 'admin'));

-- GIN index for fast tag lookups
CREATE INDEX IF NOT EXISTS idx_song_resources_tags ON public.song_resources USING GIN(tags);
