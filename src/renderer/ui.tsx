import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { KIT_COPY } from "../shared/copy.js";
import { runsLeftText } from "../shared/format.js";
import { usePomerado } from "./provider.js";

/** The kit's building blocks: buttons, icons, the app frame and its quiet Pomerado footer. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  busy?: boolean;
};

/** One crimson primary per screen; everything else is secondary or quiet. */
export function Button({ variant = "secondary", busy = false, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={["pk-button", `pk-button--${variant}`, className].filter(Boolean).join(" ")}
    >
      {busy ? <Spinner /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <svg className="pk-spinner" viewBox="0 0 24 24" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="pk-icon pk-icon--done" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg className="pk-icon pk-icon--alert" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
      <path d="M12 7.5v5.5M12 16.4v.1" fill="none" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg className="pk-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zm7.4-3.2c0-.5 0-.9-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2.2-1.3L14.3 3h-4l-.4 2.4c-.8.3-1.5.7-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 000 2.6l-2 1.6 2 3.4 2.4-1c.7.6 1.4 1 2.2 1.3l.4 2.4h4l.4-2.4c.8-.3 1.5-.7 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3z"
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg className="pk-icon pk-icon--small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h4" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "87 of 100 runs left today." once connected. */
export function RunsLeft() {
  const { state, quota } = usePomerado();
  if (!state?.connected) return null;
  const low = quota?.remaining !== null && quota?.remaining !== undefined && quota.remaining <= 0;
  return (
    <p className="pk-runs" data-low={low || undefined} data-testid="runs-left">
      {runsLeftText(quota)}
    </p>
  );
}

/** Whether the window is at least `width` pixels wide, kept current as it resizes. */
export function useWideLayout(width = 760) {
  const query = `(min-width: ${width}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setWide(list.matches);
    list.addEventListener("change", change);
    change();
    return () => list.removeEventListener("change", change);
  }, [query]);
  return wide;
}

/**
 * The app's frame: its name and the runs-left meter on top, the screen in the middle, and
 * "Powered by Pomerado" at the bottom.
 */
export function AppShell({
  appName,
  mark,
  onSettings,
  children,
  badge,
}: {
  appName: string;
  mark?: ReactNode;
  onSettings?: () => void;
  children: ReactNode;
  /** A small label beside the name, such as the environment when it isn't production. */
  badge?: string;
}) {
  return (
    <div className="pk-shell">
      <header className="pk-header">
        <div className="pk-brand">
          {mark}
          <span className="pk-app-name">{appName}</span>
          {badge ? <span className="pk-badge">{badge}</span> : null}
        </div>
        <div className="pk-header-end">
          <RunsLeft />
          {onSettings ? (
            <button type="button" className="pk-icon-button" onClick={onSettings} aria-label={KIT_COPY.settings.open} title={KIT_COPY.settings.open}>
              <GearIcon />
            </button>
          ) : null}
        </div>
      </header>
      <main className="pk-main">{children}</main>
      <footer className="pk-footer">
        <PomeradoMark />
        <span>{KIT_COPY.footer.powered}</span>
      </footer>
    </div>
  );
}

/** Pomerado's mark, from its public logo, drawn inline so the kit ships no image files. */
export function PomeradoMark() {
  return (
    <svg className="pk-mark" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="76" fill="#C71F3E" />
      <circle cx="100" cy="100" r="58" fill="#FFF3E3" />
      <g fill="#FF6B4A" stroke="#FF6B4A" strokeWidth="13" strokeLinejoin="round">
        <path d="M111 99 124.6 61.7a45.5 45.5 0 0 1 6.3 71.7Z" />
        <path d="m93.7 109 19.8 34.4a45.5 45.5 0 0 1-58.9-41.3Z" />
        <path d="m93.5 88.7-35.5-6.3a45.5 45.5 0 0 1 47.8-27.5Z" />
      </g>
    </svg>
  );
}

/** A plain message block: a title, a body and optional actions. */
export function Notice({
  tone = "neutral",
  title,
  children,
  actions,
  testId,
}: {
  tone?: "neutral" | "alert";
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  testId?: string;
}) {
  return (
    <section className="pk-notice" data-tone={tone} role={tone === "alert" ? "alert" : "status"} data-testid={testId}>
      <h2 className="pk-notice-title">{title}</h2>
      {children ? <div className="pk-notice-body">{children}</div> : null}
      {actions ? <div className="pk-notice-actions">{actions}</div> : null}
    </section>
  );
}
