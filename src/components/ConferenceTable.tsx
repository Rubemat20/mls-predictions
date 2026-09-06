"use client";

import type { ModelKey, TeamModelResult, TeamStats } from "@/lib/types";
import { MODEL_META, formatPct, formatPoints, probColor } from "@/lib/format";

interface Props {
  conference: "East" | "West";
  teams: TeamStats[];
  modelResults: Map<string, TeamModelResult>;
  model: ModelKey;
  playoffSpots: number;
  directSpots: number;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
}

export default function ConferenceTable({
  conference,
  teams,
  modelResults,
  model,
  playoffSpots,
  directSpots,
  selectedTeamId,
  onSelectTeam,
}: Props) {
  const sorted = [...teams].sort((a, b) => a.currentRank - b.currentRank);
  const maxProjected = Math.max(
    ...sorted.map((t) => modelResults.get(t.team.id)?.projectedPointsHigh ?? t.points)
  );

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--gridline)",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {conference === "East" ? "Eastern Conference" : "Western Conference"}
      </div>
      <div
        style={{ overflowX: "auto" }}
        tabIndex={0}
        role="region"
        aria-label={`${conference === "East" ? "Eastern" : "Western"} Conference standings table, scrollable horizontally`}
      >
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>GP</th>
              <th>W-D-L</th>
              <th>Pts</th>
              <th>Home Win%</th>
              <th>Proj. Pts</th>
              <th>Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, idx) => {
              const res = modelResults.get(t.team.id);
              const rowClass =
                idx + 1 === playoffSpots || idx + 1 === sorted.length
                  ? "cutoff-row"
                  : "";
              const bg =
                idx + 1 <= directSpots
                  ? "var(--playoff-in-bg)"
                  : idx + 1 <= playoffSpots
                  ? "var(--playoff-wildcard-bg)"
                  : "transparent";
              const p10 = res?.projectedPointsLow ?? t.points;
              const p90 = res?.projectedPointsHigh ?? t.points;
              const mean = res?.projectedPoints ?? t.points;
              const rangeLeft = (Math.max(p10, 0) / maxProjected) * 100;
              const rangeWidth = ((p90 - Math.max(p10, 0)) / maxProjected) * 100;
              const meanLeft = (mean / maxProjected) * 100;
              const prob = res?.playoffProbability ?? 0;

              const isSelected = selectedTeamId === t.team.id;
              return (
                <tr
                  key={t.team.id}
                  className={[rowClass, onSelectTeam ? "team-row-clickable" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    background: isSelected ? "var(--gridline)" : bg,
                  }}
                  onClick={onSelectTeam ? () => onSelectTeam(t.team.id) : undefined}
                  title={onSelectTeam ? `See what ${t.team.name} needs to make the playoffs` : undefined}
                >
                  <td>{idx + 1}</td>
                  <td>
                    <div className="team-cell">
                      {t.team.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.team.logo} alt="" className="team-logo" />
                      )}
                      <span style={{ textDecoration: onSelectTeam ? "underline" : undefined, textDecorationColor: "var(--border-hairline)", textUnderlineOffset: 3 }}>
                        {t.team.name}
                      </span>
                    </div>
                  </td>
                  <td>{t.gamesPlayed}</td>
                  <td>
                    {t.wins}-{t.draws}-{t.losses}
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.points}</td>
                  <td>{Math.round(t.homeWinPct * 100)}%</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {formatPoints(mean)}
                      </span>
                      <div className="range-track" style={{ minWidth: 90 }}>
                        <div
                          className="range-fill"
                          style={{ left: `${rangeLeft}%`, width: `${Math.max(rangeWidth, 1)}%` }}
                        />
                        <div className="range-mean" style={{ left: `${meanLeft}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="prob-track">
                        <div
                          className="prob-fill"
                          style={{ width: `${prob}%`, background: probColor(prob) }}
                        />
                      </div>
                      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 34 }}>
                        {formatPct(prob)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          color: "var(--text-muted)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <LegendDot color="var(--playoff-in-bg)" border label={`Top ${directSpots}: direct to Round One`} />
        <LegendDot
          color="var(--playoff-wildcard-bg)"
          border
          label={`${directSpots + 1}-${playoffSpots}: Wild Card`}
        />
        <span>Model: {MODEL_META[model].label}</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          border: border ? "1px solid var(--border-hairline)" : undefined,
        }}
      />
      {label}
    </span>
  );
}
