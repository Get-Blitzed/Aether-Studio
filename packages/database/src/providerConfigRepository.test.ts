import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDatabase, type AetherDatabase } from "./db.js";
import { ProviderConfigRepository } from "./repositories/providerConfigRepository.js";

describe("ProviderConfigRepository", () => {
  let dbPath: string;
  let database: AetherDatabase;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `aether-providers-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = await openDatabase(dbPath);
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  function sampleConfig() {
    const timestamp = new Date().toISOString();
    return {
      id: "provider_1",
      name: "Local Mock",
      kind: "mock" as const,
      capability: "text" as const,
      enabled: true,
      isDefaultForCapability: true,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
  }

  it("saves and lists provider configs without ever exposing a secret value", () => {
    const repo = new ProviderConfigRepository(database);
    repo.save(sampleConfig(), "ciphertext-blob");
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Local Mock");
    expect(list[0]?.hasSecret).toBe(true);
    expect(list[0]).not.toHaveProperty("secret");
    expect(list[0]).not.toHaveProperty("encryptedSecret");
  });

  it("retrieves the encrypted secret separately for main-process decryption", () => {
    const repo = new ProviderConfigRepository(database);
    repo.save(sampleConfig(), "ciphertext-blob");
    expect(repo.getEncryptedSecret("provider_1")).toBe("ciphertext-blob");
    expect(repo.getEncryptedSecret("missing")).toBeNull();
  });

  it("leaves an existing secret untouched when re-saving with encryptedSecret undefined", () => {
    const repo = new ProviderConfigRepository(database);
    const config = sampleConfig();
    repo.save(config, "ciphertext-blob");
    repo.save({ ...config, name: "Renamed" }, undefined);
    expect(repo.getEncryptedSecret("provider_1")).toBe("ciphertext-blob");
    expect(repo.get("provider_1")?.name).toBe("Renamed");
  });

  it("clears a secret when re-saving with an empty string", () => {
    const repo = new ProviderConfigRepository(database);
    const config = sampleConfig();
    repo.save(config, "ciphertext-blob");
    repo.save(config, "");
    expect(repo.getEncryptedSecret("provider_1")).toBeNull();
    expect(repo.get("provider_1")?.hasSecret).toBe(false);
  });

  it("only allows one default provider per capability", () => {
    const repo = new ProviderConfigRepository(database);
    const first = sampleConfig();
    repo.save(first, undefined);
    const second = { ...sampleConfig(), id: "provider_2", name: "Second" };
    repo.save(second, undefined);

    expect(repo.get("provider_1")?.isDefaultForCapability).toBe(false);
    expect(repo.get("provider_2")?.isDefaultForCapability).toBe(true);
  });

  it("removes a provider config", () => {
    const repo = new ProviderConfigRepository(database);
    repo.save(sampleConfig(), undefined);
    repo.remove("provider_1");
    expect(repo.list()).toHaveLength(0);
  });
});
