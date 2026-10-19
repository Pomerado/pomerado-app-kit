import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Environment, Settings } from "../shared/types.js";

/**
 * Where the app reaches Pomerado: the API and the Dashboard. Production by default; the settings
 * screen can point both elsewhere, such as Pomerado's staging, and a local fake API answers on a
 * loopback address during development and tests.
 */

export const PRODUCTION: Settings = {
  apiBase: "https://api.pomerado.ai/v1",
  dashboardBase: "https://app.pomerado.ai",
};

const FILE = "pomerado-settings.json";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** A clean base address, or null. https only, except plain http on this computer. */
export function cleanBase(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const local = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

export function environmentOf(settings: Settings): Environment {
  if (settings.apiBase === PRODUCTION.apiBase) return "production";
  try {
    if (LOOPBACK.has(new URL(settings.apiBase).hostname)) return "local";
  } catch {
    // cleanBase already refused anything that isn't a URL.
  }
  return "staging";
}

type Stored = Partial<Settings> & { siteTimeoutSeconds?: unknown };

export class SettingsStore {
  private readonly path: string;

  constructor(private readonly directory: string) {
    this.path = join(directory, FILE);
  }

  private read(): Stored {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
      return parsed !== null && typeof parsed === "object" ? (parsed as Stored) : {};
    } catch {
      return {};
    }
  }

  get(): Settings {
    const stored = this.read();
    return {
      apiBase: cleanBase(stored.apiBase) ?? PRODUCTION.apiBase,
      dashboardBase: cleanBase(stored.dashboardBase) ?? PRODUCTION.dashboardBase,
    };
  }

  /** A development override for every site's wait, from the settings file only. */
  siteTimeoutMs(): number | null {
    const seconds = this.read().siteTimeoutSeconds;
    return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }

  save(settings: Settings) {
    mkdirSync(this.directory, { recursive: true });
    const { siteTimeoutSeconds } = this.read();
    writeFileSync(this.path, JSON.stringify({ ...settings, siteTimeoutSeconds }, null, 2));
  }
}
