import type { ModelKey } from "./types";

export const MODEL_META: Record<ModelKey, { label: string; short: string; colorVar: string }> = {
  pace: { label: "Points Pace", short: "Pace", colorVar: "--series-1" },
  montecarlo: { label: "Monte Carlo", short: "Sim", colorVar: "--series-2" },
  elo: { label: "Elo Rating", short: "Elo", colorVar: "--series-3" },
};

export function formatPct(value: number): string {
  if (value >= 99.5) return ">99%";
  if (value <= 0.5) return "<1%";
  return `${Math.round(value)}%`;
}

export function formatPoints(value: number): string {
  return value.toFixed(1);
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
}

export function probColor(pct: number): string {
  if (pct >= 75) return "var(--status-good)";
  if (pct >= 25) return "var(--status-warning)";
  return "var(--status-critical)";
}
