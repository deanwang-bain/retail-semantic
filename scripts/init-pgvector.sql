-- Enable pgvector for semantic similarity search over products, reviews, concepts.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embeddings (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,          -- 'product' | 'review' | 'concept'
  entity_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384) NOT NULL,   -- all-MiniLM-L6-v2 / Voyage lite dimensions
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embeddings_entity_type_idx ON embeddings (entity_type);
CREATE INDEX IF NOT EXISTS embeddings_entity_id_idx ON embeddings (entity_id);

-- IVFFlat index is created in scripts/seed.ts AFTER rows are loaded
-- (ivfflat needs data or recall is poor).
