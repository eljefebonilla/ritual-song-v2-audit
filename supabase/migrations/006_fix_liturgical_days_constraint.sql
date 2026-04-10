-- Fix: Replace expression-based unique index with regular unique constraint
-- The expression index doesn't work with Supabase PostgREST upsert

-- Drop the expression-based index
DROP INDEX IF EXISTS liturgical_days_date_province_idx;
-- Set default for ecclesiastical_province to '__universal__' instead of NULL
ALTER TABLE public.liturgical_days
  ALTER COLUMN ecclesiastical_province SET DEFAULT '__universal__';
-- Update any existing NULL values
UPDATE public.liturgical_days
  SET ecclesiastical_province = '__universal__'
  WHERE ecclesiastical_province IS NULL;
-- Make it NOT NULL
ALTER TABLE public.liturgical_days
  ALTER COLUMN ecclesiastical_province SET NOT NULL;
-- Create regular unique constraint
ALTER TABLE public.liturgical_days
  ADD CONSTRAINT liturgical_days_date_province_unique
  UNIQUE (date, ecclesiastical_province);
