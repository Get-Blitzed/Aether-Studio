import type { AetherDatabase } from "../db.js";
import { ProviderConfigSchema, type ProviderConfig, type ProviderKind, type ProviderCapability } from "@aether/shared-types";

interface ProviderConfigRow {
  id: string;
  provider_type: string;
  name: string;
  enabled: number;
  capability: string;
  is_default_for_capability: number;
  config_json: string;
  encrypted_secret: string | null;
  created_at: string;
  modified_at: string;
}

interface StoredConfigJson {
  baseUrl?: string;
  model?: string;
  requestTemplate?: string;
}

function rowToConfig(row: ProviderConfigRow): ProviderConfig {
  const extra: StoredConfigJson = JSON.parse(row.config_json || "{}");
  return ProviderConfigSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.provider_type,
    capability: row.capability,
    baseUrl: extra.baseUrl,
    model: extra.model,
    requestTemplate: extra.requestTemplate,
    enabled: Boolean(row.enabled),
    isDefaultForCapability: Boolean(row.is_default_for_capability),
    hasSecret: Boolean(row.encrypted_secret),
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  });
}

/**
 * Persists provider configurations and their encrypted secrets. This class
 * never encrypts/decrypts anything itself -- callers (main-process IPC,
 * via secretsStore.ts) hand it opaque ciphertext to store and read back.
 */
export class ProviderConfigRepository {
  constructor(private readonly db: AetherDatabase) {}

  list(): ProviderConfig[] {
    return this.db.raw
      .prepare("SELECT * FROM provider_configurations ORDER BY created_at ASC")
      .all<ProviderConfigRow>()
      .map(rowToConfig);
  }

  get(id: string): ProviderConfig | undefined {
    const row = this.db.raw.prepare("SELECT * FROM provider_configurations WHERE id = ?").get<ProviderConfigRow>(id);
    return row ? rowToConfig(row) : undefined;
  }

  /** Returns the raw encrypted secret (ciphertext, or null) for a provider, for the main process to decrypt. */
  getEncryptedSecret(id: string): string | null {
    const row = this.db.raw
      .prepare("SELECT encrypted_secret FROM provider_configurations WHERE id = ?")
      .get<{ encrypted_secret: string | null }>(id);
    return row?.encrypted_secret ?? null;
  }

  /**
   * Saves a provider config. `encryptedSecret` is optional: pass `undefined`
   * to leave an existing stored secret untouched, or an empty string to
   * clear it.
   */
  save(
    config: Omit<ProviderConfig, "hasSecret">,
    encryptedSecret: string | undefined,
  ): ProviderConfig {
    const now = config.modifiedAt;
    const configJson: StoredConfigJson = {
      baseUrl: config.baseUrl,
      model: config.model,
      requestTemplate: config.requestTemplate,
    };

    if (config.isDefaultForCapability) {
      this.db.raw
        .prepare("UPDATE provider_configurations SET is_default_for_capability = 0 WHERE capability = ? AND id != ?")
        .run(config.capability, config.id);
    }

    const existing = this.db.raw
      .prepare("SELECT encrypted_secret FROM provider_configurations WHERE id = ?")
      .get<{ encrypted_secret: string | null }>(config.id);
    const secretToStore = encryptedSecret === undefined ? (existing?.encrypted_secret ?? null) : encryptedSecret || null;

    this.db.raw
      .prepare(
        `INSERT INTO provider_configurations
           (id, provider_type, name, enabled, capability, is_default_for_capability, config_json, encrypted_secret, created_at, modified_at)
         VALUES (@id, @providerType, @name, @enabled, @capability, @isDefault, @configJson, @encryptedSecret, @createdAt, @modifiedAt)
         ON CONFLICT(id) DO UPDATE SET
           provider_type = excluded.provider_type,
           name = excluded.name,
           enabled = excluded.enabled,
           capability = excluded.capability,
           is_default_for_capability = excluded.is_default_for_capability,
           config_json = excluded.config_json,
           encrypted_secret = excluded.encrypted_secret,
           modified_at = excluded.modified_at`,
      )
      .run({
        id: config.id,
        providerType: config.kind satisfies ProviderKind,
        name: config.name,
        enabled: config.enabled ? 1 : 0,
        capability: config.capability satisfies ProviderCapability,
        isDefault: config.isDefaultForCapability ? 1 : 0,
        configJson: JSON.stringify(configJson),
        encryptedSecret: secretToStore,
        createdAt: config.createdAt,
        modifiedAt: now,
      });

    return this.get(config.id)!;
  }

  remove(id: string): void {
    this.db.raw.prepare("DELETE FROM provider_configurations WHERE id = ?").run(id);
  }
}
