"use client";

import { useCallback, useEffect, useState } from "react";
import type { Conference, DashboardPayload, ModelKey } from "@/lib/types";
import { MODEL_META, formatRelativeTime } from "@/lib/format";
import ConferenceTable from "./ConferenceTable";
import ProbabilityChart from "./ProbabilityChart";
import ModelCompareChart from "./ModelCompareChart";

const REFRESH_MS = 5 * 60 * 1000;

type ConfFilter = "all" | Conference;

export default function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confFilter, setConfFilter] = useState<ConfFilter>("all");
  const [model, setModel] = useState<ModelKey>("montecarlo");

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(`/api/data${force ? "?fresh=1" : ""}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = (await res.json()) as DashboardPayload;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
        Loading live MLS standings…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--status-critical)" }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const confsToShow: Conference[] =
    confFilter === "all" ? ["East", "West"] : [confFilter];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px 60px", width: "100%" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>MLS Playoff Chances</h1>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {data.season} season · updated {formatRelativeTime(data.generatedAt)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, maxWidth: 720 }}>
          Live standings and schedule from ESPN, projected forward with three models.
          Top {data.directSpotsPerConference} per conference go straight to Round One;
          seeds {data.directSpotsPerConference + 1}–{data.playoffSpotsPerConference} play
          the Wild Card round.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <FilterGroup
            options={[
              { value: "all", label: "Both Conferences" },
              { value: "East", label: "Eastern" },
              { value: "West", label: "Western" },
            ]}
            value={confFilter}
            onChange={(v) => setConfFilter(v as ConfFilter)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <FilterGroup
            options={(Object.keys(MODEL_META) as ModelKey[]).map((k) => ({
              value: k,
              label: MODEL_META[k].label,
            }))}
            value={model}
            onChange={(v) => setModel(v as ModelKey)}
          />
          <button
            className="pill"
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ fontWeight: 600 }}
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: confsToShow.length === 2 ? "1fr 1fr" : "1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {confsToShow.map((conf) => (
          <ConferenceTable
            key={conf}
            conference={conf}
            teams={data.teams.filter((t) => t.team.conference === conf)}
            modelResults={new Map(data.models[model].map((m) => [m.teamId, m]))}
            model={model}
            playoffSpots={data.playoffSpotsPerConference}
            directSpots={data.directSpotsPerConference}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: confsToShow.length === 2 ? "1fr 1fr" : "1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {confsToShow.map((conf) => (
          <ProbabilityChart
            key={conf}
            teams={data.teams.filter((t) => t.team.conference === conf)}
            modelResults={new Map(data.models[model].map((m) => [m.teamId, m]))}
            model={model}
            playoffSpots={data.playoffSpotsPerConference}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: confsToShow.length === 2 ? "1fr 1fr" : "1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {confsToShow.map((conf) => (
          <ModelCompareChart
            key={conf}
            teams={data.teams.filter((t) => t.team.conference === conf)}
            models={data.models}
          />
        ))}
      </div>

      <footer style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <strong style={{ color: "var(--text-secondary)" }}>Methodology.</strong>{" "}
        <em>Points Pace</em> extrapolates each team&apos;s current home and away
        points-per-game across its remaining fixtures. <em>Monte Carlo</em> simulates the
        rest of the season {data.simulations.toLocaleString()} times per team using a
        current-form power rating and each team&apos;s own home-win rate (shrunk toward
        the league average). <em>Elo Rating</em> replays every completed match with a
        home-field adjustment to build a rating per team, then runs the same simulation
        using Elo-implied win probabilities. League average draw rate this season:{" "}
        {Math.round(data.leagueDrawRate * 100)}%. Data source: ESPN. Playoff cutoff shown
        is today&apos;s actual standings position, not a projection.
      </footer>
    </div>
  );
}

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className="pill"
          data-active={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
