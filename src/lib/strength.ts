const BASE_RATING = 1500;

export interface StrengthInput {
  teamId: string;
  ppg: number;
  goalDiffPerGame: number;
}

/**
 * A power rating derived purely from this season's current form (points per
 * game and goal differential per game), independent of the Elo match-history
 * replay. Centered at 1500 so it lives on the same scale as Elo for charting.
 */
export function computeStrengthRatings(
  inputs: StrengthInput[]
): Record<string, number> {
  const n = inputs.length;
  const avgPpg = inputs.reduce((s, i) => s + i.ppg, 0) / n;
  const avgGd = inputs.reduce((s, i) => s + i.goalDiffPerGame, 0) / n;

  const ratings: Record<string, number> = {};
  for (const input of inputs) {
    ratings[input.teamId] =
      BASE_RATING +
      170 * (input.ppg - avgPpg) +
      45 * (input.goalDiffPerGame - avgGd);
  }
  return ratings;
}
