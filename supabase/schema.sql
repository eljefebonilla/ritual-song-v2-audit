-- ============================================================
-- St. Monica Music Ministry — Database Schema
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  phone text,
  community text check (community in (
    'Reflections', 'Foundations', 'Generations', 'Heritage', 'Elevations'
  )),
  voice_part text check (voice_part in ('Soprano', 'Alto', 'Tenor', 'Bass')),
  instrument text,
  role text not null default 'member' check (role in ('admin', 'member')),
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Everyone can read profiles
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Users can insert their own profile (on signup)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- 2. EMERGENCY CONTACTS
-- ============================================================
create table public.emergency_contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  contact_name text not null,
  relationship text not null,
  phone text not null,
  email text,
  is_primary boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.emergency_contacts enable row level security;

-- Users can manage their own emergency contacts
create policy "Users can view own emergency contacts"
  on public.emergency_contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert own emergency contacts"
  on public.emergency_contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own emergency contacts"
  on public.emergency_contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete own emergency contacts"
  on public.emergency_contacts for delete
  using (auth.uid() = user_id);

-- Admins can view all emergency contacts
create policy "Admins can view all emergency contacts"
  on public.emergency_contacts for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 3. COMPLIANCE TYPES
-- ============================================================
create table public.compliance_types (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  renewal_months int, -- null = no renewal needed
  info_url text,      -- link to sign up for classes
  created_at timestamptz default now()
);

alter table public.compliance_types enable row level security;

create policy "Anyone authenticated can view compliance types"
  on public.compliance_types for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage compliance types"
  on public.compliance_types for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Seed default compliance types for Archdiocese of LA
insert into public.compliance_types (name, description, renewal_months, info_url) values
  ('Fingerprint Clearance', 'Live Scan fingerprinting required by the Archdiocese of Los Angeles', null, 'https://lacatholics.org/fingerprinting/'),
  ('VIRTUS Training', 'Protecting God''s Children awareness training', 60, 'https://www.virtusonline.org/'),
  ('Safe Environment Renewal', 'Annual safe environment training renewal', 12, 'https://lacatholics.org/safe-environment/');

-- ============================================================
-- 4. COMPLIANCE RECORDS
-- ============================================================
create table public.compliance_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  compliance_type_id uuid references public.compliance_types(id) on delete cascade not null,
  completed_date date not null,
  expiry_date date,
  document_url text, -- file path in Supabase Storage
  notes text,
  verified_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.compliance_records enable row level security;

-- Users can view their own compliance records
create policy "Users can view own compliance records"
  on public.compliance_records for select
  using (auth.uid() = user_id);

-- Users can insert their own records
create policy "Users can insert own compliance records"
  on public.compliance_records for insert
  with check (auth.uid() = user_id);

-- Users can update their own records
create policy "Users can update own compliance records"
  on public.compliance_records for update
  using (auth.uid() = user_id);

-- Admins can view and manage all compliance records
create policy "Admins can view all compliance records"
  on public.compliance_records for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update all compliance records"
  on public.compliance_records for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 5. MASS EVENTS
-- ============================================================
create table public.mass_events (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  event_date date not null,
  start_time time not null,
  end_time time,
  location text default 'St. Monica Catholic Community',
  event_type text default 'mass' check (event_type in (
    'mass', 'rehearsal', 'special', 'holy_day', 'funeral', 'wedding'
  )),
  community text check (community in (
    'Reflections', 'Foundations', 'Generations', 'Heritage', 'Elevations'
  )),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.mass_events enable row level security;

create policy "Anyone authenticated can view mass events"
  on public.mass_events for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage mass events"
  on public.mass_events for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 6. MINISTRY ROLES (for mass signups)
-- ============================================================
create table public.ministry_roles (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.ministry_roles enable row level security;

create policy "Anyone authenticated can view ministry roles"
  on public.ministry_roles for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage ministry roles"
  on public.ministry_roles for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Seed default ministry roles
insert into public.ministry_roles (name, description, sort_order) values
  ('Cantor', 'Lead vocalist for the assembly', 1),
  ('Choir', 'Choir ensemble member', 2),
  ('Organist', 'Organ/keyboard player', 3),
  ('Guitarist', 'Guitar accompaniment', 4),
  ('Bassist', 'Bass guitar or upright bass', 5),
  ('Drummer', 'Percussion/drums', 6),
  ('Instrumentalist', 'Other instruments (flute, violin, etc.)', 7),
  ('Music Director', 'Directs the ensemble for the liturgy', 8),
  ('Psalmist', 'Proclaims the responsorial psalm', 9);

-- ============================================================
-- 7. MASS ROLE SLOTS (how many of each role needed per mass)
-- ============================================================
create table public.mass_role_slots (
  id uuid default uuid_generate_v4() primary key,
  mass_event_id uuid references public.mass_events(id) on delete cascade not null,
  ministry_role_id uuid references public.ministry_roles(id) on delete cascade not null,
  slots_needed int not null default 1,
  created_at timestamptz default now()
);

alter table public.mass_role_slots enable row level security;

create policy "Anyone authenticated can view mass role slots"
  on public.mass_role_slots for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage mass role slots"
  on public.mass_role_slots for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 8. SIGNUPS
-- ============================================================
create table public.signups (
  id uuid default uuid_generate_v4() primary key,
  mass_event_id uuid references public.mass_events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ministry_role_id uuid references public.ministry_roles(id) on delete cascade not null,
  status text default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(mass_event_id, user_id, ministry_role_id)
);

alter table public.signups enable row level security;

-- Anyone can view signups
create policy "Anyone authenticated can view signups"
  on public.signups for select
  using (auth.role() = 'authenticated');

-- Users can manage their own signups
create policy "Users can insert own signups"
  on public.signups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own signups"
  on public.signups for update
  using (auth.uid() = user_id);

create policy "Users can delete own signups"
  on public.signups for delete
  using (auth.uid() = user_id);

-- Admins can manage all signups
create policy "Admins can manage all signups"
  on public.signups for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 9. ANNOUNCEMENTS
-- ============================================================
create table public.announcements (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  body text not null,
  author_id uuid references public.profiles(id) on delete set null,
  pinned boolean default false,
  community text, -- null = all communities
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.announcements enable row level security;

create policy "Anyone authenticated can view announcements"
  on public.announcements for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage announcements"
  on public.announcements for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 10. COMMENTS
-- ============================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  announcement_id uuid references public.announcements(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Anyone authenticated can view comments"
  on public.comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can post comments"
  on public.comments for insert
  with check (auth.uid() = author_id);

create policy "Users can update own comments"
  on public.comments for update
  using (auth.uid() = author_id);

create policy "Users can delete own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

create policy "Admins can manage all comments"
  on public.comments for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 11. STORAGE BUCKET for compliance documents
-- ============================================================
insert into storage.buckets (id, name, public)
values ('compliance-docs', 'compliance-docs', false);

-- Users can upload their own compliance docs
create policy "Users can upload own compliance docs"
  on storage.objects for insert
  with check (
    bucket_id = 'compliance-docs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own compliance docs
create policy "Users can view own compliance docs"
  on storage.objects for select
  using (
    bucket_id = 'compliance-docs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own compliance docs
create policy "Users can delete own compliance docs"
  on storage.objects for delete
  using (
    bucket_id = 'compliance-docs' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can view all compliance docs
create policy "Admins can view all compliance docs"
  on storage.objects for select
  using (
    bucket_id = 'compliance-docs' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ============================================================
-- 12. HELPER FUNCTION: auto-update updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.emergency_contacts
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.compliance_records
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.mass_events
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.signups
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.announcements
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.comments
  for each row execute function public.handle_updated_at();
