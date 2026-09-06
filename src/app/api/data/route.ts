import { NextResponse } from "next/server";
import { buildDashboardPayload } from "@/lib/compute";

export const revalidate = 300;

let cache: { payload: Awaited<ReturnType<typeof buildDashboardPayload>>; fetchedAt: number } | null =
  null;
const CACHE_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("fresh") === "1";

  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const payload = await buildDashboardPayload();
    cache = { payload, fetchedAt: Date.now() };
    return NextResponse.json(payload);
  } catch (err) {
    if (cache) {
      return NextResponse.json(cache.payload);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build dashboard data" },
      { status: 502 }
    );
  }
}
