/**
 * Approximate primary brand colors for each club, keyed by the abbreviation
 * ESPN reports (team.abbrev). Used only as a decorative accent when a
 * team's explorer panel is open — not official hex codes, just close enough
 * to read as "that team's color" at a glance.
 */
export const TEAM_ACCENT_COLORS: Record<string, string> = {
  // Eastern Conference
  NSH: "#C9A24B", // Nashville SC — gold
  MIA: "#F45D9C", // Inter Miami CF — pink
  CHI: "#C41E3A", // Chicago Fire FC — red
  NE: "#0C2340", // New England Revolution — navy
  CLT: "#1BA8E0", // Charlotte FC — blue
  CIN: "#F26522", // FC Cincinnati — orange
  NYC: "#74ACDF", // New York City FC — sky blue
  ORL: "#5D2E8C", // Orlando City SC — purple
  PHI: "#B58500", // Philadelphia Union — gold
  RBNY: "#ED1C24", // NY Red Bulls — red
  TOR: "#B81137", // Toronto FC — red
  DC: "#96182B", // D.C. United — red
  CLB: "#FEDD00", // Columbus Crew — yellow
  ATL: "#A71930", // Atlanta United FC — red
  MTL: "#0033A0", // CF Montréal — blue

  // Western Conference
  VAN: "#00245D", // Vancouver Whitecaps — navy
  HOU: "#EA5B0C", // Houston Dynamo FC — orange
  LAFC: "#C5B358", // LAFC — gold
  DAL: "#C0102D", // FC Dallas — red
  STL: "#EE3524", // St. Louis CITY SC — red
  SJ: "#005DAA", // San Jose Earthquakes — blue
  POR: "#00622A", // Portland Timbers — green
  COL: "#860038", // Colorado Rapids — burgundy
  SD: "#F2C230", // San Diego FC — yellow
  RSL: "#7C1938", // Real Salt Lake — claret
  MIN: "#7CC7E8", // Minnesota United FC — loon blue
  LA: "#002A5C", // LA Galaxy — navy
  SEA: "#5D9741", // Seattle Sounders FC — rave green
  ATX: "#00B140", // Austin FC — verde
  SKC: "#00A9E0", // Sporting Kansas City — teal
};

/** Perceived-brightness heuristic (YIQ) — decides readable text color for a colored background. */
export function readableTextColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0b0b0b" : "#ffffff";
}
