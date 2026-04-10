-- ============================================================
-- 014: Backfill resource tags from existing labels/filePaths
-- Run AFTER 013_resource_tags.sql
-- ============================================================

-- AIM resources (highlighted)
UPDATE public.song_resources
SET tags = array_append(tags, 'AIM')
WHERE is_highlighted = true
  AND NOT ('AIM' = ANY(tags));
-- Color resources (label or path contains 'clr' or 'color')
UPDATE public.song_resources
SET tags = array_append(tags, 'CLR')
WHERE (lower(label) LIKE '%clr%' OR lower(label) LIKE '%color%'
    OR lower(coalesce(storage_path, '')) LIKE '%clr%'
    OR lower(coalesce(storage_path, '')) LIKE '%color%')
  AND NOT ('CLR' = ANY(tags));
-- Guitar resources
UPDATE public.song_resources
SET tags = array_append(tags, 'GTR')
WHERE (lower(label) LIKE '%guitar%' OR lower(label) LIKE '%gtr%')
  AND NOT ('GTR' = ANY(tags))
  AND type = 'sheet_music';
-- Keyboard resources
UPDATE public.song_resources
SET tags = array_append(tags, 'KYB')
WHERE (lower(label) LIKE '%keyboard%' OR lower(label) LIKE '%kyb%' OR lower(label) LIKE '%piano%')
  AND NOT ('KYB' = ANY(tags))
  AND type = 'sheet_music';
-- SATB resources
UPDATE public.song_resources
SET tags = array_append(tags, 'SATB')
WHERE (lower(label) LIKE '%satb%')
  AND NOT lower(label) LIKE '%satb-s%'
  AND NOT lower(label) LIKE '%satb-a%'
  AND NOT lower(label) LIKE '%satb-t%'
  AND NOT lower(label) LIKE '%satb-b%'
  AND NOT ('SATB' = ANY(tags))
  AND type = 'sheet_music';
-- SAT resources (but not SATB)
UPDATE public.song_resources
SET tags = array_append(tags, 'SAT')
WHERE lower(label) LIKE '%sat%'
  AND NOT lower(label) LIKE '%satb%'
  AND NOT ('SAT' = ANY(tags))
  AND type = 'sheet_music';
-- Octavo resources
UPDATE public.song_resources
SET tags = array_append(tags, 'OCTAVO')
WHERE lower(label) LIKE '%octavo%'
  AND NOT ('OCTAVO' = ANY(tags))
  AND type = 'sheet_music';
-- Score / Lead Sheet (catch-all for untagged sheet_music)
UPDATE public.song_resources
SET tags = array_append(tags, 'SCORE')
WHERE type = 'sheet_music'
  AND tags = '{}'
  AND NOT lower(label) LIKE '%choral%'
  AND NOT lower(label) LIKE '%arrangement%';
