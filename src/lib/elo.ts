import type { Match } from "./types";

export const HOME_FIELD_ADVANTAGE = 65;
const K_FACTOR = 20;
const BASE_RATING = 1500;

function movMultiplier(goalDiff: number): number {
  const d = Math.abs(goalDiff);
  if (d <= 1) return 1;
  if (d === 2) return 1.5;
  return (11 + d) / 8;
}

export function expectedScore(ratingDiff: number): number {
  return 1 / (1 + Math.pow(10, -ratingDiff / 400));
}

/**
 * Replays every completed match in chronological order to build a current
 * Elo rating per team. Draws count as a 0.5/0.5 result.
 */
export function computeEloRatings(
  teamIds: string[],
  completedMatches: Match[]
): Record<string, number> {
  const ratings: Record<string, number> = {};
  for (const id of teamIds) ratings[id] = BASE_RATING;

  for (const match of completedMatches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    const rHome = ratings[match.homeId] ?? BASE_RATING;
    const rAway = ratings[match.awayId] ?? BASE_RATING;

    const expected = expectedScore(rHome + HOME_FIELD_ADVANTAGE - rAway);
    const goalDiff = match.homeScore - match.awayScore;
    const actual = goalDiff > 0 ? 1 : goalDiff < 0 ? 0 : 0.5;

    const delta = K_FACTOR * movMultiplier(goalDiff) * (actual - expected);
    ratings[match.homeId] = rHome + delta;
    ratings[match.awayId] = rAway - delta;
  }

  return ratings;
}
