-- ============================================================
-- Migration 009: Rename "community" to "ensemble" across all tables
-- ============================================================
-- Standardizes column name from "community" to "ensemble" and
-- converts Title Case values to lowercase slugs.
-- Idempotent: safe to run multiple times.

-- ============================================================
-- 1. PROFILES: Rename column + update CHECK constraint + convert values
-- ============================================================

-- Rename column (idempotent via DO block)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'community'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN community TO ensemble;
  END IF;
END $$;

-- Drop old CHECK constraint and add new one with lowercase slug values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_community_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_ensemble_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ensemble_check
  CHECK (ensemble IN ('reflections', 'foundations', 'generations', 'heritage', 'elevations'));

-- Convert existing Title Case values to lowercase slugs
UPDATE public.profiles SET ensemble = LOWER(ensemble) WHERE ensemble IS NOT NULL AND ensemble <> LOWER(ensemble);

-- ============================================================
-- 2. MASS_EVENTS: Rename column + update CHECK constraint
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mass_events' AND column_name = 'community'
  ) THEN
    ALTER TABLE public.mass_events RENAME COLUMN community TO ensemble;
  END IF;
END $$;

-- Drop old CHECK constraint and add new one
ALTER TABLE public.mass_events DROP CONSTRAINT IF EXISTS mass_events_community_check;
ALTER TABLE public.mass_events DROP CONSTRAINT IF EXISTS mass_events_ensemble_check;
ALTER TABLE public.mass_events ADD CONSTRAINT mass_events_ensemble_check
  CHECK (ensemble IN ('Reflections', 'Foundations', 'Generations', 'Heritage', 'Elevations'));

-- Rename index (drop old, create new)
DROP INDEX IF EXISTS idx_mass_events_community;
CREATE INDEX IF NOT EXISTS idx_mass_events_ensemble ON public.mass_events(ensemble);

-- ============================================================
-- 3. ANNOUNCEMENTS: Rename column
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'community'
  ) THEN
    ALTER TABLE public.announcements RENAME COLUMN community TO ensemble;
  END IF;
END $$;

-- ============================================================
-- 4. MUSIC_PLAN_EDITS: Rename community_id column to ensemble_id
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'music_plan_edits' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE public.music_plan_edits RENAME COLUMN community_id TO ensemble_id;
  END IF;
END $$;

-- Recreate the primary key constraint with new column name
-- (The PK is on (occasion_id, community_id, field) — needs to reference ensemble_id)
-- Since RENAME COLUMN handles this automatically in Postgres, no action needed for PK.
-- But confirm the constraint name stays valid:
-- No action required — Postgres automatically updates constraint references on RENAME COLUMN.
