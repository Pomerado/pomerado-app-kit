import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The person's Pomerado key, encrypted with the operating system's keychain through Electron's
 * safeStorage. It is never written in plain text. Where the system offers no real keychain
 * (Linux without a secret service, where safeStorage falls back to a fixed password), the key
 * stays in memory until the app closes.
 */

export type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend?: () => string;
};

const FILE = "pomerado-key.bin";

export class KeyStore {
  private memory: string | null = null;
  readonly storage: "keychain" | "memory";
  private readonly path: string;

  constructor(
    private readonly directory: string,
    private readonly safeStorage: SafeStorageLike,
  ) {
    this.path = join(directory, FILE);
    const backend = safeStorage.getSelectedStorageBackend?.();
    const real = safeStorage.isEncryptionAvailable() && backend !== "basic_text" && backend !== "unknown";
    this.storage = real ? "keychain" : "memory";
    if (!real) rmSync(this.path, { force: true });
  }

  load(): string | null {
    if (this.memory !== null || this.storage === "memory") return this.memory;
    try {
      this.memory = this.safeStorage.decryptString(readFileSync(this.path));
    } catch {
      // Missing, or written by another keychain: it can't be read, so it's gone.
      rmSync(this.path, { force: true });
      this.memory = null;
    }
    return this.memory;
  }

  save(key: string) {
    this.memory = key;
    if (this.storage === "memory") return;
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.path, this.safeStorage.encryptString(key), { mode: 0o600 });
  }

  clear() {
    this.memory = null;
    rmSync(this.path, { force: true });
  }
}
