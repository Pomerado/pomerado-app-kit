import type { ApiErrorView, JobStatus, JobView, QuotaView } from "../shared/types.js";

/**
 * Pomerado's REST API as the main process calls it, with the person's key. Each call has its own
 * deadline, and a call that can't reach Pomerado in time answers null.
 */

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type ApiAnswer = { status: number; body: unknown; headers: Headers };

const REQUEST_MS = 15_000;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export async function callApi(
  fetcher: Fetch,
  base: string,
  key: string,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
): Promise<ApiAnswer | null> {
  try {
    const response = await fetcher(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_MS),
    });
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body, headers: response.headers };
  } catch {
    return null;
  }
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;

/** An API error cut to its code and the details the kit reads. */
export function errorView(value: unknown): ApiErrorView | null {
  const error = record(value);
  if (!error || typeof error.code !== "string") return null;
  const details = record(error.details) ?? {};
  const pick = <T>(name: string, test: (item: unknown) => item is T) =>
    test(details[name]) ? { [name]: details[name] as T } : {};
  const isString = (item: unknown): item is string => typeof item === "string";
  const isNumber = (item: unknown): item is number => typeof item === "number";
  const available = strings(details.available);
  return {
    code: error.code,
    details: {
      ...pick("reason", isString),
      ...pick("reason_code", isString),
      ...pick("field", isString),
      ...pick("reset_at", isString),
      ...pick("permission", isString),
      ...pick("available_more", isNumber),
      ...(available ? { available } : {}),
    },
  };
}

/** The error an answer carries, from its `{ error }` envelope. */
export const answerError = (answer: ApiAnswer | null) => errorView(record(answer?.body)?.error);

const STATUSES = new Set<JobStatus>(["queued", "running", "needs_input", "succeeded", "failed", "cancelled"]);

/** What main keeps about a job, beside what the window sees. */
export type JobFacts = {
  jobId: string;
  status: JobStatus;
  repairing: boolean;
  answerUrl: string | null;
  watchUrl: string | null;
};

/** A job read from the API, as main keeps it and as the window sees it under `handle`. */
export function readJob(
  handle: string,
  body: unknown,
  headers: Headers,
): { facts: JobFacts; view: JobView } | null {
  const job = record(body);
  const status = job?.status;
  if (!job || typeof job.id !== "string" || typeof status !== "string" || !STATUSES.has(status as JobStatus)) {
    return null;
  }
  const request = record(job.input_request);
  const maintenance = record(job.maintenance);
  const repairing = maintenance?.status === "repairing";
  const resultStatus = job.result_status;
  const retryAfter = Number(headers.get("retry-after") ?? "");
  const facts: JobFacts = {
    jobId: job.id,
    status: status as JobStatus,
    repairing,
    answerUrl: typeof request?.answer_url === "string" ? request.answer_url : null,
    watchUrl: typeof job.watch_url === "string" ? job.watch_url : null,
  };
  const view: JobView = {
    handle,
    status: status as JobStatus,
    result: job.result ?? null,
    resultStatus:
      resultStatus === "available" || resultStatus === "delivered" || resultStatus === "expired"
        ? resultStatus
        : null,
    error: errorView(job.error),
    needsInput:
      status === "needs_input"
        ? { expiresAt: typeof request?.expires_at === "string" ? request.expires_at : null }
        : null,
    repairing,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  };
  return { facts, view };
}

/** Today's tool runs from GET /v1/quota, or null when Pomerado can't count them yet. */
export function quotaView(body: unknown): QuotaView | null {
  const calls = record(record(body)?.tool_calls);
  if (!calls || calls.status !== "ready") return null;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    remaining: count(calls.remaining),
    limit: count(calls.limit),
    resetsAt: typeof calls.resets_at === "string" ? calls.resets_at : null,
  };
}
