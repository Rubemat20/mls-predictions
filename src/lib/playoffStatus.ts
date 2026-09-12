import type { Conference, PlayoffStatusTeamRow } from "./types";

const URLS: Record<Conference, string> = {
  East: "https://www.playoffstatus.com/mls/easternstandings.html",
  West: "https://www.playoffstatus.com/mls/westernstandings.html",
};

/**
 * PlayoffStatus.com uses its own short team names, not ESPN's abbreviations.
 * Curated by hand against the live pages — see playoffStatus.test data below
 * if this ever needs re-verifying.
 */
const NAME_TO_ABBREV: Record<string, string> = {
  // Eastern Conference
  "Nashville SC": "NSH",
  "Inter Miami CF": "MIA",
  Revolution: "NE",
  Fire: "CHI",
  "Charlotte FC": "CLT",
  "FC Cincinnati": "CIN",
  "Orlando City SC": "ORL",
  Union: "PHI",
  "NY City FC": "NYC",
  "Toronto FC": "TOR",
  "D.C. United": "DC",
  "Red Bull": "RBNY",
  Crew: "CLB",
  "Atlanta United": "ATL",
  "CF Montréal": "MTL",
  // Western Conference
  Whitecaps: "VAN",
  Dynamo: "HOU",
  "FC Dallas": "DAL",
  LAFC: "LAFC",
  Earthquakes: "SJ",
  "St. Louis City SC": "STL",
  Rapids: "COL",
  Timbers: "POR",
  "San Diego FC": "SD",
  "Real Salt Lake": "RSL",
  "Minnesota United": "MIN",
  Galaxy: "LA",
  Sounders: "SEA",
  "Austin FC": "ATX",
  "Sporting KC": "SKC",
};

export class PlayoffStatusParseError extends Error {}

interface ParsedRow {
  name: string;
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  points: number;
  cellPercentages: number[]; // seed 1..N, then "no playoffs" as the last entry
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cellText(raw: string): string {
  // Every cell's real value is the first text run before any nested tag
  // (tooltips are nested <div>/<span> elements after the visible number) —
  // except the "<1%"/">99%" cells, which are themselves HTML entities
  // (&lt;1% / &gt;99%) and so contain no literal "<" to split on.
  const idx = raw.indexOf("<");
  const head = idx === -1 ? raw : raw.slice(0, idx);
  return decodeEntities(head).trim();
}

function parsePercent(text: string): number {
  const t = text.replace("%", "").trim();
  if (t.startsWith("<")) return 0.5;
  if (t.startsWith(">")) return 99.5;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function extractTeamName(cellHtml: string): string {
  const wide = cellHtml.match(/<span class="wide">([^<]*)<\/span>/);
  if (wide) return wide[1].trim();
  const anchor = cellHtml.match(/<a[^>]*>([^<]*)</);
  if (anchor) return anchor[1].trim();
  return cellHtml.replace(/<[^>]*>/g, "").trim();
}

function parseRow(rowHtml: string): ParsedRow | null {
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rowHtml)) !== null) cells.push(m[1]);
  if (cells.length < 7) return null; // team + W/L/T/GP/Pts + at least one seed column

  const name = extractTeamName(cells[0]);
  const wins = Number(cellText(cells[1]));
  const losses = Number(cellText(cells[2]));
  const ties = Number(cellText(cells[3]));
  const gamesPlayed = Number(cellText(cells[4]));
  const points = Number(cellText(cells[5]));
  const cellPercentages = cells.slice(6).map((c) => parsePercent(cellText(c)));

  if (!name || Number.isNaN(points) || cellPercentages.length === 0) return null;
  return { name, wins, losses, ties, gamesPlayed, points, cellPercentages };
}

function parseWeekLabel(html: string): string | null {
  const m = html.match(/<h2 class="wkinfo">([\s\S]*?)<\/h2>/);
  if (!m) return null;
  return m[1]
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export interface ParsedConferencePage {
  weekLabel: string | null;
  rows: PlayoffStatusTeamRow[];
  unmatched: string[];
}

export function parsePlayoffStatusHtml(
  html: string,
  conference: Conference
): ParsedConferencePage {
  const weekLabel = parseWeekLabel(html);
  const rowRe = /<tr data-idx="\d+">([\s\S]*?)<\/tr>/g;
  const rows: PlayoffStatusTeamRow[] = [];
  const unmatched: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const parsed = parseRow(m[1]);
    if (!parsed) continue;
    const abbrev = NAME_TO_ABBREV[parsed.name];
    if (!abbrev) {
      unmatched.push(parsed.name);
      continue;
    }
    // Last percentage column is "No Playoffs"; the rest are seed 1..N.
    const noPlayoffsProbability = parsed.cellPercentages[parsed.cellPercentages.length - 1];
    const seedProbabilities = parsed.cellPercentages.slice(0, -1);
    rows.push({
      teamAbbrev: abbrev,
      teamName: parsed.name,
      conference,
      wins: parsed.wins,
      losses: parsed.losses,
      ties: parsed.ties,
      gamesPlayed: parsed.gamesPlayed,
      points: parsed.points,
      seedProbabilities,
      noPlayoffsProbability,
      makePlayoffsProbability: Math.max(0, 100 - noPlayoffsProbability),
    });
  }

  if (rows.length < 10) {
    throw new PlayoffStatusParseError(
      `Only parsed ${rows.length} teams from PlayoffStatus ${conference} page — page structure may have changed.`
    );
  }

  return { weekLabel, rows, unmatched };
}

async function fetchConferencePage(conference: Conference): Promise<string> {
  const res = await fetch(URLS[conference], {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MLSPlayoffChancesBot/1.0)" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PlayoffStatus ${conference} request failed: ${res.status}`);
  }
  return res.text();
}

export interface PlayoffStatusSnapshot {
  weekLabel: string | null;
  teams: PlayoffStatusTeamRow[];
  unmatched: string[];
}

export async function fetchPlayoffStatusSnapshot(): Promise<PlayoffStatusSnapshot> {
  const [eastHtml, westHtml] = await Promise.all([
    fetchConferencePage("East"),
    fetchConferencePage("West"),
  ]);
  const east = parsePlayoffStatusHtml(eastHtml, "East");
  const west = parsePlayoffStatusHtml(westHtml, "West");
  return {
    weekLabel: east.weekLabel ?? west.weekLabel,
    teams: [...east.rows, ...west.rows],
    unmatched: [...east.unmatched, ...west.unmatched],
  };
}
