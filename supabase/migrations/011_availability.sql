-- ============================================================
-- Migration 011: Musician Availability — extend choir_signups
-- ============================================================
-- Adds optional columns to choir_signups so instrumentalists
-- can also mark availability (not just vocalists).
-- voice_part is relaxed from NOT NULL to nullable.
-- musician_role and instrument_detail allow non-vocal signups.
-- notes allows a freeform note ("I can bring my acoustic guitar").
-- ============================================================

-- 1. Make voice_part nullable (was NOT NULL)
ALTER TABLE public.choir_signups
  ALTER COLUMN voice_part DROP NOT NULL;

-- 2. Relax the voice_part check to allow NULL
--    First drop the old constraint, then add a new one that permits NULL.
ALTER TABLE public.choir_signups
  DROP CONSTRAINT IF EXISTS choir_signups_voice_part_check;

ALTER TABLE public.choir_signups
  ADD CONSTRAINT choir_signups_voice_part_check
    CHECK (
      voice_part IS NULL
      OR voice_part IN ('Soprano', 'Alto', 'Tenor', 'Bass')
    );

-- 3. Add musician_role column (matches profiles.musician_role values)
ALTER TABLE public.choir_signups
  ADD COLUMN IF NOT EXISTS musician_role text
    DEFAULT 'vocalist'
    CHECK (musician_role IN ('vocalist', 'instrumentalist', 'cantor', 'both'));

-- 4. Add instrument_detail column (e.g. "Violin", "Acoustic Guitar")
ALTER TABLE public.choir_signups
  ADD COLUMN IF NOT EXISTS instrument_detail text;

-- 5. Add notes column (freeform: "I can bring my acoustic guitar")
ALTER TABLE public.choir_signups
  ADD COLUMN IF NOT EXISTS notes text;

-- 6. Back-fill existing rows: they are all vocalists
UPDATE public.choir_signups
  SET musician_role = 'vocalist'
  WHERE musician_role IS NULL;

-- Index for musician_role queries
CREATE INDEX IF NOT EXISTS idx_choir_signups_musician_role
  ON public.choir_signups(musician_role);
