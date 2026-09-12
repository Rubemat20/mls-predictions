"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ModelKey, TeamModelResult, TeamStats } from "@/lib/types";
import { MODEL_META } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  probability: number;
  comparePct?: number;
  inPlayoffs: boolean;
}

interface Props {
  teams: TeamStats[];
  modelResults: Map<string, TeamModelResult>;
  model: ModelKey;
  playoffSpots: number;
  compareResults?: Map<string, TeamModelResult>;
  compareModel?: ModelKey;
}

export default function ProbabilityChart({
  teams,
  modelResults,
  model,
  playoffSpots,
  compareResults,
  compareModel,
}: Props) {
  const showCompare = !!compareResults && !!compareModel && compareModel !== model;

  const rows: Row[] = [...teams]
    .map((t) => ({
      id: t.team.id,
      name: t.team.abbrev,
      probability: modelResults.get(t.team.id)?.playoffProbability ?? 0,
      comparePct: showCompare ? compareResults!.get(t.team.id)?.playoffProbability ?? 0 : undefined,
      inPlayoffs: t.currentRank <= playoffSpots,
    }))
    .sort((a, b) => b.probability - a.probability);

  const seriesColor = `var(${MODEL_META[model].colorVar})`;
  const compareColor = showCompare ? `var(${MODEL_META[compareModel!].colorVar})` : undefined;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        Playoff probability — {MODEL_META[model].label}
        {showCompare && ` vs. ${MODEL_META[compareModel!].label}`}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        Share of simulated/projected outcomes that finish inside the top {playoffSpots}.
      </div>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * (showCompare ? 30 : 22), 200)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
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
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Row;
              return (
                <div className="chart-tooltip">
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="tt-value">{row.probability.toFixed(1)}%</span>
                    <span className="tt-label">{MODEL_META[model].label}</span>
                  </div>
                  {showCompare && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="tt-value">{(row.comparePct ?? 0).toFixed(1)}%</span>
                      <span className="tt-label">{MODEL_META[compareModel!].label}</span>
                    </div>
                  )}
                  <div className="tt-label">{row.name}</div>
                </div>
              );
            }}
          />
          {showCompare && (
            <Legend
              formatter={(value) =>
                value === "probability" ? MODEL_META[model].label : MODEL_META[compareModel!].label
              }
              wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
            />
          )}
          <Bar dataKey="probability" radius={[0, 4, 4, 0]} maxBarSize={showCompare ? 10 : 16}>
            {rows.map((r) => (
              <Cell key={r.id} fill={seriesColor} opacity={r.inPlayoffs ? 1 : 0.55} />
            ))}
          </Bar>
          {showCompare && (
            <Bar
              dataKey="comparePct"
              fill={compareColor}
              radius={[0, 4, 4, 0]}
              maxBarSize={10}
              opacity={0.85}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
