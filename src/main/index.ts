import { randomUUID } from "node:crypto";
import {
  CHANNELS,
  type BridgeState,
  type ConnectResult,
  type DashboardLink,
  type QuotaResult,
  type ReadResult,
  type SaveSettingsResult,
  type Settings,
  type StartResult,
} from "../shared/types.js";
import { answerError, callApi, quotaView, readJob, type Fetch, type JobFacts } from "./api.js";
import { KeyStore, type SafeStorageLike } from "./key-store.js";
import { cleanBase, environmentOf, PRODUCTION, SettingsStore } from "./settings.js";

export { cleanBase, environmentOf, PRODUCTION } from "./settings.js";
export type { SafeStorageLike } from "./key-store.js";

/**
 * The main process half of the bridge. It holds the person's key, makes every Pomerado call, and
 * answers the window over IPC. The window gets job handles, never job ids, and never the key.
 * The kit doesn't import Electron; the app passes in the pieces it uses.
 */

type Sender = {
  id: number;
  once(event: "destroyed", listener: () => void): unknown;
  on(event: "did-start-navigation", listener: (...args: unknown[]) => void): unknown;
};

export type IpcMainLike = {
  handle(channel: string, listener: (event: { sender: Sender }, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
};

export type PomeradoMainOptions = {
  /** The app's name, which names the key it asks the person to make. */
  appName: string;
  /** Where the key and settings files live: Electron's userData folder. */
  userDataPath: string;
  ipcMain: IpcMainLike;
  safeStorage: SafeStorageLike;
  /** Opens an address in the system browser: Electron's shell.openExternal. */
  openExternal: (url: string) => Promise<void>;
  /** Electron's net.fetch, so calls follow the system's proxy settings. */
  fetch?: Fetch;
  /** The permissions the key link asks for. */
  keyPermissions?: string[];
  keyExpiresInDays?: number;
};

/** The full run permissions (decision AH6): find tools, run them, follow and cancel jobs, see logins and runs left. */
export const DEFAULT_KEY_PERMISSIONS = [
  "tools:read",
  "runs:create",
  "jobs:read",
  "jobs:cancel",
  "logins:read",
  "usage:read",
];

const KEY_SHAPE = /^pom_[A-Za-z0-9_-]{8,200}$/;
const TOOL_ID = /^tool_[0-9a-f]{32}$/;
const HANDLE = /^[0-9a-f-]{36}$/;
const ENDED = new Set(["succeeded", "failed", "cancelled"]);
/** How long a quit waits for cancels to reach Pomerado. */
const QUIT_CANCEL_MS = 3000;

type Tracked = JobFacts & { owner: number; createdAt: number };

export type PomeradoMain = {
  /** Cancel every job still running, such as before the app quits. Waits up to 3 s. */
  cancelAll(): Promise<void>;
  /** The addresses the app uses now. */
  settings(): Settings;
  dispose(): void;
};

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export function createPomeradoMain(options: PomeradoMainOptions): PomeradoMain {
  const fetcher: Fetch = options.fetch ?? ((url, init) => fetch(url, init));
  const keys = new KeyStore(options.userDataPath, options.safeStorage);
  const settingsStore = new SettingsStore(options.userDataPath);
  const jobs = new Map<string, Tracked>();
  const watched = new Set<number>();
  const permissions = options.keyPermissions ?? DEFAULT_KEY_PERMISSIONS;
  const expiresInDays = options.keyExpiresInDays ?? 90;

  const state = (): BridgeState => ({
    connected: keys.load() !== null,
    keyStorage: keys.storage,
    environment: environmentOf(settingsStore.get()),
    siteTimeoutMs: settingsStore.siteTimeoutMs(),
  });

  const api = (key: string, path: string, init?: Parameters<typeof callApi>[4]) =>
    callApi(fetcher, settingsStore.get().apiBase, key, path, init);

  function cancel(handle: string): Promise<void> {
    const job = jobs.get(handle);
    jobs.delete(handle);
    const key = keys.load();
    if (!job || ENDED.has(job.status) || job.repairing || key === null) return Promise.resolve();
    return api(key, `/jobs/${job.jobId}/cancel`, { method: "POST" }).then(() => undefined);
  }

  /** Cancels a window's running jobs when it reloads, navigates away or closes. */
  function cancelOwnedBy(owner: number) {
    for (const [handle, job] of jobs) if (job.owner === owner) void cancel(handle);
  }

  function watch(sender: Sender) {
    if (watched.has(sender.id)) return;
    watched.add(sender.id);
    const id = sender.id;
    sender.once("destroyed", () => {
      watched.delete(id);
      cancelOwnedBy(id);
    });
    sender.on("did-start-navigation", (...args: unknown[]) => {
      // Electron passes a details object first; older versions pass url, isInPlace, isMainFrame.
      const details = (args[0] ?? {}) as { isMainFrame?: boolean; isSameDocument?: boolean };
      const mainFrame = details.isMainFrame ?? args[3] === true;
      const sameDocument = details.isSameDocument ?? args[2] === true;
      if (mainFrame && !sameDocument) cancelOwnedBy(id);
    });
  }

  function dashboardLink(link: DashboardLink): string {
    const base = settingsStore.get().dashboardBase;
    const create = `/settings/api-keys?${new URLSearchParams({
      create: "1",
      name: options.appName,
      permissions: permissions.join(","),
      expires_in_days: String(expiresInDays),
    })}`;
    if (link === "createKey") return `${base}${create}`;
    if (link === "upgrade") return `${base}/upgrade`;
    // Sign-up returns to the key form, so step 1 runs straight into step 2.
    return `${base}/auth/sign-in?${new URLSearchParams({ screen: "sign-up", returnTo: create })}`;
  }

  const open = async (url: string) => {
    if (!isHttps(url)) return false;
    await options.openExternal(url);
    return true;
  };

  const handlers: Record<string, (sender: Sender, ...args: unknown[]) => unknown> = {
    [CHANNELS.state]: () => state(),

    [CHANNELS.connect]: async (_sender, raw): Promise<ConnectResult> => {
      const key = typeof raw === "string" ? raw.trim() : "";
      if (key === "") return { ok: false, reason: "empty" };
      if (!KEY_SHAPE.test(key)) return { ok: false, reason: "format" };
      const answer = await api(key, "/quota");
      if (answer === null) return { ok: false, reason: "unreachable" };
      if (answer.status === 200) {
        keys.save(key);
        return { ok: true, quota: quotaView(answer.body) };
      }
      if (answer.status === 401) return { ok: false, reason: "bad_key" };
      if (answer.status === 403) {
        return {
          ok: false,
          reason: answerError(answer)?.code === "key_permission_missing" ? "missing_permission" : "bad_key",
        };
      }
      return { ok: false, reason: "unavailable" };
    },

    [CHANNELS.disconnect]: async () => {
      await Promise.all([...jobs.keys()].map(cancel));
      keys.clear();
      return state();
    },

    [CHANNELS.quota]: async (): Promise<QuotaResult> => {
      const key = keys.load();
      if (key === null) return { ok: false, error: { code: "unauthorized", details: {} }, unreachable: false };
      const answer = await api(key, "/quota");
      if (answer === null) return { ok: false, error: null, unreachable: true };
      if (answer.status === 200) return { ok: true, quota: quotaView(answer.body) };
      return { ok: false, error: answerError(answer), unreachable: false };
    },

    [CHANNELS.run]: async (sender, toolId, input): Promise<StartResult> => {
      const key = keys.load();
      if (key === null) {
        return { ok: false, error: { code: "unauthorized", details: {} }, unreachable: false, status: 401 };
      }
      if (typeof toolId !== "string" || !TOOL_ID.test(toolId) || input === null || typeof input !== "object") {
        return { ok: false, error: { code: "invalid_request", details: {} }, unreachable: false, status: 400 };
      }
      watch(sender);
      // Read-only runs only: these apps never change a website without a confirm step.
      const answer = await api(key, "/runs/read-only", {
        method: "POST",
        body: { tool_id: toolId, input },
        idempotencyKey: randomUUID(),
      });
      if (answer === null) return { ok: false, error: null, unreachable: true, status: null };
      const handle = randomUUID();
      const read = answer.status === 200 || answer.status === 202 ? readJob(handle, answer.body, answer.headers) : null;
      if (read === null) {
        return { ok: false, error: answerError(answer), unreachable: false, status: answer.status };
      }
      jobs.set(handle, { ...read.facts, owner: sender.id, createdAt: Date.now() });
      return { ok: true, job: read.view };
    },

    [CHANNELS.job]: async (_sender, handle, includeResult): Promise<ReadResult> => {
      const job = typeof handle === "string" ? jobs.get(handle) : undefined;
      const key = keys.load();
      if (!job || key === null || typeof handle !== "string") {
        return { ok: false, error: { code: "not_found", details: {} }, transient: false, status: 404 };
      }
      const withResult = includeResult === true;
      const answer = await api(key, `/jobs/${job.jobId}${withResult ? "" : "?include_result=false"}`);
      if (answer === null) return { ok: false, error: null, transient: true, status: null };
      const error = answerError(answer);
      if (answer.status >= 500 && error === null) {
        return { ok: false, error: null, transient: true, status: answer.status };
      }
      const read = answer.status === 200 ? readJob(handle, answer.body, answer.headers) : null;
      if (read === null) return { ok: false, error, transient: false, status: answer.status };
      // A result is handed over once; after reading it the job is done with.
      if (withResult && ENDED.has(read.facts.status)) jobs.delete(handle);
      else jobs.set(handle, { ...job, ...read.facts });
      return { ok: true, job: read.view };
    },

    [CHANNELS.cancel]: async (_sender, handle) => {
      if (typeof handle === "string" && HANDLE.test(handle)) await cancel(handle);
    },

    [CHANNELS.answer]: async (_sender, handle) => {
      const job = typeof handle === "string" ? jobs.get(handle) : undefined;
      const url = job?.answerUrl ?? job?.watchUrl ?? null;
      return url === null ? false : open(url);
    },

    [CHANNELS.open]: async (_sender, link) => {
      if (link !== "signUp" && link !== "createKey" && link !== "upgrade") return false;
      return open(dashboardLink(link));
    },

    [CHANNELS.openUrl]: async (_sender, url) => (typeof url === "string" ? open(url) : false),

    [CHANNELS.settings]: () => settingsStore.get(),

    [CHANNELS.saveSettings]: async (_sender, raw): Promise<SaveSettingsResult> => {
      const given = (raw ?? {}) as Partial<Settings>;
      const apiBase = cleanBase(given.apiBase);
      if (apiBase === null) return { ok: false, field: "apiBase" };
      const dashboardBase = cleanBase(given.dashboardBase);
      if (dashboardBase === null) return { ok: false, field: "dashboardBase" };
      const before = settingsStore.get();
      const next = { apiBase, dashboardBase };
      // A key goes only to the API it was checked against.
      if (before.apiBase !== apiBase) {
        await Promise.all([...jobs.keys()].map(cancel));
        keys.clear();
      }
      settingsStore.save(next);
      return { ok: true, state: state(), settings: settingsStore.get() };
    },
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    options.ipcMain.handle(channel, (event, ...args) => handler(event.sender, ...args));
  }

  // Jobs nobody read for two hours are forgotten; Pomerado has erased their results by then.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [handle, job] of jobs) if (job.createdAt < cutoff) jobs.delete(handle);
  }, 10 * 60 * 1000);
  sweep.unref?.();

  return {
    async cancelAll() {
      const pending = Promise.all([...jobs.keys()].map(cancel));
      await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, QUIT_CANCEL_MS))]);
    },
    settings: () => settingsStore.get(),
    dispose() {
      clearInterval(sweep);
      for (const channel of Object.keys(handlers)) options.ipcMain.removeHandler(channel);
    },
  };
}

