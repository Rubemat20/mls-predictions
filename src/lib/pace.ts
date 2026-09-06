import type { Conference, Match } from "./types";

export interface PaceTeamInput {
  id: string;
  conference: Conference;
  currentPoints: number;
  homePpg: number;
  awayPpg: number;
  perGameStd: number;
}

export interface PaceResult {
  projectedPoints: number;
  p10: number;
  p90: number;
  playoffProbability: number;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function projectPointsPace(
  teams: PaceTeamInput[],
  remainingByTeam: Map<string, Match[]>,
  playoffSpots: number
): Record<string, PaceResult> {
  const projected = new Map<string, number>();
  const remainingCount = new Map<string, number>();

  for (const t of teams) {
    const remaining = remainingByTeam.get(t.id) ?? [];
    let extra = 0;
    for (const m of remaining) {
      extra += m.homeId === t.id ? t.homePpg : t.awayPpg;
    }
    projected.set(t.id, t.currentPoints + extra);
    remainingCount.set(t.id, remaining.length);
  }

  const cutoffByConference = new Map<Conference, number>();
  for (const conf of ["East", "West"] as Conference[]) {
    const sorted = teams
      .filter((t) => t.conference === conf)
      .map((t) => projected.get(t.id)!)
      .sort((a, b) => b - a);
    cutoffByConference.set(conf, sorted[Math.min(playoffSpots, sorted.length) - 1] ?? 0);
  }

  const results: Record<string, PaceResult> = {};
  for (const t of teams) {
    const proj = projected.get(t.id)!;
    const remaining = remainingCount.get(t.id)!;
    const std = t.perGameStd;
    const spread = std * Math.sqrt(Math.max(remaining, 1));
    const cutoff = cutoffByConference.get(t.conference)!;
    const denom = Math.max(spread, 0.5);
    const z = (proj - cutoff) / denom;
    const probability = Math.min(99.5, Math.max(0.5, normalCdf(z) * 100));

    results[t.id] = {
      projectedPoints: proj,
      p10: proj - 1.2816 * spread,
      p90: proj + 1.2816 * spread,
      playoffProbability: probability,
    };
  }
  return results;
}
