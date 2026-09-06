import type { Match } from "./types";
import { matchupProbabilities } from "./probability";
import { restSplitFor, type RestFlags, type SplitRates } from "./recordModel";

export interface SimTeamMeta {
  id: string;
  conference: "East" | "West";
  currentPoints: number;
  currentGoalDiff: number;
}

/** A remaining match reduced to the three outcome probabilities used by the simulator. */
export interface SimMatchProb {
  id: string;
  homeId: string;
  awayId: string;
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface SimResult {
  playoffProbability: number;
  projectedPoints: number;
  p10: number;
  p90: number;
}

/** Outcome of a single match: home win, draw, or away win. */
export type MatchOutcome = "H" | "D" | "A";

export function matchProbsFromRatings(
  remaining: Match[],
  leagueDrawRate: number,
  ratingOf: (teamId: string) => number,
  homeAdvantage: (homeId: string, awayId: string) => number
): SimMatchProb[] {
  return remaining.map((m) => {
    const ratingDiff =
      ratingOf(m.homeId) + homeAdvantage(m.homeId, m.awayId) - ratingOf(m.awayId);
    const { pHome, pDraw, pAway } = matchupProbabilities(ratingDiff, leagueDrawRate);
    return { id: m.id, homeId: m.homeId, awayId: m.awayId, pHome, pDraw, pAway };
  });
}

export function matchProbsFromRecord(
  remaining: Match[],
  restBuckets: Record<string, SplitRates>,
  restFlags: Map<string, RestFlags>
): SimMatchProb[] {
  return remaining.map((m) => {
    const flags = restFlags.get(m.id) ?? { homeShort: false, awayShort: false };
    const { pHome, pDraw, pAway } = restSplitFor(restBuckets, flags);
    return { id: m.id, homeId: m.homeId, awayId: m.awayId, pHome, pDraw, pAway };
  });
}

/**
 * Monte Carlo core: replays `matchProbs` `simulations` times, awarding
 * points per trial and tallying how often each team lands in a top-
 * `playoffSpots` slot within its conference. Any match id present in
 * `fixedOutcomes` is forced to that result on every trial instead of being
 * drawn at random — this is what lets the team explorer answer "if the
 * Sounders win this game and draw that one, what's their playoff odds?"
 * while every other match (including this team's other remaining games)
 * still plays out probabilistically.
 */
export function runSimulation(
  teams: SimTeamMeta[],
  matchProbs: SimMatchProb[],
  playoffSpots: number,
  simulations = 8000,
  fixedOutcomes?: Map<string, MatchOutcome>
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

  const matchHome = new Int32Array(matchProbs.length);
  const matchAway = new Int32Array(matchProbs.length);
  const pHomeArr = new Float64Array(matchProbs.length);
  const pDrawCumArr = new Float64Array(matchProbs.length);
  const fixedArr: (MatchOutcome | null)[] = new Array(matchProbs.length).fill(null);
  matchProbs.forEach((m, i) => {
    matchHome[i] = indexOf.get(m.homeId)!;
    matchAway[i] = indexOf.get(m.awayId)!;
    pHomeArr[i] = m.pHome;
    pDrawCumArr[i] = m.pHome + m.pDraw;
    fixedArr[i] = fixedOutcomes?.get(m.id) ?? null;
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

    for (let m = 0; m < matchProbs.length; m++) {
      const h = matchHome[m];
      const a = matchAway[m];
      const forced = fixedArr[m];
      const outcome: MatchOutcome =
        forced ?? (() => {
          const r = Math.random();
          if (r < pHomeArr[m]) return "H";
          if (r < pDrawCumArr[m]) return "D";
          return "A";
        })();
      if (outcome === "H") {
        trialPoints[h] += 3;
      } else if (outcome === "D") {
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
