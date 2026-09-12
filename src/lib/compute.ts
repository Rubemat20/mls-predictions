import { fetchFullSchedule, fetchStandings } from "./espn";
import { computeEloRatings, HOME_FIELD_ADVANTAGE } from "./elo";
import { computeStrengthRatings } from "./strength";
import {
  matchProbsFromRatings,
  matchProbsFromRecord,
  runSimulation,
  type SimTeamMeta,
} from "./simulate";
import { calibrateRestSplits, computeRestFlags, type SplitRates } from "./recordModel";
import { projectPointsPace, type PaceTeamInput } from "./pace";
import { historicalCutoffProbability } from "./historicalCutoffs";
import type {
  Conference,
  DashboardPayload,
  Match,
  ModelKey,
  SimModelKey,
  TeamModelResult,
  TeamRecordSplit,
  TeamStats,
} from "./types";

export const PLAYOFF_SPOTS_PER_CONFERENCE = 9;
export const DIRECT_SPOTS_PER_CONFERENCE = 7;
const SIMULATIONS = 8000;
const DEFAULT_LEAGUE_DRAW_RATE = 0.24;
const DEFAULT_PER_GAME_STD = 1.2;
const HOME_ADVANTAGE_PRIOR_GAMES = 6;
const BASE_HOME_BOOST = 50;
const REFERENCE_SEASON_GAMES = 34; // typical modern MLS regular-season length, used only to express a ppg pace as a full-season point total

function emptySplit(): TeamRecordSplit {
  return { played: 0, wins: 0, draws: 0, losses: 0, points: 0, ppg: 0 };
}

function pointsForResult(scoredFor: number, scoredAgainst: number): number {
  if (scoredFor > scoredAgainst) return 3;
  if (scoredFor === scoredAgainst) return 1;
  return 0;
}

export async function buildDashboardPayload(): Promise<DashboardPayload> {
  const standings = await fetchStandings();
  const teams = standings.teams;
  const teamIds = teams.map((t) => t.id);
  const validIds = new Set(teamIds);

  const allMatches = await fetchFullSchedule(standings.season, validIds);
  const completed = allMatches.filter((m) => m.status === "FINAL");
  const remaining = allMatches.filter((m) => m.status !== "FINAL");

  const remainingByTeam = new Map<string, Match[]>();
  for (const id of teamIds) remainingByTeam.set(id, []);
  for (const m of remaining) {
    remainingByTeam.get(m.homeId)?.push(m);
    remainingByTeam.get(m.awayId)?.push(m);
  }

  const home = new Map<string, TeamRecordSplit>();
  const away = new Map<string, TeamRecordSplit>();
  const overall = new Map<
    string,
    { played: number; wins: number; draws: number; losses: number; points: number; gf: number; ga: number }
  >();
  const perGamePointsSeq = new Map<string, number[]>();
  for (const id of teamIds) {
    home.set(id, emptySplit());
    away.set(id, emptySplit());
    overall.set(id, { played: 0, wins: 0, draws: 0, losses: 0, points: 0, gf: 0, ga: 0 });
    perGamePointsSeq.set(id, []);
  }

  let leagueDraws = 0;

  for (const m of completed) {
    if (m.homeScore === null || m.awayScore === null) continue;
    leagueDraws += m.homeScore === m.awayScore ? 1 : 0;

    const homePts = pointsForResult(m.homeScore, m.awayScore);
    const awayPts = pointsForResult(m.awayScore, m.homeScore);

    const hs = home.get(m.homeId)!;
    hs.played++;
    hs.points += homePts;
    if (homePts === 3) hs.wins++;
    else if (homePts === 1) hs.draws++;
    else hs.losses++;

    const as = away.get(m.awayId)!;
    as.played++;
    as.points += awayPts;
    if (awayPts === 3) as.wins++;
    else if (awayPts === 1) as.draws++;
    else as.losses++;

    const ho = overall.get(m.homeId)!;
    ho.played++;
    ho.points += homePts;
    ho.gf += m.homeScore;
    ho.ga += m.awayScore;
    if (homePts === 3) ho.wins++;
    else if (homePts === 1) ho.draws++;
    else ho.losses++;

    const ao = overall.get(m.awayId)!;
    ao.played++;
    ao.points += awayPts;
    ao.gf += m.awayScore;
    ao.ga += m.homeScore;
    if (awayPts === 3) ao.wins++;
    else if (awayPts === 1) ao.draws++;
    else ao.losses++;

    perGamePointsSeq.get(m.homeId)!.push(homePts);
    perGamePointsSeq.get(m.awayId)!.push(awayPts);
  }

  for (const id of teamIds) {
    const hs = home.get(id)!;
    hs.ppg = hs.played > 0 ? hs.points / hs.played : 0;
    const as = away.get(id)!;
    as.ppg = as.played > 0 ? as.points / as.played : 0;
  }

  const leagueDrawRate =
    completed.length > 0 ? leagueDraws / completed.length : DEFAULT_LEAGUE_DRAW_RATE;

  const leagueAvgHomeWinPct =
    teamIds.reduce((sum, id) => {
      const hs = home.get(id)!;
      return sum + (hs.played > 0 ? hs.wins / hs.played : 0);
    }, 0) / teamIds.length;

  const leagueHomeSplit = averageSplit(teamIds.map((id) => home.get(id)!));

  const eloRatings = computeEloRatings(teamIds, completed);
  const strengthRatings = computeStrengthRatings(
    teamIds.map((id) => {
      const o = overall.get(id)!;
      const ppg = o.played > 0 ? o.points / o.played : 0;
      const gdpg = o.played > 0 ? (o.gf - o.ga) / o.played : 0;
      return { teamId: id, ppg, goalDiffPerGame: gdpg };
    })
  );

  const teamStatsById = new Map<string, TeamStats>();

  for (const conf of ["East", "West"] as Conference[]) {
    const confTeams = teams.filter((t) => t.conference === conf);
    const ranked = [...confTeams].sort((a, b) => {
      const oa = overall.get(a.id)!;
      const ob = overall.get(b.id)!;
      if (ob.points !== oa.points) return ob.points - oa.points;
      const gdA = oa.gf - oa.ga;
      const gdB = ob.gf - ob.ga;
      if (gdB !== gdA) return gdB - gdA;
      return ob.gf - oa.gf;
    });
    ranked.forEach((team, idx) => {
      const o = overall.get(team.id)!;
      const hs = home.get(team.id)!;
      const overallWinPct = o.played > 0 ? o.wins / o.played : 0;
      teamStatsById.set(team.id, {
        team,
        gamesPlayed: o.played,
        wins: o.wins,
        draws: o.draws,
        losses: o.losses,
        points: o.points,
        goalsFor: o.gf,
        goalsAgainst: o.ga,
        goalDiff: o.gf - o.ga,
        currentRank: idx + 1,
        home: hs,
        away: away.get(team.id)!,
        homeWinPct: hs.played > 0 ? hs.wins / hs.played : overallWinPct,
        eloRating: eloRatings[team.id],
        strengthRating: strengthRatings[team.id],
        remainingGames: remainingByTeam.get(team.id)?.length ?? 0,
      });
    });
  }

  const teamStats = teamIds.map((id) => teamStatsById.get(id)!);

  // --- Model 1: Points-pace projection ---
  const paceInputs: PaceTeamInput[] = teamStats.map((t) => ({
    id: t.team.id,
    conference: t.team.conference,
    currentPoints: t.points,
    homePpg: t.home.played > 0 ? t.home.ppg : t.gamesPlayed > 0 ? t.points / t.gamesPlayed : 1.3,
    awayPpg: t.away.played > 0 ? t.away.ppg : t.gamesPlayed > 0 ? t.points / t.gamesPlayed : 1.0,
    perGameStd:
      perGamePointsSeq.get(t.team.id)!.length >= 4
        ? sampleStd(perGamePointsSeq.get(t.team.id)!)
        : DEFAULT_PER_GAME_STD,
  }));
  const paceResults = projectPointsPace(paceInputs, remainingByTeam, PLAYOFF_SPOTS_PER_CONFERENCE);

  // --- Model 2: Monte Carlo using current-form team strength + home win% ---
  const simMeta: SimTeamMeta[] = teamStats.map((t) => ({
    id: t.team.id,
    conference: t.team.conference,
    currentPoints: t.points,
    currentGoalDiff: t.goalDiff,
  }));

  const homeWinPctById = new Map(teamStats.map((t) => [t.team.id, t]));
  const strengthHomeAdvantage = (homeId: string) => {
    const t = homeWinPctById.get(homeId)!;
    const shrunk =
      (t.home.wins + HOME_ADVANTAGE_PRIOR_GAMES * leagueAvgHomeWinPct) /
      (t.home.played + HOME_ADVANTAGE_PRIOR_GAMES);
    return BASE_HOME_BOOST + (shrunk - leagueAvgHomeWinPct) * 300;
  };
  const strengthMatchProbs = matchProbsFromRatings(
    remaining,
    leagueDrawRate,
    (id) => strengthRatings[id],
    (homeId) => strengthHomeAdvantage(homeId)
  );
  const mcResults = runSimulation(
    simMeta,
    strengthMatchProbs,
    PLAYOFF_SPOTS_PER_CONFERENCE,
    SIMULATIONS
  );

  // --- Model 3: Elo rating-based simulation ---
  const eloMatchProbs = matchProbsFromRatings(
    remaining,
    leagueDrawRate,
    (id) => eloRatings[id],
    () => HOME_FIELD_ADVANTAGE
  );
  const eloResults = runSimulation(
    simMeta,
    eloMatchProbs,
    PLAYOFF_SPOTS_PER_CONFERENCE,
    SIMULATIONS
  );

  // --- Model 4: league-wide home/away record, adjusted for short rest ---
  // No per-team splits (one season is too small a sample per team) — every
  // match uses the league-wide home/draw/away rate for its rest situation
  // (whether the home team, away team, both, or neither is playing again on
  // short rest), so teams only differ here by their current points and the
  // shape of their remaining schedule.
  const restFlags = computeRestFlags(allMatches);
  const restBuckets = calibrateRestSplits(completed, restFlags, leagueHomeSplit);
  const recordMatchProbs = matchProbsFromRecord(remaining, restBuckets, restFlags);
  const recordResults = runSimulation(
    simMeta,
    recordMatchProbs,
    PLAYOFF_SPOTS_PER_CONFERENCE,
    SIMULATIONS
  );

  // --- Model 5: historical cutoff likelihood ---
  // No simulation at all: takes each team's current points-per-game pace and
  // checks it against the last 7 non-anomalous seasons' actual playoff
  // cutoff ppg for that conference (recency-weighted). Pure lookup against
  // real outcomes, not a fitted model, by design.
  const historicalResults = new Map<
    string,
    { playoffProbability: number; projectedPoints: number }
  >();
  for (const t of teamStats) {
    const currentPpg = t.gamesPlayed > 0 ? t.points / t.gamesPlayed : 0;
    const { playoffProbability } = historicalCutoffProbability(currentPpg, t.team.conference);
    historicalResults.set(t.team.id, {
      playoffProbability,
      projectedPoints: currentPpg * REFERENCE_SEASON_GAMES,
    });
  }

  const models: Record<ModelKey, TeamModelResult[]> = {
    pace: teamIds.map((id) => ({
      teamId: id,
      playoffProbability: paceResults[id].playoffProbability,
      projectedPoints: paceResults[id].projectedPoints,
      projectedPointsLow: paceResults[id].p10,
      projectedPointsHigh: paceResults[id].p90,
    })),
    montecarlo: teamIds.map((id) => ({
      teamId: id,
      playoffProbability: mcResults[id].playoffProbability,
      projectedPoints: mcResults[id].projectedPoints,
      projectedPointsLow: mcResults[id].p10,
      projectedPointsHigh: mcResults[id].p90,
      rating: strengthRatings[id],
    })),
    elo: teamIds.map((id) => ({
      teamId: id,
      playoffProbability: eloResults[id].playoffProbability,
      projectedPoints: eloResults[id].projectedPoints,
      projectedPointsLow: eloResults[id].p10,
      projectedPointsHigh: eloResults[id].p90,
      rating: eloRatings[id],
    })),
    record: teamIds.map((id) => ({
      teamId: id,
      playoffProbability: recordResults[id].playoffProbability,
      projectedPoints: recordResults[id].projectedPoints,
      projectedPointsLow: recordResults[id].p10,
      projectedPointsHigh: recordResults[id].p90,
    })),
    historical: teamIds.map((id) => ({
      teamId: id,
      playoffProbability: historicalResults.get(id)!.playoffProbability,
      projectedPoints: historicalResults.get(id)!.projectedPoints,
      projectedPointsLow: historicalResults.get(id)!.projectedPoints,
      projectedPointsHigh: historicalResults.get(id)!.projectedPoints,
    })),
  };

  const matchProbabilities: Record<SimModelKey, Record<string, { pHome: number; pDraw: number; pAway: number }>> = {
    montecarlo: Object.fromEntries(
      strengthMatchProbs.map((m) => [m.id, { pHome: m.pHome, pDraw: m.pDraw, pAway: m.pAway }])
    ),
    elo: Object.fromEntries(
      eloMatchProbs.map((m) => [m.id, { pHome: m.pHome, pDraw: m.pDraw, pAway: m.pAway }])
    ),
    record: Object.fromEntries(
      recordMatchProbs.map((m) => [m.id, { pHome: m.pHome, pDraw: m.pDraw, pAway: m.pAway }])
    ),
  };

  const restFlagsForRemaining = Object.fromEntries(
    remaining.map((m) => [m.id, restFlags.get(m.id) ?? { homeShort: false, awayShort: false }])
  );

  return {
    generatedAt: new Date().toISOString(),
    season: standings.season,
    playoffSpotsPerConference: PLAYOFF_SPOTS_PER_CONFERENCE,
    directSpotsPerConference: DIRECT_SPOTS_PER_CONFERENCE,
    teams: teamStats,
    models,
    leagueDrawRate,
    simulations: SIMULATIONS,
    remainingMatches: remaining,
    matchProbabilities,
    restFlags: restFlagsForRemaining,
  };
}

function averageSplit(splits: TeamRecordSplit[]): SplitRates {
  const totals = splits.reduce(
    (acc, s) => {
      acc.played += s.played;
      acc.wins += s.wins;
      acc.draws += s.draws;
      acc.losses += s.losses;
      return acc;
    },
    { played: 0, wins: 0, draws: 0, losses: 0 }
  );
  if (totals.played === 0) return { win: 0.45, draw: 0.24, loss: 0.31 };
  return {
    win: totals.wins / totals.played,
    draw: totals.draws / totals.played,
    loss: totals.losses / totals.played,
  };
}

function sampleStd(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(values.length - 1, 1);
  return Math.max(Math.sqrt(variance), 0.6);
}
