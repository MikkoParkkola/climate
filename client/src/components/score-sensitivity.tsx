// ── Read-only score breakdown ─────────────────────────────────────────────────
// Shows how the current grounded habitability score is composed (comfort +, heat
// penalty -, etc). Lives inside the "Your conditions" drawer so understanding the
// score and tuning it sit in one place.
//
// History: this replaced an interactive "score sensitivity" what-if panel whose
// 0-150% weight sliders + per-component checkboxes read like data, produced a
// separate "what-if score", and duplicated the real preference knobs. Merged into
// Your conditions per operator decision 2026-06-29.

import { BORDER, GREEN, MUTED, RED, FONT_MONO } from "@/lib/climate-constants";

export interface ScoreSensitivityInput {
  key: string;
  label: string;
  kind: "contribution" | "penalty";
  value: number;
  description: string;
}

function signed(value: number, kind: "contribution" | "penalty"): string {
  const v = Math.abs(value).toFixed(1);
  return kind === "penalty" ? `−${v}` : `+${v}`;
}

export function ScoreBreakdown({
  inputs, modelScore, category,
}: {
  inputs: ScoreSensitivityInput[];
  modelScore: number;
  category: string;
}) {
  const active = inputs.filter((i) => Number.isFinite(i.value));
  if (active.length === 0) return null;
  return (
    <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>How this score is built</span>
        <span style={{ fontSize: 12, color: MUTED }}>{modelScore}/100 · {category}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {active.map((i) => (
          <div key={i.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, alignItems: "baseline" }}>
            <span style={{ color: "rgba(255,255,255,0.82)" }}>{i.label}</span>
            <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: i.kind === "penalty" ? RED : GREEN }}>{signed(i.value, i.kind)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45, marginTop: 10 }}>
        These are the grounded pieces of your score. The sliders below weight them to your own conditions.
      </div>
    </div>
  );
}
