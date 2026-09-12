"use client";

import { useState } from "react";
import { HISTORICAL_CUTOFFS, summarizeConference } from "@/lib/historicalCutoffs";
import type { Conference } from "@/lib/types";

export default function HistoricalCutoffTable() {
  const [open, setOpen] = useState(false);
  const east = summarizeConference("East");
  const west = summarizeConference("West");

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Historical cutoff data {open ? "▾" : "▸"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {open ? "Hide" : "Show"} the underlying seasons
        </span>
      </button>

      {!open && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
          East cutoff has ranged {east.minCutoffPpg.toFixed(2)}–{east.maxCutoffPpg.toFixed(2)} pts/game
          (median {east.medianCutoffPpg.toFixed(2)}) across the last {east.seasons} seasons; West{" "}
          {west.minCutoffPpg.toFixed(2)}–{west.maxCutoffPpg.toFixed(2)} (median{" "}
          {west.medianCutoffPpg.toFixed(2)}).
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
            The Historical Cutoff model compares a team&apos;s current points-per-game against the
            cutoff (points-per-game of the last team into the playoffs) in each of these seasons for
            its own conference. 2020 is excluded as a COVID-irregular season. Rows marked{" "}
            <strong>changed</strong> had a different number of playoff spots than the season before.
          </p>
          {(["East", "West"] as Conference[]).map((conf) => (
            <div key={conf} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {conf === "East" ? "Eastern" : "Western"} Conference
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Season</th>
                      <th>Teams</th>
                      <th>Spots</th>
                      <th>GP</th>
                      <th>Cutoff Pts</th>
                      <th>Cutoff PPG</th>
                      <th>First Out Pts</th>
                      <th>Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORICAL_CUTOFFS.filter((s) => s.conference === conf)
                      .sort((a, b) => a.season - b.season)
                      .map((s) => (
                        <tr key={`${s.conference}-${s.season}`}>
                          <td>{s.season}</td>
                          <td className="hide-narrow">{s.teamsInConference}</td>
                          <td>{s.playoffSpots}</td>
                          <td className="hide-narrow">{s.gamesPlayed}</td>
                          <td style={{ fontWeight: 600 }}>{s.cutoffPoints}</td>
                          <td>{(s.cutoffPoints / s.gamesPlayed).toFixed(2)}</td>
                          <td className="hide-narrow">{s.firstOutPoints}</td>
                          <td>
                            {s.spotsChangedFromPriorYear ? (
                              <span title={s.note} style={{ color: "var(--status-warning)", fontWeight: 600 }}>
                                changed
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
