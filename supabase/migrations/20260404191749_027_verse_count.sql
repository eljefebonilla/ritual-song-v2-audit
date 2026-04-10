alter table public.songs add column if not exists verse_count integer;
comment on column public.songs.verse_count is 'Number of verses in the song. Used by setlist builder for solo assignment helpers.';;
