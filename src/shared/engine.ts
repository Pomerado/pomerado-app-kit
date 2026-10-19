import { friendlyError, type FriendlyError, type LocalFailure } from "./errors.js";
import type { ApiErrorView, JobView, PomeradoBridge, ReadResult } from "./types.js";

/**
 * Fan-out: the same question to several sites at once, each followed to its end. Each site
 * gets its own status, its result shows as soon as it finishes, a site past its wait is
 * stopped, and leaving stops everything still running. Runs go through the bridge, so the key
 * stays in the main process.
 */

export type SiteRun = {
  key: string;
  label: string;
  /** Null when the app has no tool for this site here; the site fails with a plain message. */
  toolId: string | null;
  input: Record<string, unknown>;
  /** How long the site may run, not counting time spent waiting on the person. */
  timeoutMs: number;
};

export type SitePhase =
  | "waiting"
  | "searching"
  | "reading"
  | "returning"
  | "needs_input"
  | "done"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "skipped";

export type SiteState = {
  key: string;
  label: string;
  phase: SitePhase;
  /** Each finished run's result, first page first. */
  pages: unknown[];
  error: FriendlyError | null;
  /** The last page names a next page. */
  hasMore: boolean;
  loadingMore: boolean;
};

export type FanOutState = {
  sites: SiteState[];
  /** Set once a run is refused for the day's limit. */
  quota: { resetAt: string | null } | null;
  /** Set once Pomerado stops accepting the key. */
  authLost: boolean;
  /** Any site still running or loading more. */
  running: boolean;
};

export type RunBridge = Pick<PomeradoBridge, "run" | "job" | "cancel" | "answer">;

export type FanOutOptions = {
  sites: SiteRun[];
  bridge: RunBridge;
  onChange: (state: FanOutState) => void;
  /** Sites running at once. The rest wait their turn. */
  concurrency?: number;
  pollMs?: number;
  /** When "Searching" turns to "Reading results", a timer like Try it's, so long runs look alive. */
  readingAfterMs?: number;
  now?: () => number;
};

export type FanOut = {
  /** Stop every site still running and cancel its job. Call on leaving. */
  stop(): void;
  /** Fetch a done site's next page. */
  loadMore(key: string): void;
  /** Open the answer page of the question a site is waiting on. */
  answer(key: string): void;
  /** Run a failed or timed-out site again. */
  retry(key: string): void;
};

const LIVE_PHASES = new Set<SitePhase>(["waiting", "searching", "reading", "returning", "needs_input"]);
const LIVE_JOB = new Set(["queued", "running", "needs_input"]);
const READ_TRIES = 3;
const MAX_POLL_MS = 5000;

class Stopped extends Error {}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** The next page's cursor a result names, while it is still good. */
export function nextCursor(result: unknown, now = Date.now()): string | null {
  const data = record(result);
  const cursor = data?.next_cursor;
  if (typeof cursor !== "string" || cursor === "") return null;
  const expires = data?.next_cursor_expires_at;
  if (typeof expires === "string" && Date.parse(expires) <= now) return null;
  return cursor;
}

export function startFanOut(options: FanOutOptions): FanOut {
  const {
    sites,
    bridge,
    onChange,
    concurrency = 4,
    pollMs = 1000,
    readingAfterMs = 10_000,
    now = () => Date.now(),
  } = options;
  const controller = new AbortController();
  const signal = controller.signal;
  let states: SiteState[] = sites.map((site) => ({
    key: site.key,
    label: site.label,
    phase: "waiting",
    pages: [],
    error: null,
    hasMore: false,
    loadingMore: false,
  }));
  let quota: FanOutState["quota"] = null;
  let authLost = false;
  /** The job each site follows now, so stop and answer can reach it. */
  const live = new Map<string, JobView>();

  const emit = () =>
    onChange({
      sites: states.map((site) => ({ ...site })),
      quota,
      authLost,
      running: states.some((site) => LIVE_PHASES.has(site.phase) || site.loadingMore),
    });
  const update = (key: string, patch: Partial<SiteState>) => {
    states = states.map((site) => (site.key === key ? { ...site, ...patch } : site));
    emit();
  };
  const stateOf = (key: string) => states.find((site) => site.key === key);

  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Stopped());
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Stopped());
        },
        { once: true },
      );
    });

  /** A job read, tried again after a dropped connection or a server error. */
  async function read(handle: string, includeResult: boolean): Promise<ReadResult> {
    for (let attempt = 1; ; attempt += 1) {
      const answer = await bridge.job(handle, includeResult);
      if (signal.aborted) throw new Stopped();
      if (answer.ok || !answer.transient || attempt >= READ_TRIES) return answer;
      await sleep(pollMs * attempt);
    }
  }

  /** Records a refusal: the day's limit and a dead key are the whole search's, the rest the site's. */
  function refusal(site: SiteRun, error: ApiErrorView | LocalFailure | null, status: number | null) {
    const code = typeof error === "string" ? error : error?.code;
    if (code === "quota_exceeded") {
      const resetAt = typeof error === "object" && error ? (error.details.reset_at ?? null) : null;
      quota = { resetAt };
    }
    if (status === 401 || code === "unauthorized") authLost = true;
    return friendlyError(error, site.label);
  }

  /**
   * Starts one run and follows it to its end. Returns its result, or a problem. `paging` runs
   * fetch a next page, so they leave the site's status line alone.
   */
  async function follow(
    site: SiteRun,
    input: Record<string, unknown>,
    paging: boolean,
  ): Promise<{ result: unknown } | { problem: FriendlyError; phase: "failed" | "timed_out" }> {
    const setPhase = (phase: SitePhase) => {
      if (!paging && stateOf(site.key)?.phase !== phase) update(site.key, { phase });
    };
    if (site.toolId === null) return { problem: friendlyError("tool_missing", site.label), phase: "failed" };
    setPhase("searching");
    const started = await bridge.run(site.toolId, input);
    if (signal.aborted) {
      if (started.ok) void bridge.cancel(started.job.handle);
      throw new Stopped();
    }
    if (!started.ok) {
      const error = started.error ?? (started.unreachable ? "unreachable" : null);
      return { problem: refusal(site, error, started.status), phase: "failed" };
    }
    let job = started.job;
    live.set(site.key, job);
    let active = 0;
    let last = now();
    try {
      while (LIVE_JOB.has(job.status)) {
        const time = now();
        // Time spent waiting on the person doesn't count against the site's wait.
        if (job.status !== "needs_input") active += time - last;
        last = time;
        if (active > site.timeoutMs) {
          // A run Pomerado is fixing is left to finish; cancelling would stop the fix too.
          if (!job.repairing) void bridge.cancel(job.handle);
          return { problem: friendlyError("timed_out", site.label), phase: "timed_out" };
        }
        setPhase(job.status === "needs_input" ? "needs_input" : active >= readingAfterMs ? "reading" : "searching");
        const asked = job.retryAfterSeconds === null ? 0 : job.retryAfterSeconds * 1000;
        await sleep(Math.min(Math.max(pollMs, asked), MAX_POLL_MS));
        const polled = await read(job.handle, false);
        if (!polled.ok) {
          // Stop following a job we can't read; it ends on its own or by the main process.
          const error = polled.error ?? (polled.transient ? "unreachable" : null);
          return { problem: refusal(site, error, polled.status), phase: "failed" };
        }
        job = polled.job;
        live.set(site.key, job);
      }
    } finally {
      live.delete(site.key);
    }
    if (job.status === "succeeded") {
      let result = job.result;
      if ((result === null || result === undefined) && job.resultStatus === "available") {
        setPhase("returning");
        const final = await read(job.handle, true);
        if (!final.ok) {
          const error = final.error ?? (final.transient ? "unreachable" : null);
          return { problem: refusal(site, error, final.status), phase: "failed" };
        }
        result = final.job.result;
      }
      if (result === null || result === undefined) {
        return { problem: friendlyError({ code: "result_expired", details: {} }, site.label), phase: "failed" };
      }
      return { result };
    }
    if (job.status === "cancelled" && signal.aborted) throw new Stopped();
    return { problem: refusal(site, job.error, null), phase: "failed" };
  }

  async function runSite(site: SiteRun) {
    try {
      const outcome = await follow(site, site.input, false);
      if ("result" in outcome) {
        update(site.key, {
          phase: "done",
          pages: [outcome.result],
          error: null,
          hasMore: nextCursor(outcome.result, now()) !== null,
        });
      } else if (quota !== null && outcome.problem.action === "upgrade") {
        // The day's limit is the whole search's, said once in its own notice.
        update(site.key, { phase: "skipped", error: null });
      } else {
        update(site.key, { phase: outcome.phase, error: outcome.problem });
      }
    } catch (error) {
      if (!(error instanceof Stopped)) {
        update(site.key, { phase: "failed", error: friendlyError(null, site.label) });
      }
    }
  }

  // Workers take sites in order, at most `concurrency` at once, until the queue is empty or the
  // search can't go on (stopped, out of runs, or the key stopped working).
  let next = 0;
  const halted = () => signal.aborted || quota !== null || authLost;
  const worker = async () => {
    while (!halted() && next < sites.length) {
      const site = sites[next];
      next += 1;
      if (site) await runSite(site);
    }
  };
  void Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, sites.length)) }, worker)).then(
    () => {
      if (signal.aborted) return;
      const skipped = states.some((site) => site.phase === "waiting");
      if (!skipped) return;
      states = states.map((site) => (site.phase === "waiting" ? { ...site, phase: "skipped" } : site));
      emit();
    },
  );
  emit();

  return {
    stop() {
      if (signal.aborted) return;
      controller.abort();
      for (const job of live.values()) {
        if (!job.repairing) void bridge.cancel(job.handle);
      }
      live.clear();
      states = states.map((site) =>
        LIVE_PHASES.has(site.phase) || site.loadingMore
          ? { ...site, phase: LIVE_PHASES.has(site.phase) ? "cancelled" : site.phase, loadingMore: false }
          : site,
      );
      emit();
    },
    loadMore(key) {
      const site = sites.find((item) => item.key === key);
      const state = stateOf(key);
      if (!site || !state || state.phase !== "done" || state.loadingMore || signal.aborted) return;
      const cursor = nextCursor(state.pages[state.pages.length - 1], now());
      if (cursor === null) return update(key, { hasMore: false });
      update(key, { loadingMore: true, error: null });
      void follow(site, { ...site.input, cursor }, true)
        .then((outcome) => {
          const current = stateOf(key);
          if (!current) return;
          if ("result" in outcome) {
            update(key, {
              loadingMore: false,
              pages: [...current.pages, outcome.result],
              hasMore: nextCursor(outcome.result, now()) !== null,
            });
          } else {
            update(key, { loadingMore: false, error: outcome.problem });
          }
        })
        .catch(() => undefined);
    },
    answer(key) {
      const job = live.get(key);
      if (job) void bridge.answer(job.handle);
    },
    retry(key) {
      const site = sites.find((item) => item.key === key);
      const state = stateOf(key);
      if (!site || !state || signal.aborted || quota !== null || authLost) return;
      if (state.phase !== "failed" && state.phase !== "timed_out") return;
      update(key, { phase: "searching", error: null, pages: [], hasMore: false });
      void runSite(site);
    },
  };
}
