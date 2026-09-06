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

export type ModelKey = "pace" | "montecarlo" | "elo";

export interface TeamModelResult {
  teamId: string;
  playoffProbability: number;
  projectedPoints: number;
  projectedPointsLow: number;
  projectedPointsHigh: number;
  rating?: number;
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
}
