import type { Conference, Match, Team } from "./types";

const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings";

function scoreboardUrl(year: number) {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${year}0101-${year}1231&limit=1000`;
}

interface StandingsResult {
  teams: Team[];
  season: number;
  currentPoints: Record<string, number>;
  currentRank: Record<string, number>;
  currentGoalsFor: Record<string, number>;
  currentGoalsAgainst: Record<string, number>;
}

export async function fetchStandings(): Promise<StandingsResult> {
  const res = await fetch(STANDINGS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN standings request failed: ${res.status}`);
  const data = await res.json();

  const teams: Team[] = [];
  const currentPoints: Record<string, number> = {};
  const currentRank: Record<string, number> = {};
  const currentGoalsFor: Record<string, number> = {};
  const currentGoalsAgainst: Record<string, number> = {};
  let season = new Date().getFullYear();

  for (const group of data.children ?? []) {
    const conference: Conference = /west/i.test(group.name) ? "West" : "East";
    const entries = group.standings?.entries ?? [];
    season = group.standings?.season ?? season;
    for (const entry of entries) {
      const team = entry.team;
      const stats = Object.fromEntries(
        (entry.stats ?? []).map((s: { name: string; value: number }) => [s.name, s.value])
      );
      teams.push({
        id: String(team.id),
        name: team.displayName,
        abbrev: team.abbreviation,
        logo: team.logos?.[0]?.href ?? "",
        conference,
      });
      currentPoints[team.id] = stats.points ?? 0;
      currentRank[team.id] = stats.rank ?? 0;
      currentGoalsFor[team.id] = stats.pointsFor ?? 0;
      currentGoalsAgainst[team.id] = stats.pointsAgainst ?? 0;
    }
  }

  return { teams, season, currentPoints, currentRank, currentGoalsFor, currentGoalsAgainst };
}

export async function fetchFullSchedule(
  season: number,
  validTeamIds: Set<string>
): Promise<Match[]> {
  const res = await fetch(scoreboardUrl(season), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN scoreboard request failed: ${res.status}`);
  const data = await res.json();

  const matches: Match[] = [];
  for (const event of data.events ?? []) {
    const competition = event.competitions?.[0];
    if (!competition) continue;
    const home = competition.competitors.find(
      (c: { homeAway: string }) => c.homeAway === "home"
    );
    const away = competition.competitors.find(
      (c: { homeAway: string }) => c.homeAway === "away"
    );
    if (!home || !away) continue;
    const homeId = String(home.team.id);
    const awayId = String(away.team.id);
    if (!validTeamIds.has(homeId) || !validTeamIds.has(awayId)) continue;

    const statusType = competition.status?.type;
    let status: Match["status"] = "SCHEDULED";
    if (statusType?.completed) status = "FINAL";
    else if (statusType?.state === "in") status = "LIVE";

    matches.push({
      id: String(event.id),
      date: event.date,
      homeId,
      awayId,
      status,
      homeScore: status === "FINAL" ? Number(home.score) : null,
      awayScore: status === "FINAL" ? Number(away.score) : null,
    });
  }

  matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return matches;
}
