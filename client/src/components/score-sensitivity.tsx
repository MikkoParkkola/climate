import { useMemo, useState, type CSSProperties } from "react";

export interface ScoreSensitivityInput {
  key: string;
  label: string;
  kind: "contribution" | "penalty";
  value: number;
  description: string;
}

interface ScoreSensitivityProps {
  modelScore: number;
  category: string;
  inputs: ScoreSensitivityInput[];
}

const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "hsl(215,20%,65%)";
const RED = "#ef4444";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const BLUE = "#3b82f6";

const panelStyle: CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: `1px solid ${BORDER}`,
  borderLeft: `3px solid ${BLUE}`,
  borderRadius: 12,
  padding: 18,
  backdropFilter: "blur(12px)",
};

function clampScore(value: number) {
  return Math.max(10, Math.min(100, value));
}

function categoryFor(score: number) {
  return score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
}

function scoreColor(score: number) {
  return score >= 85 ? GREEN : score >= 70 ? "#4ade80" : score >= 60 ? AMBER : score >= 40 ? "#f97316" : RED;
}

function signed(value: number, decimals = 1) {
  const rounded = value.toFixed(decimals);
  return value >= 0 ? `+${rounded}` : rounded;
}

export default function ScoreSensitivity({ modelScore, category, inputs }: ScoreSensitivityProps) {
  const activeInputs = inputs.filter((input) => Number.isFinite(input.value));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(activeInputs.map((input) => [input.key, true])));
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(activeInputs.map((input) => [input.key, 1])));

  const selected = useMemo(() => {
    const rows = activeInputs.map((input) => {
      const isEnabled = enabled[input.key] ?? true;
      const weight = weights[input.key] ?? 1;
      const weighted = isEnabled ? input.value * weight : 0;
      const signedValue = input.kind === "penalty" ? -weighted : weighted;
      return { ...input, isEnabled, weight, weighted, signedValue };
    });
    const contribution = rows.filter((row) => row.kind === "contribution").reduce((sum, row) => sum + row.weighted, 0);
    const penalty = rows.filter((row) => row.kind === "penalty").reduce((sum, row) => sum + row.weighted, 0);
    const score = clampScore(contribution - penalty);
    return { rows, contribution, penalty, score };
  }, [activeInputs, enabled, weights]);

  const defaultRebuild = useMemo(() => {
    const contribution = activeInputs.filter((input) => input.kind === "contribution").reduce((sum, input) => sum + input.value, 0);
    const penalty = activeInputs.filter((input) => input.kind === "penalty").reduce((sum, input) => sum + input.value, 0);
    return clampScore(contribution - penalty);
  }, [activeInputs]);

  if (activeInputs.length === 0) return null;

  const delta = selected.score - modelScore;
  const deltaColor = Math.abs(delta) < 0.05 ? MUTED : delta >= 0 ? GREEN : RED;
  const reset = () => {
    setEnabled(Object.fromEntries(activeInputs.map((input) => [input.key, true])));
    setWeights(Object.fromEntries(activeInputs.map((input) => [input.key, 1])));
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 280px" }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Score sensitivity</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.66)", lineHeight: 1.58, margin: "6px 0 0" }}>
            Adjust or hide the visible score components to see how much the presentation score depends on each part. This is a transparency tool, not a new climate forecast.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>What-if score</div>
          <div style={{ color: scoreColor(selected.score), fontSize: 22, fontWeight: 900 }}>{selected.score.toFixed(1)}</div>
          <div style={{ fontSize: 10.5, color: deltaColor }}>{signed(delta, 1)} pts vs model</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px", background: "rgba(255,255,255,0.035)" }}>
          <div style={{ fontSize: 9.5, color: MUTED }}>Model score</div>
          <div style={{ fontSize: 13, fontWeight: 850, color: scoreColor(modelScore) }}>{modelScore}/100</div>
          <div style={{ fontSize: 9, color: MUTED }}>{category}</div>
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px", background: "rgba(255,255,255,0.035)" }}>
          <div style={{ fontSize: 9.5, color: MUTED }}>Formula rebuild</div>
          <div style={{ fontSize: 13, fontWeight: 850, color: scoreColor(defaultRebuild) }}>{defaultRebuild.toFixed(1)}/100</div>
          <div style={{ fontSize: 9, color: MUTED }}>rounded components</div>
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px", background: "rgba(255,255,255,0.035)" }}>
          <div style={{ fontSize: 9.5, color: MUTED }}>What-if category</div>
          <div style={{ fontSize: 13, fontWeight: 850, color: scoreColor(selected.score) }}>{categoryFor(selected.score)}</div>
          <div style={{ fontSize: 9, color: MUTED }}>not model output</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {selected.rows.map((row) => {
          const controlId = `score-sensitivity-${row.key}`;
          const weightPct = Math.round(row.weight * 100);
          const color = row.kind === "penalty" ? RED : GREEN;
          return (
            <div key={row.key} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, background: row.isEnabled ? "rgba(255,255,255,0.032)" : "rgba(255,255,255,0.018)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "start", marginBottom: 8 }}>
                <label htmlFor={controlId} style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0, cursor: "pointer" }}>
                  <input
                    id={controlId}
                    type="checkbox"
                    checked={row.isEnabled}
                    onChange={(event) => setEnabled((current) => ({ ...current, [row.key]: event.target.checked }))}
                    style={{ marginTop: 2, accentColor: color }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: row.isEnabled ? "rgba(255,255,255,0.92)" : MUTED }}>{row.label}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: MUTED, lineHeight: 1.45 }}>{row.description}</span>
                  </span>
                </label>
                <div style={{ fontSize: 12, fontWeight: 850, color, textAlign: "right" }}>
                  {row.kind === "penalty" ? "-" : "+"}{row.weighted.toFixed(1)}
                  <div style={{ fontSize: 9, color: MUTED, fontWeight: 600 }}>{weightPct}%</div>
                </div>
              </div>
              <input
                aria-label={`${row.label} score weight`}
                type="range"
                min="0"
                max="150"
                step="5"
                value={weightPct}
                onChange={(event) => setWeights((current) => ({ ...current, [row.key]: Number(event.target.value) / 100 }))}
                style={{ width: "100%", accentColor: color, display: "block" }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <p style={{ margin: 0, flex: "1 1 320px", fontSize: 10.5, lineHeight: 1.55, color: MUTED }}>
          Formula receipt: clamp 10-100 of visible contribution components minus visible penalty components. Sliders multiply the already weighted component values returned by the API; hiding sets that component to zero. Missing domains such as local adaptation quality, healthcare, governance, migration, conflict, biodiversity, wildfire, crops, and freshwater systems are still outside the score.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ border: `1px solid ${BLUE}50`, background: `${BLUE}14`, color: "white", borderRadius: 7, padding: "7px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
        >
          Reset weights
        </button>
      </div>
    </div>
  );
}
