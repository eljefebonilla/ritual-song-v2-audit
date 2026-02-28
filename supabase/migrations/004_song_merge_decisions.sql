-- ============================================================
-- 004: Song Merge Decisions — audit trail for duplicate review
-- ============================================================

create table public.song_merge_decisions (
  id uuid default gen_random_uuid() primary key,
  song_id_a text not null,
  song_id_b text not null,
  decision text not null check (decision in ('merged', 'dismissed')),
  created_at timestamptz default now()
);

alter table public.song_merge_decisions enable row level security;

create policy "Admins can manage merge decisions"
  on public.song_merge_decisions for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Service role key bypass for server-side operations
create policy "Service role full access to merge decisions"
  on public.song_merge_decisions for all
  using (auth.role() = 'service_role');
