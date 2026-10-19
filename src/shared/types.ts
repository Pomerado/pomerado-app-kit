/**
 * The shapes that cross the bridge between Electron's main process and the app's window. The
 * window sees opaque job handles, never job ids, keys or answer page addresses.
 */

export type JobStatus = "queued" | "running" | "needs_input" | "succeeded" | "failed" | "cancelled";

/** The parts of a Pomerado error the kit reads. Never its message, which is written for developers. */
export type ApiErrorView = {
  code: string;
  details: {
    reason?: string;
    reason_code?: string;
    field?: string;
    available?: string[];
    available_more?: number;
    reset_at?: string;
    permission?: string;
  };
};

/** A job as the window sees it. */
export type JobView = {
  handle: string;
  status: JobStatus;
  result: unknown;
  resultStatus: "available" | "delivered" | "expired" | null;
  error: ApiErrorView | null;
  /** Set while the job waits on the person. The answer page opens from main, by handle. */
  needsInput: { expiresAt: string | null } | null;
  /** Pomerado is fixing the tool this run needs. The window shows the same words as any run. */
  repairing: boolean;
  /** Seconds the API asked to wait before the next read, when it said. */
  retryAfterSeconds: number | null;
};

/** Today's runs, from GET /v1/quota. A null limit is unlimited. */
export type QuotaView = {
  remaining: number | null;
  limit: number | null;
  resetsAt: string | null;
};

export type ConnectFailure =
  | "empty"
  | "format"
  | "bad_key"
  | "missing_permission"
  | "unreachable"
  | "unavailable";

export type ConnectResult = { ok: true; quota: QuotaView | null } | { ok: false; reason: ConnectFailure };

export type QuotaResult =
  | { ok: true; quota: QuotaView | null }
  | { ok: false; error: ApiErrorView | null; unreachable: boolean };

export type StartResult =
  | { ok: true; job: JobView }
  | { ok: false; error: ApiErrorView | null; unreachable: boolean; status: number | null };

export type ReadResult =
  | { ok: true; job: JobView }
  | { ok: false; error: ApiErrorView | null; transient: boolean; status: number | null };

export type Environment = "production" | "staging" | "local";

export type BridgeState = {
  connected: boolean;
  /** keychain: saved encrypted by the OS. memory: kept only until the app closes. */
  keyStorage: "keychain" | "memory";
  environment: Environment;
  /** A per-site wait the settings file sets, for development. Null uses each site's own. */
  siteTimeoutMs: number | null;
};

export type Settings = {
  apiBase: string;
  dashboardBase: string;
};

export type SaveSettingsResult =
  | { ok: true; state: BridgeState; settings: Settings }
  | { ok: false; field: "apiBase" | "dashboardBase" };

export type DashboardLink = "signUp" | "createKey" | "upgrade";

/** What `window.pomerado` offers. Every call goes to the main process. */
export type PomeradoBridge = {
  state(): Promise<BridgeState>;
  connect(key: string): Promise<ConnectResult>;
  disconnect(): Promise<BridgeState>;
  quota(): Promise<QuotaResult>;
  run(toolId: string, input: Record<string, unknown>): Promise<StartResult>;
  job(handle: string, includeResult: boolean): Promise<ReadResult>;
  cancel(handle: string): Promise<void>;
  answer(handle: string): Promise<boolean>;
  open(link: DashboardLink): Promise<boolean>;
  openUrl(url: string): Promise<boolean>;
  settings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<SaveSettingsResult>;
};

/** The IPC channel names, shared by main and preload. */
export const CHANNELS = {
  state: "pomerado:state",
  connect: "pomerado:connect",
  disconnect: "pomerado:disconnect",
  quota: "pomerado:quota",
  run: "pomerado:run",
  job: "pomerado:job",
  cancel: "pomerado:cancel",
  answer: "pomerado:answer",
  open: "pomerado:open",
  openUrl: "pomerado:open-url",
  settings: "pomerado:settings",
  saveSettings: "pomerado:save-settings",
} as const;
