-- Migration 029: Enrichment infrastructure
-- Adds enrichment_queue, enrichment_log, and ai_enriched_tags to songs

CREATE TABLE enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id),
  task_type TEXT NOT NULL, -- 'classify_function', 'extract_topics', 'embed_song', 'embed_verses', 'match_scripture'
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, verified, written, failed, human_review
  priority INTEGER DEFAULT 5,
  payload JSONB, -- task-specific data
  result JSONB, -- AI output before verification
  verifier_result JSONB, -- verification harness output
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

-- AI-generated tags stored separately from human-curated fields
ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_enriched_tags JSONB DEFAULT '{}';
