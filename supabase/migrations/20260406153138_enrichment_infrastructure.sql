CREATE TABLE enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id),
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  payload JSONB,
  result JSONB,
  verifier_result JSONB,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  written_at TIMESTAMPTZ
);

CREATE INDEX idx_eq_status ON enrichment_queue(status, priority);
CREATE INDEX idx_eq_song ON enrichment_queue(song_id);

CREATE TABLE enrichment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id),
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  model_used TEXT,
  verifier_model TEXT,
  verifier_confidence FLOAT,
  queue_item_id UUID REFERENCES enrichment_queue(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_el_song ON enrichment_log(song_id);

ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_enriched_tags JSONB DEFAULT '{}';;
