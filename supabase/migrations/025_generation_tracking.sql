-- ============================================================
-- 025: Generation Tracking — status columns on setlists for PDF generation
-- ============================================================

-- Track generation state on the setlist itself
alter table public.setlists
  add column if not exists generation_status text
    default 'idle'
    check (generation_status in ('idle', 'generating', 'ready', 'outdated', 'failed')),
  add column if not exists generated_at timestamptz,
  add column if not exists setlist_pdf_path text,
  add column if not exists setlist_pdf_url text,
  add column if not exists worship_aid_pdf_path text,
  add column if not exists worship_aid_pdf_url text,
  add column if not exists generation_error text,
  add column if not exists content_hash text;

-- Index for polling generation status
create index if not exists idx_setlists_generation_status
  on public.setlists(generation_status)
  where generation_status in ('generating', 'outdated');
