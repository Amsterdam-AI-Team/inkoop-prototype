-- =========================================================
-- Inkoopstrategie Backend - init.sql
-- PostgreSQL + pgvector schema (lean MVP)
-- =========================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector

-- =========================================================
-- Helper: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE collection_status AS ENUM ('pending', 'in-progress', 'done');
-- =========================================================
-- USERS
-- - hashed_password: bewaar hier de hash (bv. bcrypt/argon2)
-- - idp_provider/idp_subject: placeholders voor Intra ID (federated auth)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  display_name   TEXT,
  hashed_password TEXT,
  idp_provider   TEXT,                       
  idp_subject    TEXT,                       
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_idp_idx ON users (idp_provider, idp_subject);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- COLLECTIONS (User 1 -> N Collections)
-- =========================================================
CREATE TABLE IF NOT EXISTS collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  status       collection_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collections_user_name_idx ON collections (user_id, name);

CREATE TRIGGER trg_collections_updated_at
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- FLOWS (Collection 1 -> N Flows) + 1:1 template in flow
-- =========================================================
CREATE TABLE IF NOT EXISTS flows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id    UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  context_content  TEXT,
  template_name    TEXT NOT NULL,
  template_content TEXT NOT NULL,
  status       collection_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flows_collection_name_idx ON flows (collection_id, name);

CREATE TRIGGER trg_flows_updated_at
BEFORE UPDATE ON flows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- DOCUMENTS (Flow 1 -> N Documents)
-- =========================================================
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  title        TEXT,
  mime_type    TEXT,
  text_content TEXT NOT NULL,
  size_bytes   BIGINT,
  tags         TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documents_flow_idx ON documents (flow_id);
CREATE INDEX IF NOT EXISTS documents_tags_gin ON documents USING GIN (tags);

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- DOCUMENT_CHUNKS (pgvector)
-- Embedding dimension: 1536 (pas aan indien ander model)
-- =========================================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal      INT  NOT NULL,
  content      TEXT NOT NULL,
  token_count  INT,
  embedding    VECTOR(1536) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_chunks_doc_idx ON document_chunks (document_id);

-- IVFFLAT index (cosine). Let op: eerst dataset vullen, daarna indexeren voor beste performance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'document_chunks_embedding_ivfflat_idx'
  ) THEN
    EXECUTE 'CREATE INDEX document_chunks_embedding_ivfflat_idx
             ON document_chunks USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 100);';
  END IF;
END$$;

-- =========================================================
-- FLOW_RUNS (Flow 1 -> N Runs)
-- =========================================================
CREATE TABLE IF NOT EXISTS flow_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id                UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  variables              JSONB,               -- ingevulde vars voor template bij deze run
  selected_document_ids  JSONB,               -- welke docs effectief gebruikt zijn bij retrieval/generatie
  started_at             TIMESTAMPTZ,
  finished_at            TIMESTAMPTZ,
  error                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS flow_runs_flow_idx ON flow_runs (flow_id);
CREATE INDEX IF NOT EXISTS flow_runs_status_idx ON flow_runs (status);

-- =========================================================
-- GENERATIONS (per run)
-- - model_name/prompt/response: handig voor traceability
-- =========================================================
CREATE TABLE IF NOT EXISTS generations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_run_id        UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  model_name         TEXT NOT NULL,
  prompt             TEXT NOT NULL,
  response           TEXT NOT NULL,        -- originele LLM output
  tokens_prompt      INT,
  tokens_completion  INT,
  latency_ms         INT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_response    TEXT,                 -- user-edit versie van de concepttekst
  edited_at          TIMESTAMPTZ,          -- laatst bewerkt door user
  is_user_edited     BOOLEAN DEFAULT FALSE -- markeert of er een edit is gedaan
);

CREATE INDEX IF NOT EXISTS generations_run_idx ON generations (flow_run_id);

-- =========================================================
-- OUTPUTS (per run)
-- =========================================================
CREATE TABLE IF NOT EXISTS outputs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_run_id  UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  title        TEXT,
  content      TEXT NOT NULL,
  format       TEXT NOT NULL CHECK (format IN ('markdown','plain','html','json')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS outputs_run_idx ON outputs (flow_run_id);

-- =========================================================
-- WEB SEARCHES
-- =========================================================
CREATE TABLE web_search_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Unieke ID voor elke rij
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE, -- Flow ID waaraan de web search is gekoppeld
    source_id TEXT NOT NULL, -- ID van de bron (bijv. "s1", "s2")
    url TEXT NOT NULL, -- URL van de bron
    title TEXT, -- Titel van de bron
    summary TEXT, -- Samenvatting van de bron
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Tijdstip van invoer
    include_in_result BOOLEAN DEFAULT FALSE,
    html_content TEXT
);

-- =========================================================
-- FLOW CHECKBOXES
-- =========================================================
CREATE TABLE flow_checkboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked BOOLEAN DEFAULT FALSE
);

-- =========================================================
-- WEB SEARCH RUNS
-- =========================================================
CREATE TABLE IF NOT EXISTS web_search_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  query        TEXT NOT NULL,
  max_results  INTEGER NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  num_sources  INTEGER,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  duration_ms  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- WEB SEARCH RUNS
-- =========================================================
CREATE TABLE IF NOT EXISTS web_search_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID NOT NULL REFERENCES web_search_runs(id) ON DELETE CASCADE,
  step        INTEGER,
  level       TEXT,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);