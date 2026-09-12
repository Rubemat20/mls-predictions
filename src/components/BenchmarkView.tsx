"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BenchmarkPayload, Conference, DashboardPayload, ModelKey } from "@/lib/types";
import { MODEL_META, formatPct } from "@/lib/format";

interface Props {
  data: DashboardPayload;
  model: ModelKey;
}

const DISAGREEMENT_THRESHOLD = 10; // percentage points
const SNAPSHOT_STORAGE_KEY = "mls_playoffstatus_snapshots_v1";
const MAX_STORED_SNAPSHOTS = 20;
const MODEL_KEYS = Object.keys(MODEL_META) as ModelKey[];

interface StoredSnapshot {
  fetchedAt: string;
  weekLabel: string | null;
  perTeam: Record<string, { their: number; ours: Partial<Record<ModelKey, number>> }>;
}

function loadSnapshots(): StoredSnapshot[] {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshot(snapshot: StoredSnapshot) {
  try {
    const existing = loadSnapshots();
    if (existing.length > 0 && existing[existing.length - 1].fetchedAt === snapshot.fetchedAt) {
      return; // same server-cached fetch as last time — don't duplicate
    }
    const next = [...existing, snapshot].slice(-MAX_STORED_SNAPSHOTS);
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — trend tracking just won't work this session
  }
}

export default function BenchmarkView({ data, model: dashboardModel }: Props) {
  const [benchmark, setBenchmark] = useState<BenchmarkPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelKey>(dashboardModel);
  const [confFilter, setConfFilter] = useState<"all" | Conference>("all");
  const [snapshots, setSnapshots] = useState<StoredSnapshot[]>(() =>
    typeof window === "undefined" ? [] : loadSnapshots()
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/benchmark")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        return json as BenchmarkPayload;
      })
      .then((json) => {
        if (cancelled) return;
        setBenchmark(json);
        setError(null);

        const perTeam: StoredSnapshot["perTeam"] = {};
        for (const row of json.teams) {
          const ours: Partial<Record<ModelKey, number>> = {};
          for (const k of MODEL_KEYS) {
            const r = data.models[k].find(
              (m) => data.teams.find((t) => t.team.id === m.teamId)?.team.abbrev === row.teamAbbrev
            );
            if (r) ours[k] = r.playoffProbability;
          }
          perTeam[row.teamAbbrev] = { their: row.makePlayoffsProbability, ours };
        }
        const snap: StoredSnapshot = { fetchedAt: json.fetchedAt, weekLabel: json.weekLabel, perTeam };
        saveSnapshot(snap);
        setSnapshots(loadSnapshots());
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PlayoffStatus data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abbrevToTeam = useMemo(
    () => new Map(data.teams.map((t) => [t.team.abbrev, t])),
    [data.teams]
  );

  const rows = useMemo(() => {
    if (!benchmark) return [];
    const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

    return benchmark.teams
      .map((row) => {
        const team = abbrevToTeam.get(row.teamAbbrev);
        if (!team) return null;
        const ourResult = data.models[selectedModel].find((m) => m.teamId === team.team.id);
        const ours = ourResult?.playoffProbability ?? 0;
        const theirs = row.makePlayoffsProbability;
        const delta = ours - theirs;

        let trend: "toward" | "away" | "flat" | "unknown" = "unknown";
        if (previous) {
          const prevEntry = previous.perTeam[row.teamAbbrev];
          const prevOurs = prevEntry?.ours[selectedModel];
          if (prevEntry && prevOurs !== undefined) {
            const prevDelta = Math.abs(prevOurs - prevEntry.their);
            const curDelta = Math.abs(delta);
            if (Math.abs(curDelta - prevDelta) < 0.5) trend = "flat";
            else trend = curDelta < prevDelta ? "toward" : "away";
          }
        }

        return {
          abbrev: row.teamAbbrev,
          name: team.team.name,
          conference: team.team.conference,
          ours,
          theirs,
          delta,
          disagreement: Math.abs(delta) > DISAGREEMENT_THRESHOLD,
          trend,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => confFilter === "all" || r.conference === confFilter)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [benchmark, snapshots, abbrevToTeam, data.models, selectedModel, confFilter]);

  const modelAccuracy = useMemo(() => {
    if (!benchmark) return [];
    return MODEL_KEYS.map((k) => {
      const perConf: Record<Conference, { sum: number; n: number }> = {
        East: { sum: 0, n: 0 },
        West: { sum: 0, n: 0 },
      };
      for (const row of benchmark.teams) {
        const team = abbrevToTeam.get(row.teamAbbrev);
        if (!team) continue;
        const ourResult = data.models[k].find((m) => m.teamId === team.team.id);
        if (!ourResult) continue;
        const conf = perConf[team.team.conference];
        conf.sum += Math.abs(ourResult.playoffProbability - row.makePlayoffsProbability);
        conf.n += 1;
      }
      return {
        model: k,
        east: perConf.East.n > 0 ? perConf.East.sum / perConf.East.n : null,
        west: perConf.West.n > 0 ? perConf.West.sum / perConf.West.n : null,
      };
    }).sort((a, b) => {
      const aAvg = ((a.east ?? 0) + (a.west ?? 0)) / 2;
      const bAvg = ((b.east ?? 0) + (b.west ?? 0)) / 2;
      return aAvg - bAvg;
    });
  }, [benchmark, abbrevToTeam, data.models]);

  if (loading && !benchmark) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
        Loading PlayoffStatus.com comparison…
      </div>
    );
  }

  if (error && !benchmark) {
    return (
      <div className="card" style={{ padding: 20, color: "var(--status-critical)" }}>
        Couldn&apos;t load PlayoffStatus.com data: {error}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Their page structure may have changed, or the site may be temporarily unavailable. This
          doesn&apos;t affect the rest of the dashboard.
        </div>
      </div>
    );
  }

  if (!benchmark) return null;

  return (
    <div>
      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 16,
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        Comparing our &quot;make playoffs&quot; probability against{" "}
        <a href="https://www.playoffstatus.com/mls/" target="_blank" rel="noopener noreferrer">
          PlayoffStatus.com
        </a>
        , which simulates every remaining game using its own relative-strength ratings.
        {benchmark.weekLabel && ` Their data is as of ${benchmark.weekLabel}.`}{" "}
        Fetched {new Date(benchmark.fetchedAt).toLocaleString()}, cached up to 4 hours between
        pulls. Disagreements over {DISAGREEMENT_THRESHOLD} points are flagged below.
        {benchmark.unmatched.length > 0 && (
          <span style={{ color: "var(--status-warning)" }}>
            {" "}
            Couldn&apos;t match: {benchmark.unmatched.join(", ")}.
          </span>
        )}
        <br />
        Trend arrows compare against the last snapshot saved in <em>this browser</em> (there&apos;s
        no shared server-side history) — {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}{" "}
        saved so far here.
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          Which model tracks PlayoffStatus most closely
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
          Mean absolute difference in playoff probability (percentage points) — lower is closer
          agreement.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Eastern avg |Δ|</th>
                <th>Western avg |Δ|</th>
              </tr>
            </thead>
            <tbody>
              {modelAccuracy.map((m) => (
                <tr key={m.model} className={m.model === selectedModel ? "cutoff-row" : ""}>
                  <td style={{ fontWeight: m.model === selectedModel ? 700 : 500 }}>
                    {MODEL_META[m.model].label}
                  </td>
                  <td>{m.east !== null ? `${m.east.toFixed(1)}pp` : "—"}</td>
                  <td>{m.west !== null ? `${m.west.toFixed(1)}pp` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Compare model:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MODEL_KEYS.map((k) => (
            <button
              key={k}
              className="pill"
              data-active={selectedModel === k}
              onClick={() => setSelectedModel(k)}
            >
              {MODEL_META[k].label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 12 }}>Conference:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "East", "West"] as const).map((c) => (
            <button
              key={c}
              className="pill"
              data-active={confFilter === c}
              onClick={() => setConfFilter(c)}
            >
              {c === "all" ? "Both" : c}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-grid dash-grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--gridline)", fontWeight: 600, fontSize: 14 }}>
            {MODEL_META[selectedModel].label} vs. PlayoffStatus
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Ours</th>
                  <th>Theirs</th>
                  <th>Δ</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.abbrev} style={{ background: r.disagreement ? "var(--playoff-wildcard-bg)" : undefined }}>
                    <td>{r.name}</td>
                    <td>{formatPct(r.ours)}</td>
                    <td>{formatPct(r.theirs)}</td>
                    <td style={{ fontWeight: r.disagreement ? 700 : 500, color: r.disagreement ? "var(--status-critical)" : undefined }}>
                      {r.delta >= 0 ? "+" : ""}
                      {r.delta.toFixed(1)}pp
                    </td>
                    <td>
                      <TrendArrow trend={r.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Ours vs. theirs</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            Points off the diagonal are the biggest disagreements. Red = beyond the{" "}
            {DISAGREEMENT_THRESHOLD}pp threshold.
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
              <CartesianGrid stroke="var(--gridline)" />
              <XAxis
                type="number"
                dataKey="ours"
                domain={[0, 100]}
                name="Ours"
                unit="%"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="theirs"
                domain={[0, 100]}
                name="PlayoffStatus"
                unit="%"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--baseline)" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as (typeof rows)[number];
                  return (
                    <div className="chart-tooltip">
                      <div className="tt-label" style={{ marginBottom: 4 }}>
                        {r.name}
                      </div>
                      <div className="tt-value">Ours: {r.ours.toFixed(1)}%</div>
                      <div className="tt-value">Theirs: {r.theirs.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={rows}
                fill="var(--series-2)"
                shape={(props: unknown) => {
                  const p = props as { cx: number; cy: number; payload: (typeof rows)[number] };
                  return (
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={4}
                      fill={p.payload.disagreement ? "var(--status-critical)" : "var(--series-2)"}
                      opacity={0.8}
                    />
                  );
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function TrendArrow({ trend }: { trend: "toward" | "away" | "flat" | "unknown" }) {
  if (trend === "unknown") {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  if (trend === "flat") {
    return <span style={{ color: "var(--text-muted)" }}>→ steady</span>;
  }
  if (trend === "toward") {
    return <span style={{ color: "var(--status-good)" }}>↘ closing gap</span>;
  }
  return <span style={{ color: "var(--status-critical)" }}>↗ widening gap</span>;
}
