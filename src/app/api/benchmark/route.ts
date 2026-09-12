import { NextResponse } from "next/server";
import { fetchPlayoffStatusSnapshot } from "@/lib/playoffStatus";
import type { BenchmarkPayload } from "@/lib/types";

export const revalidate = 14400;

// PlayoffStatus.com is a third party with no public API and no stated rate
// limit — this cache keeps us well under "once every few hours" regardless
// of how often the dashboard itself is loaded.
const CACHE_MS = 4 * 60 * 60 * 1000;

let cache: { payload: BenchmarkPayload; fetchedAt: number } | null = null;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("fresh") === "1";

  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const snapshot = await fetchPlayoffStatusSnapshot();
    const payload: BenchmarkPayload = {
      fetchedAt: new Date().toISOString(),
      weekLabel: snapshot.weekLabel,
      teams: snapshot.teams,
      unmatched: snapshot.unmatched,
    };
    cache = { payload, fetchedAt: Date.now() };
    return NextResponse.json(payload);
  } catch (err) {
    if (cache) {
      return NextResponse.json(cache.payload);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch PlayoffStatus data" },
      { status: 502 }
    );
  }
}
