// ── "Your conditions" drawer — the customization knobs ────────────────────────
// Slide-over with plain-language sliders. Every change re-scores locally and
// instantly (no server call) via the shared prefs store. Defaults reproduce the
// canonical grounded score, so this is opt-in: 95% never open it.
// Honesty: personalized scores are a "your view" lens; rankings + methodology use
// defaults (see docs/architecture/CUSTOMIZATION_KNOBS.md).

import { RotateCcw, X } from "lucide-react";
import { ACCENT, BORDER, CARD, FONT_DISPLAY, FONT_MONO, MUTED } from "@/lib/climate-constants";
import { DEFAULT_PREFS, prefsAreDefault, type Prefs } from "@/lib/habitability";
import { usePrefs } from "@/lib/use-prefs";
import { Term } from "@/components/climate-term";
import { ScoreBreakdown, type ScoreSensitivityInput } from "@/components/score-sensitivity";
import type { GlossaryKey } from "@/lib/glossary";

interface Knob {
  field: keyof Prefs;
  label: string;
  help: string; // plain-language one-liner
  min: number;
  max: number;
  step: number;
  unit?: string;
  termKey?: GlossaryKey;
  fmt?: (v: number) => string;
}

const KNOBS: Knob[] = [
  { field: "comfortOptimumC", label: "Ideal yearly temperature", help: "The average temperature you'd find most comfortable to live in.", min: 5, max: 30, step: 1, unit: "°C" },
  { field: "heatSlope", label: "How much heat bothers you", help: "Higher means hot places lose points faster.", min: 1.5, max: 6, step: 0.5, fmt: (v) => (v >= 4.5 ? "a lot" : v >= 3 ? "normal" : "a little") },
  { field: "coldSlope", label: "How much cold bothers you", help: "Higher means cold places lose points faster.", min: 1.5, max: 6, step: 0.5, fmt: (v) => (v >= 4.5 ? "a lot" : v >= 3 ? "normal" : "a little") },
  { field: "droughtPer", label: "How much drought bothers you", help: "Higher means dry, water-short places lose points faster.", min: 0.1, max: 0.5, step: 0.05, termKey: "drought_risk", fmt: (v) => (v >= 0.4 ? "a lot" : v >= 0.2 ? "normal" : "a little") },
  { field: "floodPer", label: "How much flooding bothers you", help: "Higher means flood-prone places lose points faster.", min: 0.1, max: 0.5, step: 0.05, termKey: "flood_risk", fmt: (v) => (v >= 0.4 ? "a lot" : v >= 0.2 ? "normal" : "a little") },
];

export function YourConditionsDrawer({ open, onClose, breakdown, modelScore, category }: {
  open: boolean;
  onClose: () => void;
  breakdown: ScoreSensitivityInput[];
  modelScore: number;
  category: string;
}) {
  const [prefs, setPrefs] = usePrefs();
  const isDefault = prefsAreDefault(prefs);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.2s ease",
        }}
      />
      <aside
        role="dialog"
        aria-label="Your conditions"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(360px, 90vw)", zIndex: 61,
          background: CARD, borderLeft: `1px solid ${BORDER}`, boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
          transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 600 }}>Your conditions</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>Tune the score to what <em>you</em> can live with.</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ all: "unset", cursor: "pointer", color: MUTED, padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", display: "grid", gap: 20 }}>
          <ScoreBreakdown inputs={breakdown} modelScore={modelScore} category={category} />
          {KNOBS.map((k) => {
            const value = prefs[k.field];
            return (
              <div key={k.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label htmlFor={`knob-${k.field}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {k.termKey ? <Term k={k.termKey}>{k.label}</Term> : k.label}
                  </label>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: ACCENT }}>
                    {k.fmt ? k.fmt(value) : `${value}${k.unit ?? ""}`}
                  </span>
                </div>
                <input
                  id={`knob-${k.field}`}
                  type="range"
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={value}
                  onChange={(e) => setPrefs({ ...prefs, [k.field]: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: ACCENT, cursor: "pointer" }}
                />
                <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4, marginTop: 3 }}>{k.help}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", padding: "14px 20px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.45, marginBottom: 12 }}>
            {isDefault
              ? "These are the standard settings — the score you see is the grounded default everyone shares."
              : "You're seeing your own view. The underlying climate data is unchanged; only how it's weighted for you is. Global rankings always use the standard settings."}
          </div>
          <button
            onClick={() => setPrefs({ ...DEFAULT_PREFS })}
            disabled={isDefault}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
              border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.04)",
              color: isDefault ? MUTED : ACCENT, fontSize: 12, cursor: isDefault ? "default" : "pointer", opacity: isDefault ? 0.5 : 1,
            }}
          >
            <RotateCcw style={{ width: 13, height: 13 }} /> Reset to standard
          </button>
        </div>
      </aside>
    </>
  );
}
