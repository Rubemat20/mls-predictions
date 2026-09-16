import type { Conference, Match, Team } from "./types";

const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings";

function scoreboardUrl(date?: string) {
  const base = "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard";
  return date ? `${base}?dates=${date}` : base;
}

// ESPN's scoreboard endpoint used to accept a `dates=YYYYMMDD-YYYYMMDD` range,
// but that now always 400s ("Failed to get events endpoint."), even for a
// single-day range. Only a bare `dates=YYYYMMDD` still works, so instead we
// pull the season's full list of match dates from a scoreboard response's
// `leagues[0].calendar` field and fetch each date individually.
async function fetchScoreboardCalendarDates(year: number): Promise<string[]> {
  const res = await fetch(scoreboardUrl(`${year}0101`), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN scoreboard calendar request failed: ${res.status}`);
  const data = await res.json();
  const calendar: string[] = data.leagues?.[0]?.calendar ?? [];
  return calendar.map((iso) => iso.slice(0, 10).replace(/-/g, ""));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  const dates = await fetchScoreboardCalendarDates(season);

  const perDateEvents = await mapWithConcurrency(dates, 12, async (date) => {
    const res = await fetch(scoreboardUrl(date), { cache: "no-store" });
    if (!res.ok) throw new Error(`ESPN scoreboard request failed: ${res.status}`);
    const data = await res.json();
    return data.events ?? [];
  });

  const matchesById = new Map<string, Match>();
  for (const event of perDateEvents.flat()) {
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

    matchesById.set(String(event.id), {
      id: String(event.id),
      date: event.date,
      homeId,
      awayId,
      status,
      homeScore: status === "FINAL" ? Number(home.score) : null,
      awayScore: status === "FINAL" ? Number(away.score) : null,
    });
  }

  const matches = Array.from(matchesById.values());
  matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return matches;
}
