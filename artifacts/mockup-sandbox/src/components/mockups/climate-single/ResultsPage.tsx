import { useState, useMemo } from "react";

// ── Theme ──────────────────────────────────────────────────────────────────
const BG     = "hsl(222,47%,8%)";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED  = "hsl(215,20%,65%)";
const RED    = "#ef4444";
const BLUE   = "#3b82f6";
const ORANGE = "#f97316";
const GREEN  = "#22c55e";
const AMBER  = "#f59e0b";
const PURPLE = "#a78bfa";
const CYAN   = "hsl(192,91%,46%)";

const card: React.CSSProperties = {
  backgroundColor: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  backdropFilter: "blur(12px)",
};

// ── Year data model (Amsterdam / Netherlands) ──────────────────────────────
const BASE_MONTHLY_TEMPS  = [1.5, 2.1, 5.4, 9.8, 13.6, 16.9, 19.2, 18.8, 15.4, 11.2, 6.1, 2.8];
const BASE_MONTHLY_PRECIP = [62, 47, 52, 40, 50, 57, 68, 78, 71, 76, 84, 70];
// Winter months warm ~20% faster than summer in NW Europe
const HEAT_FACTORS = [1.18, 1.12, 0.92, 0.88, 0.86, 0.90, 0.94, 0.94, 0.90, 0.93, 1.04, 1.15];

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function computeYear(year: number) {
  const t = (year - 2025) / 75; // 0..1 from 2025→2100
  const tempChange = t * 7.8;
  const avgTemp    = 11.4 + tempChange;
  const monthlyTemps  = BASE_MONTHLY_TEMPS.map((v, i) => v + tempChange * HEAT_FACTORS[i]);
  const precipMult    = 1 + t * 0.128;
  const annualPrecip  = Math.round(764 * precipMult);
  const monthlyPrecip = BASE_MONTHLY_PRECIP.map(v => Math.round(v * precipMult));
  const heatDays      = Math.round(6 + t * 46);
  const droughtRisk   = Math.min(Math.round(14 + t * 38), 78);
  const floodRisk     = Math.min(Math.round(55 + t * 31), 95);
  const seaLevel      = Math.round(8 + t * 90);
  const score         = Math.max(Math.round(78 - t * 26), 10);
  const biodiversity  = Math.round(t * 28);
  const agriViability = Math.max(Math.round(88 - t * 36), 18);
  const waterStress   = Math.min(0.28 + t * 0.34, 0.92);
  const aqi           = Math.round(42 + t * 38);

  // Climate twin – city whose *current* climate most closely matches Amsterdam's future
  const TWINS = [
    { maxYear: 2028, loc: "Plymouth, UK" },
    { maxYear: 2035, loc: "Ghent, Belgium" },
    { maxYear: 2044, loc: "Bordeaux, France" },
    { maxYear: 2053, loc: "Lyon, France" },
    { maxYear: 2064, loc: "Lausanne, Switzerland" },
    { maxYear: 2075, loc: "Milan, Italy" },
    { maxYear: 2086, loc: "Nice, France" },
    { maxYear: 2100, loc: "Barcelona, Spain" },
  ];
  const twin = (TWINS.find(t => year <= t.maxYear) ?? TWINS[TWINS.length - 1]).loc;

  const category =
    score >= 85 ? "Excellent" :
    score >= 70 ? "Good" :
    score >= 60 ? "Fair" :
    score >= 40 ? "Poor" : "Severe";

  const confidence = year <= 2055 ? "High (92%)" : year <= 2075 ? "Medium (78%)" : "Low (61%)";

  // Score breakdown components
  const tempComfort  = Math.max(Math.round(28.4 - tempChange * 1.8), 0);
  const precipScore  = Math.round(lerp(22.1, 23.5, t));
  const infraScore   = 30;
  const heatPenalty  = -Math.round(heatDays * 0.28);
  const droughtPen   = -Math.round(droughtRisk * 0.11);
  const floodPen     = -Math.round(floodRisk * 0.04);

  return {
    year, t, tempChange, avgTemp, monthlyTemps, annualPrecip, monthlyPrecip,
    heatDays, droughtRisk, floodRisk, seaLevel, score, category,
    biodiversity, agriViability, waterStress, aqi, twin, confidence,
    tempComfort, precipScore, infraScore, heatPenalty, droughtPen, floodPen,
  };
}

// Precompute 5-yr trajectory for sparkline
const TRAJECTORY = Array.from({ length: 16 }, (_, i) => computeYear(2025 + i * 5).score);

// ── Tipping points ──────────────────────────────────────────────────────────
const TIPPING = [
  { year: 2038, icon: "🌡️", label: "Heat stress exceeds 15 days/yr", severity: "medium" },
  { year: 2051, icon: "⚠️", label: "Habitability drops below 70 (Fair territory)", severity: "high" },
  { year: 2067, icon: "🌊", label: "Sea level rise exceeds 50 cm — dike pressure critical", severity: "critical" },
  { year: 2082, icon: "🌾", label: "Agricultural viability falls below 60%", severity: "high" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function scoreColor(s: number) {
  return s >= 85 ? GREEN : s >= 70 ? "#4ade80" : s >= 60 ? AMBER : s >= 40 ? ORANGE : RED;
}

// ── Mini charts ─────────────────────────────────────────────────────────────
function TempChart({ temps, baseline }: { temps: number[]; baseline: number[] }) {
  const W = 480, H = 140, px = 24, py = 12;
  const min = -6, max = 28, range = max - min;
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (v: number) => py + cH - ((Math.max(min, Math.min(max, v)) - min) / range) * cH;
  const pts  = temps.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  const bpts = baseline.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      {[-5, 0, 10, 20].map(t => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W - px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 3} y={yp(t) + 3} textAnchor="end" fill={MUTED} fontSize="8">{t}°</text>
        </g>
      ))}
      <polyline points={bpts} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={pts}  fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {temps.map((v, i) => <circle key={i} cx={xp(i)} cy={yp(v)} r="2.5" fill={BG} stroke={RED} strokeWidth="1.5" />)}
      {MONTHS.map((m, i) => <text key={i} x={xp(i)} y={H - 2} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>)}
    </svg>
  );
}

function PrecipBars({ vals }: { vals: number[] }) {
  const max = Math.max(...vals);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, paddingBottom: 16 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
          <div style={{ width: "100%", background: `linear-gradient(to top, rgba(59,130,246,0.18), ${BLUE})`, borderRadius: "2px 2px 0 0", height: `${(v / max) * 100}%`, transition: "height 0.25s ease", minHeight: 2 }} />
          <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>{MONTHS[i][0]}</div>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color, w = 84, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * h * 0.9 + h * 0.05}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GaugeMeter({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(value / max, 1);
  const r = 28, circ = 2 * Math.PI * r * 0.75;
  const offset = circ - pct * circ;
  return (
    <svg viewBox="0 0 80 56" style={{ width: 80, height: 56 }}>
      <path d={`M 10 50 A ${r} ${r} 0 0 1 70 50`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round" />
      <path d={`M 10 50 A ${r} ${r} 0 0 1 70 50`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.3s ease" }} />
      <text x="40" y="46" textAnchor="middle" fill="white" fontSize="13" fontWeight="700">{value}</text>
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function ResultsPage() {
  const [year, setYear] = useState(2050);
  const d = useMemo(() => computeYear(year), [year]);
  const sc = scoreColor(d.score);
  const tPct = ((year - 2025) / 75) * 100;

  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header style={{ background: "rgba(10,13,20,0.90)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg,hsl(192,91%,36%),hsl(215,91%,50%))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>CV</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ClimateVision</span>
            <div style={{ width: 1, height: 14, background: BORDER }} />
            <span style={{ fontSize: 13 }}>Amsterdam, NL</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{year}</span>
          </div>
          <button style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: "pointer" }}>Export PDF</button>
        </div>
      </header>

      {/* ── Year Slider (Sticky frozen frame) ──────────────────────────────── */}
      <div style={{ position: "sticky", top: 48, zIndex: 45, background: "rgba(8,11,18,0.97)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Quick presets */}
            <div style={{ display: "flex", gap: 4 }}>
              {[2025, 2030, 2050, 2075, 2100].map(y => (
                <button key={y} onClick={() => setYear(y)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${year === y ? ACCENT : "rgba(255,255,255,0.12)"}`, background: year === y ? `${ACCENT}18` : "transparent", color: year === y ? ACCENT : MUTED, fontSize: 11, fontWeight: year === y ? 700 : 400, cursor: "pointer" }}>
                  {y}
                </button>
              ))}
            </div>
            {/* Slider */}
            <div style={{ flex: 1, position: "relative" }}>
              <input type="range" min="2025" max="2100" step="1" value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: ACCENT, height: 4 }} />
              {/* Timeline gradient under slider */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.35 }} />
            </div>
            {/* Year + score readout */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ ...card, padding: "4px 12px", textAlign: "center", minWidth: 58 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{year}</div>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>year</div>
              </div>
              <div style={{ ...card, padding: "4px 12px", textAlign: "center", minWidth: 58 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: sc, lineHeight: 1 }}>{d.score}</div>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>score</div>
              </div>
              <div style={{ ...card, padding: "4px 12px", textAlign: "center", minWidth: 68 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: RED, lineHeight: 1.1 }}>+{d.tempChange.toFixed(1)}°C</div>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>warming</div>
              </div>
            </div>
          </div>
          {/* Progress ticks */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingLeft: 0 }}>
            {[2025,2030,2035,2040,2045,2050,2055,2060,2065,2070,2075,2080,2085,2090,2095,2100].map(y => (
              <div key={y} style={{ width: 1, height: y % 25 === 0 ? 6 : 3, background: y % 25 === 0 ? MUTED : "rgba(255,255,255,0.15)", position: "relative" }}>
                {y % 25 === 0 && <span style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>

        {/* ── Location Banner ────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 20, marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "24px 24px", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>Amsterdam, NL</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
                <span>52.3676° N, 4.9041° E</span>
                <span>·</span>
                <span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>Maritime Temperate</span>
                <span>·</span>
                <span>Climate Sensitivity: <span style={{ color: ORANGE, fontWeight: 600 }}>High</span></span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: "🔄 Westerly Maritime", color: BLUE },
                  { label: "⚠️ High Sensitivity", color: ORANGE },
                  { label: "❄️ Ice-Albedo Feedback", color: CYAN },
                  { label: "💧 Water Vapor Amplification", color: PURPLE },
                ].map(({ label, color }) => (
                  <span key={label} style={{ background: `${color}14`, border: `1px solid ${color}28`, color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500 }}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Warming Scenario</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>RCP 4.5 · SSP2</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: RED, marginTop: 2 }}>+{d.tempChange.toFixed(1)}°C</div>
              <div style={{ fontSize: 11, color: MUTED }}>vs 1990 baseline</div>
            </div>
          </div>
        </div>

        {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 5 }}>Avg Temperature</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d.avgTemp.toFixed(1)}°C</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: RED }}>+{d.tempChange.toFixed(1)}°</span>
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 5 }}>Annual Precip</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d.annualPrecip}mm</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>+{((d.annualPrecip / 764 - 1) * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 5 }}>Heat Stress</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d.heatDays}</span>
              <span style={{ fontSize: 12, color: MUTED }}>days/yr</span>
            </div>
            <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
              <div style={{ height: "100%", borderRadius: 2, background: ORANGE, width: `${Math.min((d.heatDays / 55) * 100, 100)}%`, transition: "width 0.25s ease" }} />
            </div>
          </div>
          <div style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 5 }}>Habitability</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{d.score}<span style={{ fontSize: 14, color: MUTED }}>/100</span></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: sc, marginTop: 2 }}>{d.category}</div>
            </div>
            <div style={{ position: "relative", width: 54, height: 54 }}>
              <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="4" strokeDasharray={`${d.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.3s ease" }} />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Temperature ───────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Temperature Projection</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span style={{ color: MUTED }}>2025 baseline</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 20, height: 2, background: RED, borderRadius: 1 }} />
                <span style={{ color: MUTED }}>{year}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Mean", value: `${d.avgTemp.toFixed(1)}°C` },
                { label: "Change", value: `+${d.tempChange.toFixed(1)}°`, color: RED },
                { label: "Min (Jan)", value: `${d.monthlyTemps[0].toFixed(1)}°C` },
                { label: "Max (Jul)", value: `${d.monthlyTemps[6].toFixed(1)}°C` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <TempChart temps={d.monthlyTemps} baseline={BASE_MONTHLY_TEMPS} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (°C)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d.monthlyTemps[i].toFixed(1)}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Precipitation ─────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Precipitation Pattern</h2>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Total", value: `${d.annualPrecip}mm` },
                { label: "Change", value: `+${((d.annualPrecip / 764 - 1) * 100).toFixed(1)}%`, color: BLUE },
                { label: "Wettest", value: `Aug ${d.monthlyPrecip[7]}mm` },
                { label: "Driest",  value: `Apr ${d.monthlyPrecip[3]}mm` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <PrecipBars vals={d.monthlyPrecip} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (mm)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d.monthlyPrecip[i]}mm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Risk & Extremes ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Heat Stress", value: d.heatDays, unit: "days >35°C", delta: `+${d.heatDays - 6}d`, color: RED },
            { label: "Drought Risk", value: `${d.droughtRisk}%`, sub: d.droughtRisk < 25 ? "Low" : d.droughtRisk < 40 ? "Elevated" : "High", bar: d.droughtRisk / 78, color: AMBER },
            { label: "Flood Risk",   value: `${d.floodRisk}%`, sub: "High", bar: d.floodRisk / 95, color: BLUE },
            { label: "Sea Level Rise", value: `${d.seaLevel}cm`, sub: d.seaLevel < 25 ? "Manageable" : d.seaLevel < 50 ? "Serious" : "Critical", color: CYAN },
          ].map(({ label, value, unit, delta, sub, bar, color }) => (
            <div key={label} style={{ ...card, padding: 14, borderTop: `2px solid ${color}` }}>
              <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 }}>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 700, color }}>{value}</span>
                  {unit && <span style={{ fontSize: 10, color: MUTED, display: "block", marginTop: -2 }}>{unit}</span>}
                </div>
                {delta && <span style={{ fontSize: 10, padding: "2px 5px", background: `${RED}20`, color: RED, borderRadius: 4 }}>{delta}</span>}
                {sub   && <span style={{ fontSize: 10, fontWeight: 600, color }}>{sub}</span>}
              </div>
              {bar !== undefined && (
                <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(bar * 100, 100)}%`, transition: "width 0.25s ease" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── NEW: Climate Twin + Atmospheric Physics ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🌍</span>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Climate Twin</h3>
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>Amsterdam in {year} will feel like today's climate of:</p>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>{d.twin}</div>
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
              Matched on mean temperature, precipitation seasonality, and heat-stress days against 4,000+ global climate stations.
            </div>
            <div style={{ padding: "8px 12px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 8, fontSize: 10, color: MUTED }}>
              💡 Drag the slider to watch Amsterdam's climate migrate southward through Europe by 2100.
            </div>
          </div>

          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⚛️</span>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Atmospheric Physics</h3>
            </div>
            {[
              { label: "Circulation Pattern", value: "Westerly Maritime (NAO+)", color: BLUE },
              { label: "Climate Sensitivity", value: "4.2°C per CO₂ doubling", color: ORANGE },
              { label: "Active Feedbacks", value: "Ice-Albedo · Water Vapor · Cloud", color: PURPLE },
              { label: "Model Confidence", value: d.confidence, color: d.confidence.startsWith("H") ? GREEN : d.confidence.startsWith("M") ? AMBER : RED },
              { label: "ICON Resolution", value: "13 km × 90 vertical levels", color: MUTED },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6, marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: MUTED }}>{label}</span>
                <span style={{ fontWeight: 600, color, textAlign: "right", maxWidth: 180 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── NEW: Environmental Metrics ────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Environmental & Agricultural Impact</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              {
                label: "Air Quality Index", value: d.aqi, max: 150,
                color: d.aqi < 50 ? GREEN : d.aqi < 100 ? AMBER : ORANGE,
                sub: d.aqi < 50 ? "Good" : d.aqi < 100 ? "Moderate" : "Unhealthy",
                note: "PM2.5 + O₃ + NOₓ composite",
              },
              {
                label: "Agricultural Viability", value: d.agriViability, max: 100,
                color: d.agriViability > 75 ? GREEN : d.agriViability > 55 ? AMBER : ORANGE,
                sub: d.agriViability > 75 ? "Favorable" : d.agriViability > 55 ? "Reduced" : "Stressed",
                note: "Crop yield index (current = 100%)",
              },
              {
                label: "Water Stress", value: Math.round(d.waterStress * 100), max: 100,
                color: d.waterStress < 0.35 ? GREEN : d.waterStress < 0.55 ? AMBER : RED,
                sub: d.waterStress < 0.35 ? "Low" : d.waterStress < 0.55 ? "Medium" : "High",
                note: "Demand-to-availability ratio",
              },
              {
                label: "Biodiversity Loss", value: d.biodiversity, max: 40,
                color: d.biodiversity < 8 ? AMBER : d.biodiversity < 18 ? ORANGE : RED,
                sub: d.biodiversity < 8 ? "Mild" : d.biodiversity < 18 ? "Moderate" : "Severe",
                note: "Species range reduction estimate",
              },
            ].map(({ label, value, max, color, sub, note }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <GaugeMeter value={value} max={max} color={color} />
                <div style={{ fontSize: 10, fontWeight: 600, color, textAlign: "center" }}>{sub}</div>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: MUTED, textAlign: "center", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{note}</div>
                <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: color, width: `${(value / max) * 100}%`, transition: "width 0.25s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NEW: Tipping Point Timeline ────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Tipping Point Timeline</h2>
            <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED }}>Drag year slider to see passage of thresholds</span>
          </div>
          {/* Track bar */}
          <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 18, position: "relative" }}>
            <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(to right, ${GREEN}, ${AMBER}, ${RED})`, width: `${tPct}%`, transition: "width 0.25s ease" }} />
            <div style={{ position: "absolute", top: "50%", left: `${tPct}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: ACCENT, border: "2px solid white", transition: "left 0.25s ease" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {TIPPING.map((tp) => {
              const passed = year >= tp.year;
              const isNext = !passed && TIPPING.filter(x => year < x.year)[0]?.year === tp.year;
              return (
                <div key={tp.year} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: passed ? "rgba(239,68,68,0.07)" : isNext ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${passed ? "rgba(239,68,68,0.22)" : isNext ? "rgba(245,158,11,0.22)" : BORDER}`, transition: "all 0.25s ease" }}>
                  <span style={{ fontSize: 16 }}>{tp.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: passed ? RED : isNext ? AMBER : MUTED }}>{tp.label}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{tp.year} · {tp.year - 2025} years from 2025 baseline</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: passed ? RED : MUTED, width: 40, textAlign: "right" }}>{tp.year}</div>
                  {passed && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(239,68,68,0.18)", color: RED, borderRadius: 4, fontWeight: 700 }}>CROSSED</span>}
                  {isNext && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(245,158,11,0.18)", color: AMBER, borderRadius: 4, fontWeight: 700 }}>NEXT</span>}
                  {!passed && !isNext && <span style={{ fontSize: 9, padding: "2px 6px", background: BORDER, color: MUTED, borderRadius: 4 }}>FUTURE</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Habitability Assessment ────────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Habitability Assessment</h2>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
            {/* Score ring + sparkline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
              <div style={{ position: "relative", width: 100, height: 100 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="3" strokeDasharray={`${d.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.25s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: sc }}>{d.score}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: sc }}>{d.category}</span>
              <Sparkline data={TRAJECTORY} color={sc} />
              <div style={{ fontSize: 8, color: MUTED, textAlign: "center" }}>Score: 2025 → 2100</div>
            </div>
            {/* Breakdown bars */}
            <div style={{ flex: 1 }}>
              {[
                { label: "Temperature Comfort", val: d.tempComfort, max: 30, type: "pos" },
                { label: "Precipitation",       val: d.precipScore, max: 25, type: "pos" },
                { label: "Infrastructure",      val: d.infraScore,  max: 35, type: "pos" },
                { label: "Heat Penalty",        val: d.heatPenalty, max: -15, type: "neg" },
                { label: "Drought Penalty",     val: d.droughtPen,  max: -12, type: "neg" },
                { label: "Flood Penalty",       val: d.floodPen,    max: -8,  type: "neg" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ fontSize: 11, width: 155, color: MUTED, flexShrink: 0 }}>{item.label}</div>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${(Math.abs(item.val) / Math.abs(item.max)) * 100}%`, background: item.type === "pos" ? "rgba(255,255,255,0.28)" : RED, transition: "width 0.25s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: item.type === "pos" ? "white" : RED, width: 34, textAlign: "right" }}>
                    {item.val > 0 ? "+" : ""}{item.val}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 13, fontWeight: 700, color: sc }}>
                Total: {d.score}
              </div>
            </div>
          </div>
          {/* Scale legend */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
            {[
              { r: "0–39", l: "Severe", active: d.score < 40, c: RED },
              { r: "40–59", l: "Poor",   active: d.score >= 40 && d.score < 60, c: ORANGE },
              { r: "60–69", l: "Fair",   active: d.score >= 60 && d.score < 70, c: AMBER },
              { r: "70–84", l: "Good",   active: d.score >= 70 && d.score < 85, c: GREEN },
              { r: "85–100", l: "Excellent", active: d.score >= 85, c: "#4ade80" },
            ].map(b => (
              <div key={b.r} style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: b.active ? `${b.c}18` : "rgba(255,255,255,0.04)", color: b.active ? b.c : MUTED, fontWeight: b.active ? 700 : 400, border: b.active ? `1px solid ${b.c}35` : "none" }}>
                {b.l} ({b.r})
              </div>
            ))}
          </div>
        </div>

      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>
          ClimateVision · CBottle/ICON Atmospheric Physics · Model v2.4 · Confidence: {d.confidence} · RCP 4.5 / SSP2-4.5
        </p>
      </footer>
    </div>
  );
}
