import type { Match } from "./types";
import { matchupProbabilities } from "./probability";

export interface SimTeamMeta {
  id: string;
  conference: "East" | "West";
  currentPoints: number;
  currentGoalDiff: number;
}

export interface SimMatchInput {
  homeId: string;
  awayId: string;
  ratingDiff: number; // home effective rating - away rating, home advantage already applied
}

export interface SimResult {
  playoffProbability: number;
  projectedPoints: number;
  p10: number;
  p90: number;
}

export function buildSimMatches(
  remaining: Match[],
  ratingOf: (teamId: string) => number,
  homeAdvantage: (homeId: string, awayId: string) => number
): SimMatchInput[] {
  return remaining.map((m) => ({
    homeId: m.homeId,
    awayId: m.awayId,
    ratingDiff:
      ratingOf(m.homeId) + homeAdvantage(m.homeId, m.awayId) - ratingOf(m.awayId),
  }));
}

export function runMonteCarlo(
  teams: SimTeamMeta[],
  matches: SimMatchInput[],
  leagueDrawRate: number,
  playoffSpots: number,
  simulations = 8000
): Record<string, SimResult> {
  const ids = teams.map((t) => t.id);
  const indexOf = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;

  const basePoints = new Float64Array(n);
  const goalDiff = new Float64Array(n);
  const conference: ("East" | "West")[] = [];
  teams.forEach((t, i) => {
    basePoints[i] = t.currentPoints;
    goalDiff[i] = t.currentGoalDiff;
    conference[i] = t.conference;
  });

  const matchHome = new Int32Array(matches.length);
  const matchAway = new Int32Array(matches.length);
  const pHomeArr = new Float64Array(matches.length);
  const pDrawArr = new Float64Array(matches.length);
  matches.forEach((m, i) => {
    matchHome[i] = indexOf.get(m.homeId)!;
    matchAway[i] = indexOf.get(m.awayId)!;
    const { pHome, pDraw } = matchupProbabilities(m.ratingDiff, leagueDrawRate);
    pHomeArr[i] = pHome;
    pDrawArr[i] = pHome + pDraw;
  });

  const pointsDist: number[][] = Array.from({ length: n }, () => []);
  const playoffCount = new Int32Array(n);

  const eastIdx = conference
    .map((c, i) => (c === "East" ? i : -1))
    .filter((i) => i >= 0);
  const westIdx = conference
    .map((c, i) => (c === "West" ? i : -1))
    .filter((i) => i >= 0);

  const trialPoints = new Float64Array(n);

  for (let s = 0; s < simulations; s++) {
    trialPoints.set(basePoints);

    for (let m = 0; m < matches.length; m++) {
      const r = Math.random();
      const h = matchHome[m];
      const a = matchAway[m];
      if (r < pHomeArr[m]) {
        trialPoints[h] += 3;
      } else if (r < pDrawArr[m]) {
        trialPoints[h] += 1;
        trialPoints[a] += 1;
      } else {
        trialPoints[a] += 3;
      }
    }

    for (const group of [eastIdx, westIdx]) {
      const ranked = [...group].sort((x, y) => {
        if (trialPoints[y] !== trialPoints[x]) return trialPoints[y] - trialPoints[x];
        if (goalDiff[y] !== goalDiff[x]) return goalDiff[y] - goalDiff[x];
        return Math.random() - 0.5;
      });
      for (let rank = 0; rank < Math.min(playoffSpots, ranked.length); rank++) {
        playoffCount[ranked[rank]]++;
      }
    }

    for (let i = 0; i < n; i++) pointsDist[i].push(trialPoints[i]);
  }

  const results: Record<string, SimResult> = {};
  for (let i = 0; i < n; i++) {
    const dist = pointsDist[i].sort((a, b) => a - b);
    const mean = dist.reduce((s, v) => s + v, 0) / dist.length;
    const p10 = dist[Math.floor(dist.length * 0.1)];
    const p90 = dist[Math.floor(dist.length * 0.9)];
    results[ids[i]] = {
      playoffProbability: (playoffCount[i] / simulations) * 100,
      projectedPoints: mean,
      p10,
      p90,
    };
  }
  return results;
}
