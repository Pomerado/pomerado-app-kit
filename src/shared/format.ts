import { KIT_COPY } from "./copy.js";
import type { QuotaView } from "./types.js";

/** Formatting shared by every app: numbers, money, durations, runs left and reset times. */

const integer = new Intl.NumberFormat("en-US");

export const formatNumber = (value: number) => integer.format(value);

/** 21900, "USD" -> $219 (cents dropped when there are none). */
export function formatMoney(minor: number, currency: string) {
  const whole = minor % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

/** 335 -> 5h 35m */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** "87 of 100 runs left today." */
export function runsLeftText(quota: QuotaView | null) {
  if (quota === null) return KIT_COPY.runsLeft.unknown;
  if (quota.remaining !== null && quota.remaining <= 0) return KIT_COPY.runsLeft.none;
  if (quota.limit === null || quota.remaining === null) return KIT_COPY.runsLeft.unlimited;
  return KIT_COPY.runsLeft.some(formatNumber(quota.remaining), formatNumber(quota.limit));
}

/** "at 5:00 PM" today, "on Tue at 5:00 PM" another day, in the person's own time zone. */
export function resetTimeText(resetAt: string | null, now = new Date()) {
  const time = resetAt === null ? Number.NaN : Date.parse(resetAt);
  if (Number.isNaN(time)) return null;
  const date = new Date(time);
  const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  if (date.toDateString() === now.toDateString()) return KIT_COPY.quota.at(clock);
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  return KIT_COPY.quota.on(day, clock);
}
