ALTER TABLE songs ADD COLUMN IF NOT EXISTS song_form JSONB;

COMMENT ON COLUMN songs.song_form IS 'Song structure analysis: { sections: [{type, label, startLine}], hasSoloOpportunity, soloSections }';
;
