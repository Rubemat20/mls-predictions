export type Conference = "East" | "West";

export interface Team {
  id: string;
  name: string;
  abbrev: string;
  logo: string;
  conference: Conference;
}

export type MatchStatus = "FINAL" | "LIVE" | "SCHEDULED";

export interface Match {
  id: string;
  date: string;
  homeId: string;
  awayId: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TeamRecordSplit {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  ppg: number;
}

export interface TeamStats {
  team: Team;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  currentRank: number;
  home: TeamRecordSplit;
  away: TeamRecordSplit;
  homeWinPct: number;
  eloRating: number;
  strengthRating: number;
  remainingGames: number;
}

export type ModelKey = "pace" | "montecarlo" | "elo" | "record";

/** Models whose per-match outcome probabilities are exposed for the team explorer. */
export type SimModelKey = "montecarlo" | "elo" | "record";

export interface TeamModelResult {
  teamId: string;
  playoffProbability: number;
  projectedPoints: number;
  projectedPointsLow: number;
  projectedPointsHigh: number;
  rating?: number;
}

export interface MatchOutcomeProbability {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface MatchRestFlags {
  homeShort: boolean;
  awayShort: boolean;
}

export interface DashboardPayload {
  generatedAt: string;
  season: number;
  playoffSpotsPerConference: number;
  directSpotsPerConference: number;
  teams: TeamStats[];
  models: Record<ModelKey, TeamModelResult[]>;
  leagueDrawRate: number;
  simulations: number;
  /** Every not-yet-final match left on the schedule, league-wide. */
  remainingMatches: Match[];
  /** Per-match home/draw/away probabilities, keyed by match id, for each simulation-based model. */
  matchProbabilities: Record<SimModelKey, Record<string, MatchOutcomeProbability>>;
  /** Which side (if either) is playing on short rest, keyed by match id, for every remaining match. */
  restFlags: Record<string, MatchRestFlags>;
}
