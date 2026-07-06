import type { Unit } from "./types";
import { displayWeight } from "./units";

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** 58:24 or 1:12:08 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 14,850 — volume in the display unit, whole numbers. */
export function formatVolume(kg: number, unit: Unit): string {
  const value = Math.round(displayWeight(kg, unit));
  return value.toLocaleString("en-US");
}

/** 225 or 102.5 — a weight in the display unit. */
export function formatDisplayWeight(kg: number, unit: Unit): string {
  const v = displayWeight(kg, unit);
  return Number.isInteger(v) ? String(v) : v.toFixed(v * 4 === Math.round(v * 4) ? 2 : 1).replace(/0$/, "");
}

export function daysAgoLabel(ts: number, now = Date.now()): string {
  const days = Math.floor((now - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
