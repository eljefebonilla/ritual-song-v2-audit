create table public.parish_brand_config (
  id uuid default gen_random_uuid() primary key,
  parish_id uuid not null references public.parishes(id) on delete cascade,
  logo_url text,
  logo_storage_path text,
  parish_display_name text not null default '',
  primary_color text not null default '#333333',
  secondary_color text not null default '#666666',
  accent_color text not null default '#4A90D9',
  heading_font text not null default 'Playfair Display',
  body_font text not null default 'Inter',
  layout_preset text not null default 'modern' check (layout_preset in ('classic', 'modern', 'warm')),
  cover_style text not null default 'gradient' check (cover_style in ('photo', 'gradient', 'ai')),
  header_overlay_mode text not null default 'banner' check (header_overlay_mode in ('banner', 'replace')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint parish_brand_config_parish_unique unique (parish_id)
);

alter table public.parish_brand_config enable row level security;

create policy "Members can view parish brand config"
  on public.parish_brand_config for select
  using (
    exists (
      select 1 from public.parish_members
      where parish_members.parish_id = parish_brand_config.parish_id
      and parish_members.profile_id = auth.uid()
    )
  );

create policy "Admins can manage parish brand config"
  on public.parish_brand_config for all
  using (
    exists (
      select 1 from public.parish_members
      where parish_members.parish_id = parish_brand_config.parish_id
      and parish_members.profile_id = auth.uid()
      and parish_members.role in ('owner', 'admin')
    )
  );

create trigger set_updated_at before update on public.parish_brand_config
  for each row execute function public.handle_updated_at();;
