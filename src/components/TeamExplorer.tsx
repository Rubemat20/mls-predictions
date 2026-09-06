"use client";

import { useMemo, useState } from "react";
import type { Match, ModelKey, SimModelKey, TeamStats, DashboardPayload } from "@/lib/types";
import { runSimulation, type SimTeamMeta, type MatchOutcome } from "@/lib/simulate";
import { formatPct, formatPoints, probColor, MODEL_META } from "@/lib/format";
import { SHORT_REST_DAYS } from "@/lib/recordModel";

const EXPLORER_SIMULATIONS = 4000;
const SHORT_REST_LABEL = `${SHORT_REST_DAYS} or fewer days' rest`;

type TeamOutcome = "W" | "D" | "L";

interface Props {
  team: TeamStats;
  allTeams: TeamStats[];
  remainingMatches: Match[];
  matchProbabilities: DashboardPayload["matchProbabilities"];
  restFlags: DashboardPayload["restFlags"];
  playoffSpots: number;
  model: ModelKey;
  onClose: () => void;
}

const SIM_MODEL_KEYS: SimModelKey[] = ["montecarlo", "elo", "record"];

export default function TeamExplorer({
  team,
  allTeams,
  remainingMatches,
  matchProbabilities,
  restFlags,
  playoffSpots,
  model,
  onClose,
}: Props) {
  const [explorerModel, setExplorerModel] = useState<SimModelKey>(
    SIM_MODEL_KEYS.includes(model as SimModelKey) ? (model as SimModelKey) : "montecarlo"
  );
  const [outcomes, setOutcomes] = useState<Record<string, TeamOutcome>>({});

  const teamsById = useMemo(() => new Map(allTeams.map((t) => [t.team.id, t])), [allTeams]);

  const teamGames = useMemo(
    () =>
      remainingMatches
        .filter((m) => m.homeId === team.team.id || m.awayId === team.team.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [remainingMatches, team.team.id]
  );

  const probs = matchProbabilities[explorerModel];

  const simTeams: SimTeamMeta[] = useMemo(
    () =>
      allTeams.map((t) => ({
        id: t.team.id,
        conference: t.team.conference,
        currentPoints: t.points,
        currentGoalDiff: t.goalDiff,
      })),
    [allTeams]
  );

  const matchProbs = useMemo(
    () =>
      remainingMatches.map((m) => {
        const p = probs[m.id] ?? { pHome: 0.4, pDraw: 0.24, pAway: 0.36 };
        return { id: m.id, homeId: m.homeId, awayId: m.awayId, ...p };
      }),
    [remainingMatches, probs]
  );

  function toMatchOutcome(match: Match, teamOutcome: TeamOutcome): MatchOutcome {
    const teamIsHome = match.homeId === team.team.id;
    if (teamOutcome === "D") return "D";
    if (teamOutcome === "W") return teamIsHome ? "H" : "A";
    return teamIsHome ? "A" : "H";
  }

  const fixedOutcomes = useMemo(() => {
    const map = new Map<string, MatchOutcome>();
    for (const m of teamGames) {
      const chosen = outcomes[m.id];
      if (chosen) map.set(m.id, toMatchOutcome(m, chosen));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomes, teamGames]);

  const hasSelections = fixedOutcomes.size > 0;

  const baseline = useMemo(
    () => runSimulation(simTeams, matchProbs, playoffSpots, EXPLORER_SIMULATIONS),
    [simTeams, matchProbs, playoffSpots]
  );

  const conditional = useMemo(
    () =>
      hasSelections
        ? runSimulation(simTeams, matchProbs, playoffSpots, EXPLORER_SIMULATIONS, fixedOutcomes)
        : baseline,
    [simTeams, matchProbs, playoffSpots, fixedOutcomes, hasSelections, baseline]
  );

  const result = conditional[team.team.id];
  const baseProb = baseline[team.team.id]?.playoffProbability ?? 0;

  const pathProbability = useMemo(() => {
    let p = 1;
    for (const m of teamGames) {
      const chosen = outcomes[m.id];
      if (!chosen) continue;
      const leg = probs[m.id];
      if (!leg) continue;
      const teamIsHome = m.homeId === team.team.id;
      if (chosen === "D") p *= leg.pDraw;
      else if (chosen === "W") p *= teamIsHome ? leg.pHome : leg.pAway;
      else p *= teamIsHome ? leg.pAway : leg.pHome;
    }
    return p * 100;
  }, [outcomes, teamGames, probs, team.team.id]);

  function setOutcome(matchId: string, outcome: TeamOutcome | null) {
    setOutcomes((prev) => {
      const next = { ...prev };
      if (outcome === null) delete next[matchId];
      else next[matchId] = outcome;
      return next;
    });
  }

  function winOut() {
    const next: Record<string, TeamOutcome> = {};
    for (const m of teamGames) next[m.id] = "W";
    setOutcomes(next);
  }
  function loseOut() {
    const next: Record<string, TeamOutcome> = {};
    for (const m of teamGames) next[m.id] = "L";
    setOutcomes(next);
  }
  function reset() {
    setOutcomes({});
  }

  const delta = result ? result.playoffProbability - baseProb : 0;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {team.team.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.team.logo} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{team.team.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              What do they need to make the playoffs? Set results for their remaining games below.
            </div>
          </div>
        </div>
        <button className="pill" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Using model:</span>
        {SIM_MODEL_KEYS.map((k) => (
          <button
            key={k}
            className="pill"
            data-active={explorerModel === k}
            onClick={() => setExplorerModel(k)}
          >
            {MODEL_META[k].label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginTop: 16,
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--page-plane)",
          border: "1px solid var(--gridline)",
        }}
      >
        <Stat label="Current baseline" value={formatPct(baseProb)} sub="No games fixed" />
        <Stat
          label={hasSelections ? "Odds with these results" : "Odds (unconditional)"}
          value={result ? formatPct(result.playoffProbability) : "—"}
          sub={hasSelections ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pp vs. baseline` : "Same as baseline"}
          color={probColor(result?.playoffProbability ?? 0)}
        />
        <Stat
          label="Likelihood of this exact path"
          value={hasSelections ? formatPct(pathProbability) : "—"}
          sub={hasSelections ? `${fixedOutcomes.size} of ${teamGames.length} games fixed` : "Pick some results below"}
        />
        <Stat
          label="Projected final points"
          value={result ? formatPoints(result.projectedPoints) : "—"}
          sub={result ? `range ${formatPoints(result.p10)}–${formatPoints(result.p90)}` : undefined}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button className="pill" onClick={winOut}>
          Win out
        </button>
        <button className="pill" onClick={loseOut}>
          Lose out
        </button>
        <button className="pill" onClick={reset} disabled={!hasSelections}>
          Reset
        </button>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        {teamGames.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            No games left on the schedule for {team.team.name}.
          </div>
        )}
        {teamGames.map((m) => {
          const opponentId = m.homeId === team.team.id ? m.awayId : m.homeId;
          const opponent = teamsById.get(opponentId);
          const isHome = m.homeId === team.team.id;
          const leg = probs[m.id];
          const chosen = outcomes[m.id];
          const winPct = leg ? (isHome ? leg.pHome : leg.pAway) : undefined;
          const drawPct = leg?.pDraw;
          const lossPct = leg ? (isHome ? leg.pAway : leg.pHome) : undefined;
          const rest = restFlags[m.id];
          const teamShort = rest ? (isHome ? rest.homeShort : rest.awayShort) : false;
          const opponentShort = rest ? (isHome ? rest.awayShort : rest.homeShort) : false;

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                background: chosen ? "var(--page-plane)" : "transparent",
                border: "1px solid var(--gridline)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", width: 30 }}>
                  {isHome ? "vs" : "@"}
                </span>
                {opponent?.team.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opponent.team.logo} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {opponent?.team.name ?? opponentId}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                {teamShort && (
                  <span
                    title={`${team.team.name} on ${SHORT_REST_LABEL}`}
                    style={{ fontSize: 10, fontWeight: 700, color: "var(--status-warning)" }}
                  >
                    ⚡ short rest
                  </span>
                )}
                {opponentShort && (
                  <span
                    title={`${opponent?.team.name ?? "Opponent"} on ${SHORT_REST_LABEL}`}
                    style={{ fontSize: 10, color: "var(--text-muted)" }}
                  >
                    (opp. short rest)
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <OutcomeButton
                  label="Auto"
                  active={!chosen}
                  onClick={() => setOutcome(m.id, null)}
                />
                <OutcomeButton
                  label={`Win${winPct !== undefined ? ` ${Math.round(winPct * 100)}%` : ""}`}
                  active={chosen === "W"}
                  onClick={() => setOutcome(m.id, "W")}
                />
                <OutcomeButton
                  label={`Draw${drawPct !== undefined ? ` ${Math.round(drawPct * 100)}%` : ""}`}
                  active={chosen === "D"}
                  onClick={() => setOutcome(m.id, "D")}
                />
                <OutcomeButton
                  label={`Loss${lossPct !== undefined ? ` ${Math.round(lossPct * 100)}%` : ""}`}
                  active={chosen === "L"}
                  onClick={() => setOutcome(m.id, "L")}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
        &quot;Auto&quot; lets that game (and every other match league-wide) play out randomly per
        the {MODEL_META[explorerModel].label} model, {EXPLORER_SIMULATIONS.toLocaleString()} times.
        Fixing a result forces that outcome on every trial while everything else — including this
        team&apos;s other undecided games and every other team&apos;s schedule — keeps simulating.
        &quot;Likelihood of this exact path&quot; is just the chance of getting exactly the results
        you picked, multiplied together; it does not need to be high for those results to still be
        worth knowing about.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{sub}</div>}
    </div>
  );
}

function OutcomeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className="outcome-btn" data-active={active} onClick={onClick}>
      {label}
    </button>
  );
}
