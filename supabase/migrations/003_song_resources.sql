-- ============================================================
-- 003: Song Resources — Supabase Storage + metadata table
-- ============================================================

-- 1. Song resources table
create table public.song_resources (
  id uuid default gen_random_uuid() primary key,
  song_id text not null,
  type text not null check (type in (
    'audio', 'sheet_music', 'practice_track', 'hymnal_ref',
    'notation', 'lyrics', 'ocp_link', 'youtube', 'other'
  )),
  label text not null,
  url text,
  storage_path text,
  source text default 'manual' check (source in (
    'local', 'supabase', 'ocp_bb', 'ocp_ss', 'youtube', 'manual'
  )),
  is_highlighted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.song_resources enable row level security;
create policy "Anyone authenticated can view song resources"
  on public.song_resources for select
  using (auth.role() = 'authenticated');
create policy "Admins can manage song resources"
  on public.song_resources for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
create index idx_song_resources_song_id on public.song_resources(song_id);
create trigger set_updated_at before update on public.song_resources
  for each row execute function public.handle_updated_at();
-- 2. Public storage bucket for song resources
insert into storage.buckets (id, name, public)
values ('song-resources', 'song-resources', true);
-- Admins can upload song resources
create policy "Admins can upload song resources"
  on storage.objects for insert
  with check (
    bucket_id = 'song-resources' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
-- Admins can delete song resources
create policy "Admins can delete song resources"
  on storage.objects for delete
  using (
    bucket_id = 'song-resources' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
