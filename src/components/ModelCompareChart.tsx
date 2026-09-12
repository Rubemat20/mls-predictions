"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardPayload, TeamStats } from "@/lib/types";
import { MODEL_META } from "@/lib/format";

interface Props {
  teams: TeamStats[];
  models: DashboardPayload["models"];
}

interface Row {
  name: string;
  pace: number;
  montecarlo: number;
  elo: number;
  record: number;
  historical: number;
}

export default function ModelCompareChart({ teams, models }: Props) {
  const paceById = new Map(models.pace.map((m) => [m.teamId, m]));
  const mcById = new Map(models.montecarlo.map((m) => [m.teamId, m]));
  const eloById = new Map(models.elo.map((m) => [m.teamId, m]));
  const recordById = new Map(models.record.map((m) => [m.teamId, m]));
  const historicalById = new Map(models.historical.map((m) => [m.teamId, m]));

  const rows: Row[] = [...teams]
    .sort((a, b) => a.currentRank - b.currentRank)
    .map((t) => ({
      name: t.team.abbrev,
      pace: paceById.get(t.team.id)?.playoffProbability ?? 0,
      montecarlo: mcById.get(t.team.id)?.playoffProbability ?? 0,
      elo: eloById.get(t.team.id)?.playoffProbability ?? 0,
      record: recordById.get(t.team.id)?.playoffProbability ?? 0,
      historical: historicalById.get(t.team.id)?.playoffProbability ?? 0,
    }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        Model comparison — playoff probability
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        How the five models agree (or disagree) on each team&apos;s odds.
      </div>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 44, 280)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--gridline)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={44}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--gridline)", opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="chart-tooltip">
                  <div className="tt-label" style={{ marginBottom: 4 }}>
                    {label}
                  </div>
                  {payload.map((p) => (
                    <div key={p.dataKey as string} style={{ display: "flex", gap: 8 }}>
                      <span className="tt-value">{Number(p.value).toFixed(0)}%</span>
                      <span className="tt-label">
                        {MODEL_META[p.dataKey as keyof typeof MODEL_META].label}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            formatter={(value) => MODEL_META[value as keyof typeof MODEL_META].label}
            wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
          />
          <Bar dataKey="pace" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={6} />
          <Bar dataKey="montecarlo" fill="var(--series-2)" radius={[0, 4, 4, 0]} maxBarSize={6} />
          <Bar dataKey="elo" fill="var(--series-3)" radius={[0, 4, 4, 0]} maxBarSize={6} />
          <Bar dataKey="record" fill="var(--series-4)" radius={[0, 4, 4, 0]} maxBarSize={6} />
          <Bar dataKey="historical" fill="var(--series-5)" radius={[0, 4, 4, 0]} maxBarSize={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
