import type { ModelKey } from "./types";

export const MODEL_META: Record<ModelKey, { label: string; short: string; colorVar: string }> = {
  pace: { label: "Points Pace", short: "Pace", colorVar: "--series-1" },
  montecarlo: { label: "Monte Carlo", short: "Sim", colorVar: "--series-2" },
  elo: { label: "Elo Rating", short: "Elo", colorVar: "--series-3" },
  record: { label: "Home/Away Record", short: "Record", colorVar: "--series-4" },
};

export const MODEL_DESCRIPTIONS: Record<ModelKey, string> = {
  pace:
    "No randomness — takes each team's current home and away points-per-game and multiplies it out across their remaining home and away fixtures. Fast to compute, but it assumes every team keeps playing exactly like its season average, so it under-reacts to a hot or cold streak and can't tell you how likely a given finish is, only a single projected total (with a rough range from that team's game-to-game point variance).",
  montecarlo:
    "Simulates the rest of the season 8,000 times. Each team gets a power rating built from this season's points-per-game and goal differential, plus its own shrunk home-field boost (how much better it's actually been at home than the league average). Every remaining match is drawn as win/draw/loss from those two ratings, standings are re-tabled after each simulated season, and the playoff percentage is just how often a team lands in a top-9 spot across all 8,000 tries.",
  elo:
    "Same simulation engine as Monte Carlo, but the input rating comes from replaying every completed match of the season through an Elo system (with a margin-of-victory bonus and a flat home-field edge) instead of a current-form snapshot. Elo rewards beating strong opponents specifically, so it can diverge from Monte Carlo when a team's schedule strength has been unusually easy or hard.",
  record:
    "No power ratings and no per-team splits — one season of any single team's home/away record is too small a sample to trust. Instead every remaining match uses the league-wide home/draw/away rate for its rest situation: whether the home team, the away team, both, or neither is playing again on 4 or fewer days' rest (each of those four situations is calibrated from this season's actual results, shrunk toward the overall league split when there aren't many games to go on). The same 8,000-trial simulation then tallies playoff odds from those league-average matchups, so teams only separate here by their current points and the shape (and rest pattern) of their remaining schedule.",
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
