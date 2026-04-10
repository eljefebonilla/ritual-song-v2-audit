-- ============================================================
-- Migration 010: Profile enhancements + admin seeding
-- ============================================================
-- Adds:
--   1. musician_role column to profiles
--   2. instrument_detail column to profiles (more specific than instrument)
--   3. phone column if not present
--   4. admin_emails table + trigger for auto-promoting known admins
-- Idempotent: safe to run multiple times.

-- ============================================================
-- 1. ADD musician_role TO profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'musician_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN musician_role text DEFAULT 'vocalist'
      CHECK (musician_role IN ('vocalist', 'instrumentalist', 'cantor', 'both'));
  END IF;
END $$;
-- ============================================================
-- 2. ADD instrument_detail TO profiles
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'instrument_detail'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN instrument_detail text;
  END IF;
END $$;
-- ============================================================
-- 3. ENSURE phone column exists (should already from schema.sql)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
  END IF;
END $$;
-- ============================================================
-- 4. ADMIN_EMAILS table — stores emails that auto-promote to admin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY,
  added_by text,          -- who added this email (for audit trail)
  created_at timestamptz DEFAULT now()
);
-- RLS: only admins can see/manage admin_emails
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_emails' AND policyname = 'Admins can manage admin_emails'
  ) THEN
    CREATE POLICY "Admins can manage admin_emails"
      ON public.admin_emails FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;
-- ============================================================
-- 5. TRIGGER: auto-promote profiles whose email matches admin_emails
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_promote_admin()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE email = NEW.email) THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Drop and recreate to ensure it's up to date
DROP TRIGGER IF EXISTS promote_admin_on_insert ON public.profiles;
CREATE TRIGGER promote_admin_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_promote_admin();
