import type { Match } from "./types";
import type { MatchProbabilities } from "./probability";

export interface SplitRates {
  win: number;
  draw: number;
  loss: number;
}

/** A team playing again this soon after its last match counts as short rest. */
export const SHORT_REST_DAYS = 4;

/** Weight (in equivalent league-average games) given to the overall league split when a rest bucket has few observed games of its own. */
const REST_BUCKET_PRIOR_GAMES = 40;

export interface RestFlags {
  homeShort: boolean;
  awayShort: boolean;
}

/**
 * Days since a team's last match is purely a function of the schedule, not
 * results, so this can be computed for every match on the calendar —
 * completed or still to come — from match dates alone. A team with no
 * earlier match on file (the season opener) is treated as fully rested.
 */
export function computeRestFlags(allMatches: Match[]): Map<string, RestFlags> {
  const sorted = [...allMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const lastPlayed = new Map<string, number>();
  const flags = new Map<string, RestFlags>();
  for (const m of sorted) {
    const date = new Date(m.date).getTime();
    const homePrev = lastPlayed.get(m.homeId);
    const awayPrev = lastPlayed.get(m.awayId);
    flags.set(m.id, {
      homeShort: homePrev !== undefined && (date - homePrev) / 86_400_000 <= SHORT_REST_DAYS,
      awayShort: awayPrev !== undefined && (date - awayPrev) / 86_400_000 <= SHORT_REST_DAYS,
    });
    lastPlayed.set(m.homeId, date);
    lastPlayed.set(m.awayId, date);
  }
  return flags;
}

function restBucketKey(f: RestFlags): string {
  return `${f.homeShort ? "S" : "N"}${f.awayShort ? "S" : "N"}`;
}

const REST_BUCKET_KEYS = ["NN", "SN", "NS", "SS"] as const;

/**
 * League-wide home/draw/away split, broken out by which side (if either) is
 * on short rest — every team pooled together, since one season of any single
 * team's home/away results is too small a sample to trust on its own. Each
 * of the four rest situations (neither team short, only the home team, only
 * the away team, both) is shrunk toward the league's overall split, because
 * congested-schedule matchups are comparatively rare and some buckets may
 * only have a handful of games behind them.
 */
export function calibrateRestSplits(
  completed: Match[],
  restFlags: Map<string, RestFlags>,
  leagueSplit: SplitRates
): Record<string, SplitRates> {
  const buckets: Record<string, { win: number; draw: number; loss: number; n: number }> =
    Object.fromEntries(REST_BUCKET_KEYS.map((k) => [k, { win: 0, draw: 0, loss: 0, n: 0 }]));

  for (const m of completed) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const f = restFlags.get(m.id);
    if (!f) continue;
    const b = buckets[restBucketKey(f)];
    b.n++;
    if (m.homeScore > m.awayScore) b.win++;
    else if (m.homeScore === m.awayScore) b.draw++;
    else b.loss++;
  }

  const result: Record<string, SplitRates> = {};
  for (const key of REST_BUCKET_KEYS) {
    const b = buckets[key];
    const total = b.n + REST_BUCKET_PRIOR_GAMES;
    result[key] = {
      win: (b.win + REST_BUCKET_PRIOR_GAMES * leagueSplit.win) / total,
      draw: (b.draw + REST_BUCKET_PRIOR_GAMES * leagueSplit.draw) / total,
      loss: (b.loss + REST_BUCKET_PRIOR_GAMES * leagueSplit.loss) / total,
    };
  }
  return result;
}

export function restSplitFor(
  restBuckets: Record<string, SplitRates>,
  flags: RestFlags
): MatchProbabilities {
  const s = restBuckets[restBucketKey(flags)];
  return { pHome: s.win, pDraw: s.draw, pAway: s.loss };
}
