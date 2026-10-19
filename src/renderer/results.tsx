import type { CSSProperties, ReactNode } from "react";
import { KIT_COPY } from "../shared/copy.js";
import { usePomerado } from "./provider.js";
import { ExternalIcon } from "./ui.js";

/**
 * Result views fed by an app's normalized rows: a "best pick" banner, a comparison table for
 * wide windows and cards for narrow ones. Every row can link to its source, so it's checkable.
 */

/** A link that opens in the system browser through the main process. */
export function SourceLink({ href, children, className }: { href: string | null; children: ReactNode; className?: string }) {
  const { bridge } = usePomerado();
  if (href === null) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      className={["pk-link", className].filter(Boolean).join(" ")}
      onClick={(event) => {
        event.preventDefault();
        void bridge.openUrl(href);
      }}
    >
      {children}
      <ExternalIcon />
    </a>
  );
}

export type Pick = {
  /** "Best pick", or the app's own label for a second pick. */
  label?: string;
  title: ReactNode;
  meta?: ReactNode;
  price: ReactNode;
  priceNote?: ReactNode;
  /** Why this one, in a few words. */
  reason?: ReactNode;
  source?: { label: string; href: string | null };
};

export function BestPick({ pick, tone = "primary", testId }: { pick: Pick; tone?: "primary" | "secondary"; testId?: string }) {
  return (
    <section className="pk-pick" data-tone={tone} aria-label={pick.label ?? KIT_COPY.results.bestPick} data-testid={testId}>
      <p className="pk-pick-label">{pick.label ?? KIT_COPY.results.bestPick}</p>
      <div className="pk-pick-main">
        <div className="pk-pick-text">
          <p className="pk-pick-title">{pick.title}</p>
          {pick.meta ? <p className="pk-pick-meta">{pick.meta}</p> : null}
        </div>
        <div className="pk-pick-price">
          <p className="pk-pick-amount">{pick.price}</p>
          {pick.priceNote ? <p className="pk-pick-note">{pick.priceNote}</p> : null}
        </div>
      </div>
      {pick.reason || pick.source ? (
        <div className="pk-pick-foot">
          {pick.reason ? <p className="pk-pick-reason">{pick.reason}</p> : <span />}
          {pick.source ? (
            <SourceLink href={pick.source.href}>{KIT_COPY.results.open(pick.source.label)}</SourceLink>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** A narrow column that doesn't grow. */
  shrink?: boolean;
};

export function ComparisonTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  highlight,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  /** The row the best pick names, marked in the table. */
  highlight?: string | null;
}) {
  return (
    <div className="pk-table-wrap">
      <table className="pk-table">
        {caption ? <caption className="pk-visually-hidden">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align} data-shrink={column.shrink || undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row);
            return (
              <tr key={key} data-highlight={key === highlight || undefined} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
                {columns.map((column) => (
                  <td key={column.key} data-align={column.align} data-shrink={column.shrink || undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResultCards<T>({
  rows,
  rowKey,
  render,
  highlight,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  render: (row: T) => ReactNode;
  highlight?: string | null;
}) {
  return (
    <ul className="pk-cards">
      {rows.map((row, index) => {
        const key = rowKey(row);
        return (
          <li key={key} className="pk-card" data-highlight={key === highlight || undefined} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
            {render(row)}
          </li>
        );
      })}
    </ul>
  );
}

/** Nothing to show: one plain sentence and, when it helps, what to try. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="pk-empty" data-testid="empty-state">
      <p className="pk-empty-title">{title}</p>
      {body ? <p className="pk-empty-body">{body}</p> : null}
    </div>
  );
}
