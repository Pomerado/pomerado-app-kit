import { KIT_COPY } from "./copy.js";
import type { ApiErrorView } from "./types.js";

/**
 * One table from Pomerado's error codes (docs.pomerado.ai/errors) to what a person reads: a
 * title, a next step and the one action that helps. Raw codes never reach the screen, and no
 * entry mentions a repair.
 */

export type ErrorAction = "retry" | "edit" | "new_key" | "reconnect" | "upgrade" | "none";

export type FriendlyError = {
  title: string;
  next: string;
  action: ErrorAction;
  /** Choices the site offers for a refused value, shown as chips. */
  choices: string[];
  /** The input the site refused, when it named it. */
  field: string | null;
};

/** Failures the kit itself detects, beside the API's own codes. */
export type LocalFailure = "unreachable" | "timed_out" | "tool_missing";

type Entry = { title: string | ((site: string) => string); next: string };

const E = KIT_COPY.errors;

const TABLE: Record<string, { entry: Entry; action: ErrorAction }> = {
  invalid_input: { entry: E.invalidInput, action: "edit" },
  invalid_request: { entry: E.invalidInput, action: "edit" },
  input_rejected: { entry: E.inputRejected, action: "edit" },
  input_not_applied: { entry: E.inputNotApplied, action: "retry" },
  location_not_applied: { entry: E.inputNotApplied, action: "retry" },
  unauthorized: { entry: E.keyStopped, action: "reconnect" },
  reauthentication_required: { entry: E.keyStopped, action: "reconnect" },
  key_permission_missing: { entry: E.keyPermission, action: "new_key" },
  forbidden: { entry: E.accountNotAllowed, action: "none" },
  role_permission_missing: { entry: E.accountNotAllowed, action: "none" },
  service_account_not_allowed: { entry: E.accountNotAllowed, action: "none" },
  account_unsupported: { entry: E.accountNotAllowed, action: "none" },
  organization_access_removed: { entry: E.accountNotAllowed, action: "none" },
  account_deletion_pending: { entry: E.accountNotAllowed, action: "none" },
  egress_options_not_allowed: { entry: E.accountNotAllowed, action: "none" },
  not_found: { entry: E.toolMissing, action: "none" },
  tool_not_read_only: { entry: E.toolMissing, action: "none" },
  not_configured: { entry: E.toolMissing, action: "none" },
  site_not_supported: { entry: E.siteNotSupported, action: "none" },
  quota_exceeded: { entry: E.outOfRuns, action: "upgrade" },
  service_account_cap_reached: { entry: E.outOfRuns, action: "none" },
  temporarily_unavailable: { entry: E.serviceProblem, action: "retry" },
  acceptance_unknown: { entry: E.serviceProblem, action: "retry" },
  worker_lost: { entry: E.serviceProblem, action: "retry" },
  internal_error: { entry: E.serviceProblem, action: "retry" },
  result_unavailable: { entry: E.serviceProblem, action: "retry" },
  location_unavailable: { entry: E.serviceProblem, action: "retry" },
  quota_expired: { entry: E.serviceProblem, action: "retry" },
  idempotency_conflict: { entry: E.serviceProblem, action: "retry" },
  execution_failed: { entry: E.couldNotFinish, action: "retry" },
  invalid_output: { entry: E.couldNotFinish, action: "retry" },
  outcome_unknown: { entry: E.couldNotFinish, action: "retry" },
  execution_budget_exhausted: { entry: E.couldNotFinish, action: "retry" },
  repair_timed_out: { entry: E.couldNotFinish, action: "retry" },
  no_response: { entry: E.noAnswer, action: "retry" },
  input_expired: { entry: E.noAnswer, action: "retry" },
  credentials_rejected: { entry: E.loginRejected, action: "none" },
  account_selection_required: { entry: E.loginChoice, action: "none" },
  saved_login_conflict: { entry: E.loginChoice, action: "none" },
  login_identity_conflict: { entry: E.loginChoice, action: "none" },
  legacy_duplicate_saved_logins: { entry: E.loginChoice, action: "none" },
  saved_login_unsettled: { entry: E.signInDown, action: "retry" },
  login_in_use: { entry: E.signInDown, action: "retry" },
  pin_required: { entry: E.loginsLocked, action: "none" },
  pin_not_set: { entry: E.loginsLocked, action: "none" },
  website_sign_in_unavailable: { entry: E.signInDown, action: "retry" },
  result_expired: { entry: E.resultGone, action: "retry" },
  unreachable: { entry: E.unreachable, action: "retry" },
  timed_out: { entry: E.timedOut, action: "retry" },
  tool_missing: { entry: E.toolMissing, action: "none" },
};

const FALLBACK = { entry: E.couldNotFinish, action: "retry" as ErrorAction };

const text = (value: Entry["title"], site: string) => (typeof value === "function" ? value(site) : value);

/** What to show for a failed site, from the API's error or a failure the kit found itself. */
export function friendlyError(error: ApiErrorView | LocalFailure | null, site: string): FriendlyError {
  const code = typeof error === "string" ? error : (error?.code ?? "");
  const details = typeof error === "string" || error === null ? {} : error.details;
  // A read a CAPTCHA stopped often passes when run again, so it gets its own words.
  const found =
    code === "execution_failed" && details.reason_code === "challenge_unsolved"
      ? { entry: E.humanCheck, action: "retry" as ErrorAction }
      : (TABLE[code] ?? FALLBACK);
  const choices = code === "input_rejected" ? (details.available ?? []).slice(0, 20) : [];
  return {
    title: text(found.entry.title, site),
    next: choices.length > 0 ? E.inputRejected.nextWithChoices : found.entry.next,
    action: found.action,
    choices,
    field: typeof details.field === "string" ? details.field : null,
  };
}
