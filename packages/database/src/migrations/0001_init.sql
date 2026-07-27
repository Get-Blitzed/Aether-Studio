-- 0001_init: core application registry tables.
-- Project *content* (scripts, characters, scenes, etc.) lives in the .aether
-- project manifest on disk -- this database only tracks cross-project
-- metadata: known projects, settings, activity, background jobs, and the
-- global Character/Brand libraries surfaced on the Home screen.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  manifest_path TEXT NOT NULL UNIQUE,
  project_dir TEXT NOT NULL,
  production_type TEXT,
  stage TEXT,
  thumbnail_path TEXT,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  last_opened_at TEXT,
  is_missing INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects (last_opened_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress REAL NOT NULL DEFAULT 0,
  current_step TEXT,
  error TEXT,
  output_location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_project_id TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_project_id TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_configurations (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);
