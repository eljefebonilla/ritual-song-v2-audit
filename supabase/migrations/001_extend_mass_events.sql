-- Extend mass_events table for full ministry calendar support
-- Run this migration against your Supabase database

-- Add new columns to mass_events
alter table public.mass_events
  add column if not exists day_of_week text,
  add column if not exists has_music boolean default false,
  add column if not exists is_auto_mix boolean default false,
  add column if not exists celebrant text,
  add column if not exists notes text,
  add column if not exists sidebar_note text,
  add column if not exists occasion_id text,
  add column if not exists liturgical_week text,
  add column if not exists liturgical_name text,
  add column if not exists season text,
  add column if not exists season_emoji text,
  add column if not exists start_time_12h text,
  add column if not exists end_time_12h text;

-- Update event_type check to include all calendar event types
alter table public.mass_events drop constraint if exists mass_events_event_type_check;
alter table public.mass_events add constraint mass_events_event_type_check
  check (event_type in (
    'mass', 'rehearsal', 'special', 'holy_day', 'funeral', 'wedding',
    'school', 'sacrament', 'devotion', 'holiday', 'meeting', 'other'
  ));

-- Allow null community (some events are parish-wide)
alter table public.mass_events alter column community drop not null;

-- Allow null start_time (for all-day events)
alter table public.mass_events alter column start_time drop not null;

-- Index for common queries
create index if not exists idx_mass_events_date on public.mass_events(event_date);
create index if not exists idx_mass_events_community on public.mass_events(community);
create index if not exists idx_mass_events_liturgical_week on public.mass_events(liturgical_week);
