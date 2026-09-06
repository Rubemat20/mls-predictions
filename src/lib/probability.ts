import { expectedScore } from "./elo";

export interface MatchProbabilities {
  pHome: number;
  pDraw: number;
  pAway: number;
}

/**
 * Converts a rating differential (home effective rating minus away rating,
 * with any home-field bonus already folded in) into win/draw/loss
 * probabilities. The expected-score logistic gives P(home) if there were no
 * draws; a draw probability is layered on top that peaks at the league's
 * observed draw rate for even matchups and decays as the gap widens, and the
 * remaining mass is split between the two decisive outcomes so the expected
 * score is preserved.
 */
export function matchupProbabilities(
  ratingDiff: number,
  leagueDrawRate: number
): MatchProbabilities {
  const expected = expectedScore(ratingDiff);
  const gapFactor = Math.exp(-Math.pow(ratingDiff / 400, 2));
  const pDraw = Math.min(leagueDrawRate * 1.1, Math.max(0.06, leagueDrawRate * gapFactor));

  let pHome = expected - pDraw / 2;
  let pAway = 1 - pDraw - pHome;

  if (pHome < 0.02) {
    pHome = 0.02;
    pAway = 1 - pDraw - pHome;
  }
  if (pAway < 0.02) {
    pAway = 0.02;
    pHome = 1 - pDraw - pAway;
  }

  return { pHome, pDraw, pAway };
}
