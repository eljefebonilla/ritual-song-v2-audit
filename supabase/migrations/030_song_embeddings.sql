-- Migration 030: Song and verse embeddings with pgvector
-- 512-dim vectors from text-embedding-3-small, HNSW indexes for <50ms search

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE song_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) UNIQUE,
  embedding vector(512),
  source_text TEXT, -- what was embedded (title + refrain + first verse)
  model TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_se_embedding ON song_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE verse_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id),
  verse_label TEXT, -- '1', '2', 'Refrain'
  embedding vector(512),
  verse_text TEXT,
  model TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ve_song ON verse_embeddings(song_id);
CREATE INDEX idx_ve_embedding ON verse_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- RPC function for vector similarity search (used by scoring engine)
CREATE OR REPLACE FUNCTION match_songs_by_embedding(
  query_embedding vector(512),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  song_id UUID,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    se.song_id,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM song_embeddings se
  WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
$$;
