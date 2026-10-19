import type { ReactNode } from "react";
import { KIT_COPY } from "../shared/copy.js";
import type { SiteState } from "../shared/engine.js";
import { AlertIcon, Button, CheckIcon, Spinner } from "./ui.js";

const S = KIT_COPY.status;

/** A site's status line, from its phase. Never mentions a repair. */
export function statusLine(site: SiteState): string {
  switch (site.phase) {
    case "waiting":
      return S.waiting;
    case "searching":
      return S.searching(site.label);
    case "reading":
      return S.reading;
    case "returning":
      return S.returning;
    case "needs_input":
      return S.needsInput(site.label);
    case "done":
      return S.done;
    case "cancelled":
      return S.stopped;
    case "skipped":
      return S.skipped;
    case "failed":
    case "timed_out":
      return site.error?.title ?? S.stopped;
  }
}

/**
 * One line per site, filling in as each finishes, so the person never watches one long spinner.
 * A site waiting on the person gets the button that opens its question; a failed one gets its
 * next step.
 */
export function SiteStatusList({
  sites,
  summary,
  onAnswer,
  onRetry,
  onChoice,
}: {
  sites: SiteState[];
  /** What a done site found, such as "12 flights". */
  summary?: (site: SiteState) => ReactNode;
  onAnswer: (key: string) => void;
  onRetry?: (key: string) => void;
  /** Pick one of the values a site offered in place of a refused one. */
  onChoice?: (site: SiteState, value: string) => void;
}) {
  return (
    <ul className="pk-sites" aria-live="polite" data-testid="site-status">
      {sites.map((site) => {
        const live = ["waiting", "searching", "reading", "returning"].includes(site.phase);
        const failed = site.phase === "failed" || site.phase === "timed_out";
        return (
          <li key={site.key} className="pk-site" data-phase={site.phase} data-site={site.key}>
            <span className="pk-site-icon">
              {live ? <Spinner /> : site.phase === "done" ? <CheckIcon /> : failed || site.phase === "needs_input" ? <AlertIcon /> : <span className="pk-dot" />}
            </span>
            <div className="pk-site-text">
              <p className="pk-site-line">
                <span className="pk-site-name">{site.label}</span>
                <span className="pk-site-status">
                  {site.phase === "done" && summary ? summary(site) : statusLine(site)}
                </span>
              </p>
              {site.phase === "needs_input" ? (
                <div className="pk-site-more">
                  <p>{KIT_COPY.needsInput.body}</p>
                  <Button onClick={() => onAnswer(site.key)}>
                    {KIT_COPY.needsInput.button}
                  </Button>
                </div>
              ) : null}
              {failed && site.error ? (
                <div className="pk-site-more">
                  <p>{site.error.next}</p>
                  {site.error.choices.length > 0 ? (
                    <div className="pk-chips">
                      {site.error.choices.map((choice) =>
                        onChoice ? (
                          <button key={choice} type="button" className="pk-chip" onClick={() => onChoice(site, choice)}>
                            {choice}
                          </button>
                        ) : (
                          <span key={choice} className="pk-chip">
                            {choice}
                          </span>
                        ),
                      )}
                    </div>
                  ) : null}
                  {site.error.action === "retry" && onRetry ? (
                    <Button variant="quiet" onClick={() => onRetry(site.key)}>
                      {KIT_COPY.actions.retry}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
