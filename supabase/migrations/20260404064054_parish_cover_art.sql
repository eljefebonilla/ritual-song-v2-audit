create table public.parish_cover_art (
  id uuid default gen_random_uuid() primary key,
  parish_id uuid not null references public.parishes(id) on delete cascade,
  occasion_code text not null,
  cycle text check (cycle in ('A', 'B', 'C', 'all')),
  image_url text,
  storage_path text,
  source text not null default 'uploaded' check (source in ('uploaded', 'gradient', 'ai_generated')),
  created_at timestamptz default now()
);

alter table public.parish_cover_art enable row level security;

create unique index idx_parish_cover_art_unique
  on public.parish_cover_art(parish_id, occasion_code, cycle);

create index idx_parish_cover_art_lookup
  on public.parish_cover_art(parish_id, occasion_code);

create policy "Members can view parish cover art"
  on public.parish_cover_art for select
  using (
    exists (
      select 1 from public.parish_members
      where parish_members.parish_id = parish_cover_art.parish_id
      and parish_members.profile_id = auth.uid()
    )
  );

create policy "Admins can manage parish cover art"
  on public.parish_cover_art for all
  using (
    exists (
      select 1 from public.parish_members
      where parish_members.parish_id = parish_cover_art.parish_id
      and parish_members.profile_id = auth.uid()
      and parish_members.role in ('owner', 'admin')
    )
  );;
