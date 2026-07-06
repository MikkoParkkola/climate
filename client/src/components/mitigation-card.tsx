import { useState } from "react";
import { mitigationCooling } from "@/lib/mitigation";
import { CARD, BORDER, MUTED, ACCENT, GREEN, FONT_MONO } from "@/lib/climate-constants";

function Knob({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 11.5, color: MUTED, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: value > 0 ? ACCENT : MUTED }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ width: "100%", accentColor: "hsl(24, 88%, 56%)", cursor: "pointer" }}
      />
    </label>
  );
}

// "What local action could do" — an interactive, honest screening estimate of
// how much street-level heat tree canopy and cool roofs could shave off. It does
// NOT change the regional projection; it shows the local, theoretical offset
// (cited: Bowler et al. 2010 + cool-roof studies) so a visitor can feel that the
// future isn't purely fixed. Self-contained: its own state, no app-wide rewiring.
export function MitigationCard({ tempChange, year }: { tempChange: number; year: number }) {
  const [canopy, setCanopy] = useState(0);
  const [roof, setRoof] = useState(0);
  const { coolingC, basis } = mitigationCooling(canopy / 100, roof / 100);
  const anyAction = canopy > 0 || roof > 0;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>
        What local action could do here
      </div>
      <Knob label="Tree canopy" value={canopy} onChange={setCanopy} />
      <Knob label="Cool roofs" value={roof} onChange={setRoof} />
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45, color: "hsl(220, 16%, 90%)" }}>
        {anyAction ? (
          <>
            Local greening and reflective roofs at this level could shave up to{" "}
            <strong style={{ color: GREEN }}>−{coolingC.toFixed(1)}°C</strong> off street-level heat — against about{" "}
            <strong style={{ color: ACCENT }}>+{tempChange.toFixed(1)}°C</strong> of projected warming by {year}.
          </>
        ) : (
          <>Move the sliders: full canopy and cool roofs could offset up to <strong style={{ color: GREEN }}>−2.5°C</strong> of local heat at street level.</>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
        {basis} It does not change the regional climate projection above — only the felt heat where people live.
      </div>
    </div>
  );
}
