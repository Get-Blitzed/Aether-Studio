import { safeStorage } from "electron";
import type { Logger } from "@aether/core";

export interface SecretsStore {
  isAvailable(): boolean;
  encrypt(plaintext: string): string;
  decrypt(ciphertextBase64: string): string;
}

/**
 * Wraps Electron's `safeStorage` (DPAPI on Windows, Keychain on macOS,
 * libsecret on Linux) so provider API keys are encrypted at rest without
 * pulling in a native Node addon (the same build-toolchain risk avoided
 * for the database in Phase 1 -- see KNOWN_LIMITATIONS.md). Ciphertext is
 * base64-encoded for storage as TEXT in SQLite; this module is the only
 * place a plaintext secret exists outside of an active provider call.
 */
export function createSecretsStore(logger: Logger): SecretsStore {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.warn("OS-level secret encryption (Electron safeStorage) is unavailable on this machine; provider API keys cannot be saved.");
  }

  return {
    isAvailable: () => available,
    encrypt(plaintext: string): string {
      if (!available) throw new Error("Secret encryption is not available on this machine.");
      return safeStorage.encryptString(plaintext).toString("base64");
    },
    decrypt(ciphertextBase64: string): string {
      if (!available) throw new Error("Secret encryption is not available on this machine.");
      return safeStorage.decryptString(Buffer.from(ciphertextBase64, "base64"));
    },
  };
}
