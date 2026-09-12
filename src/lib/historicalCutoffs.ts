import type { Conference } from "./types";

export interface HistoricalCutoffSeason {
  season: number;
  conference: Conference;
  teamsInConference: number;
  playoffSpots: number;
  gamesPlayed: number;
  /** Points total of the last team to make the playoffs that season. */
  cutoffPoints: number;
  /** Points total of the first team that missed the playoffs that season. */
  firstOutPoints: number;
  /** True when the number of playoff spots per conference changed from the prior season in this dataset. */
  spotsChangedFromPriorYear: boolean;
  note?: string;
}

/**
 * Final regular-season conference standings cutoffs for the last 7 non-anomalous
 * MLS seasons (2018-2019, 2021-2025). Sourced from each season's Wikipedia
 * article. 2020 is deliberately omitted: it was a COVID-disrupted, irregular
 * schedule (teams played different numbers of games, some opted out entirely,
 * qualification wasn't a clean top-N-by-conference-standings affair), so it
 * would corrupt a cutoff-points model rather than inform it.
 */
export const HISTORICAL_CUTOFFS: HistoricalCutoffSeason[] = [
  {
    season: 2018,
    conference: "East",
    teamsInConference: 11,
    playoffSpots: 6,
    gamesPlayed: 34,
    cutoffPoints: 50,
    firstOutPoints: 46,
    spotsChangedFromPriorYear: false,
  },
  {
    season: 2018,
    conference: "West",
    teamsInConference: 12,
    playoffSpots: 6,
    gamesPlayed: 34,
    cutoffPoints: 49,
    firstOutPoints: 48,
    spotsChangedFromPriorYear: false,
  },
  {
    season: 2019,
    conference: "East",
    teamsInConference: 12,
    playoffSpots: 7,
    gamesPlayed: 34,
    cutoffPoints: 45,
    firstOutPoints: 42,
    spotsChangedFromPriorYear: true,
    note: "Format expanded from 6 to 7 spots per conference",
  },
  {
    season: 2019,
    conference: "West",
    teamsInConference: 12,
    playoffSpots: 7,
    gamesPlayed: 34,
    cutoffPoints: 48,
    firstOutPoints: 44,
    spotsChangedFromPriorYear: true,
    note: "Format expanded from 6 to 7 spots per conference",
  },
  {
    season: 2021,
    conference: "East",
    teamsInConference: 14,
    playoffSpots: 8,
    gamesPlayed: 34,
    cutoffPoints: 47,
    firstOutPoints: 47,
    spotsChangedFromPriorYear: true,
    note: "2020 omitted (COVID-irregular season); format expanded to 8 spots per conference",
  },
  {
    season: 2021,
    conference: "West",
    teamsInConference: 13,
    playoffSpots: 8,
    gamesPlayed: 34,
    cutoffPoints: 48,
    firstOutPoints: 45,
    spotsChangedFromPriorYear: true,
    note: "2020 omitted (COVID-irregular season); format expanded to 8 spots per conference",
  },
  {
    season: 2022,
    conference: "East",
    teamsInConference: 15,
    playoffSpots: 7,
    gamesPlayed: 34,
    cutoffPoints: 48,
    firstOutPoints: 46,
    spotsChangedFromPriorYear: true,
    note: "Format reduced from 8 back to 7 spots per conference",
  },
  {
    season: 2022,
    conference: "West",
    teamsInConference: 13,
    playoffSpots: 7,
    gamesPlayed: 34,
    cutoffPoints: 47,
    firstOutPoints: 46,
    spotsChangedFromPriorYear: true,
    note: "Format reduced from 8 back to 7 spots per conference",
  },
  {
    season: 2023,
    conference: "East",
    teamsInConference: 15,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 43,
    firstOutPoints: 41,
    spotsChangedFromPriorYear: true,
    note: "Format expanded to 9 spots per conference, adding the 8-vs-9 wild card round",
  },
  {
    season: 2023,
    conference: "West",
    teamsInConference: 14,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 44,
    firstOutPoints: 43,
    spotsChangedFromPriorYear: true,
    note: "Format expanded to 9 spots per conference, adding the 8-vs-9 wild card round",
  },
  {
    season: 2024,
    conference: "East",
    teamsInConference: 15,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 40,
    firstOutPoints: 40,
    spotsChangedFromPriorYear: false,
  },
  {
    season: 2024,
    conference: "West",
    teamsInConference: 14,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 47,
    firstOutPoints: 42,
    spotsChangedFromPriorYear: false,
  },
  {
    season: 2025,
    conference: "East",
    teamsInConference: 15,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 53,
    firstOutPoints: 43,
    spotsChangedFromPriorYear: false,
  },
  {
    season: 2025,
    conference: "West",
    teamsInConference: 15,
    playoffSpots: 9,
    gamesPlayed: 34,
    cutoffPoints: 41,
    firstOutPoints: 41,
    spotsChangedFromPriorYear: false,
  },
];

const RECENCY_DECAY = 0.85; // per year
const MOST_RECENT_SEASON = Math.max(...HISTORICAL_CUTOFFS.map((s) => s.season));

export interface HistoricalCutoffPpg extends HistoricalCutoffSeason {
  cutoffPpg: number;
  firstOutPpg: number;
  weight: number;
}

/** Cutoff/first-out points normalized to per-game rate, with a recency weight, one row per season/conference. */
export function seasonsForConference(conference: Conference): HistoricalCutoffPpg[] {
  return HISTORICAL_CUTOFFS.filter((s) => s.conference === conference).map((s) => ({
    ...s,
    cutoffPpg: s.cutoffPoints / s.gamesPlayed,
    firstOutPpg: s.firstOutPoints / s.gamesPlayed,
    weight: Math.pow(RECENCY_DECAY, MOST_RECENT_SEASON - s.season),
  }));
}

export interface HistoricalCutoffResult {
  /** Weighted % of historical seasons in this conference where this ppg pace would have made the playoffs. */
  playoffProbability: number;
  seasonsConsidered: number;
}

/**
 * Compares a team's current points-per-game pace against every historical
 * season on file for its conference: for each season, would this ppg have
 * equaled or beaten that season's cutoff ppg? Recent seasons count for more
 * (exponential decay) since playoff format and league size have shifted.
 * The result is a plain weighted hit-rate, not a fitted curve, so it stays
 * legible against the reference table rather than being a black box.
 */
export function historicalCutoffProbability(
  currentPpg: number,
  conference: Conference
): HistoricalCutoffResult {
  const seasons = seasonsForConference(conference);
  const totalWeight = seasons.reduce((s, x) => s + x.weight, 0);
  const madeWeight = seasons.reduce(
    (s, x) => s + (currentPpg >= x.cutoffPpg ? x.weight : 0),
    0
  );
  return {
    playoffProbability: totalWeight > 0 ? (madeWeight / totalWeight) * 100 : 0,
    seasonsConsidered: seasons.length,
  };
}

export interface ConferenceCutoffSummary {
  conference: Conference;
  seasons: number;
  minCutoffPpg: number;
  maxCutoffPpg: number;
  medianCutoffPpg: number;
}

export function summarizeConference(conference: Conference): ConferenceCutoffSummary {
  const seasons = seasonsForConference(conference);
  const ppgs = [...seasons.map((s) => s.cutoffPpg)].sort((a, b) => a - b);
  const mid = Math.floor(ppgs.length / 2);
  const median = ppgs.length % 2 === 0 ? (ppgs[mid - 1] + ppgs[mid]) / 2 : ppgs[mid];
  return {
    conference,
    seasons: seasons.length,
    minCutoffPpg: ppgs[0],
    maxCutoffPpg: ppgs[ppgs.length - 1],
    medianCutoffPpg: median,
  };
}
