-- =========================================================
-- Migration 001: Admin role + App Settings + Collection/Flow Templates
-- =========================================================

-- 1. Add admin flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Simple key-value settings (system_prompt, app_title, brand_name)
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Collection templates (the "types" of collections an admin configures)
CREATE TABLE IF NOT EXISTS collection_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description  TEXT,
  template_content TEXT,
  enabled      BOOLEAN DEFAULT TRUE,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case the table already exists, add the column
ALTER TABLE collection_templates ADD COLUMN IF NOT EXISTS template_content TEXT;

-- Also add template_content to user-facing collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS template_content TEXT;

DROP TRIGGER IF EXISTS trg_collection_templates_updated_at ON collection_templates;
CREATE TRIGGER trg_collection_templates_updated_at
BEFORE UPDATE ON collection_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Flow templates (belong to a collection template)
CREATE TABLE IF NOT EXISTS flow_templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_template_id UUID NOT NULL REFERENCES collection_templates(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  description            TEXT,
  template_name          TEXT NOT NULL,
  template_content       TEXT NOT NULL,
  sort_order             INT DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flow_templates_collection_idx ON flow_templates (collection_template_id);

DROP TRIGGER IF EXISTS trg_flow_templates_updated_at ON flow_templates;
CREATE TRIGGER trg_flow_templates_updated_at
BEFORE UPDATE ON flow_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- Seed initial admin users
-- =========================================================
-- Password for both: secret123! (bcrypt hash, 12 rounds)
-- Generated with: bcrypt.hashpw(b'secret123!', bcrypt.gensalt(rounds=12))
INSERT INTO users (email, display_name, hashed_password, is_admin)
VALUES
  ('j.baas@example.com', 'J. Baas', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', TRUE),
  ('k.bouwens@example.com', 'K. Bouwens', '$2b$12$nEWLrALn8hOSBtxv1cm8ue6O4geZAadwBCUN35/cjZ8MmfGDHNbPO', TRUE)
ON CONFLICT (email) DO NOTHING;
