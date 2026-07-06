import { MUTED, ACCENT, FONT_MONO } from "@/lib/climate-constants";

// The livability score in context (MIK-6792): a 0-100 bar coloured by the same
// green→amber→red livable zones as the runway, with a marker for today and for
// the projected year — so the headline number is never orphaned, and the slide
// from "liveable today" toward "stressed" reads at a glance.
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function LivabilityBar({ score, baselineScore, year }: { score: number; baselineScore?: number; year: number }) {
  const s = clamp(score);
  const base = baselineScore == null ? null : clamp(baselineScore);
  const zones = "linear-gradient(90deg, hsl(6,72%,50%) 0%, hsl(6,72%,50%) 40%, hsl(38,72%,52%) 55%, hsl(150,38%,46%) 72%, hsl(150,38%,46%) 100%)";

  const tick = (v: number, color: string, label: string, above: boolean) => (
    <div style={{ position: "absolute", left: `${v}%`, top: 0, transform: "translateX(-50%)" }}>
      {above && <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color, whiteSpace: "nowrap", marginBottom: 2, textAlign: "center" }}>{label}</div>}
      <div style={{ width: 2, height: 22, background: color, margin: "0 auto", boxShadow: "0 0 0 1px hsl(222,16%,8%)" }} />
      {!above && <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color, whiteSpace: "nowrap", marginTop: 2, textAlign: "center" }}>{label}</div>}
    </div>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 18 }}>
        Livability score, today vs {year}
      </div>
      <div style={{ position: "relative", margin: "0 6px" }}>
        {base != null && tick(base, "hsl(220,16%,72%)", `today ${Math.round(base)}`, true)}
        <div style={{ height: 10, borderRadius: 5, background: zones, opacity: 0.85 }} />
        {tick(s, ACCENT, `${year} ${Math.round(s)}`, false)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, color: MUTED, marginTop: 14 }}>
        <span>stressed</span>
        <span>livable</span>
      </div>
    </div>
  );
}
