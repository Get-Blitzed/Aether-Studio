-- 0003_provider_secrets: adds encrypted-secret storage to the
-- provider_configurations table (created in 0001_init.sql but unused until
-- Phase 6), and a usage_json column to background_jobs for token/cost
-- estimate surfacing.
--
-- encrypted_secret holds ciphertext only (base64 of Electron's safeStorage
-- output) -- this repository layer never sees or handles a plaintext
-- secret; that boundary is enforced in apps/desktop/src/main/secretsStore.ts.

ALTER TABLE provider_configurations ADD COLUMN capability TEXT NOT NULL DEFAULT 'text';
ALTER TABLE provider_configurations ADD COLUMN is_default_for_capability INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_configurations ADD COLUMN encrypted_secret TEXT;

ALTER TABLE background_jobs ADD COLUMN provider_id TEXT;
ALTER TABLE background_jobs ADD COLUMN provider_name TEXT;
ALTER TABLE background_jobs ADD COLUMN usage_json TEXT;
