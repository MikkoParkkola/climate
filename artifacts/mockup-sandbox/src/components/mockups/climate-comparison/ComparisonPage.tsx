import { useState, useMemo } from "react";

// ── Theme ──────────────────────────────────────────────────────────────────
const BG     = "hsl(222,47%,8%)";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED  = "hsl(215,20%,65%)";
const RED    = "#ef4444";
const GREEN  = "#22c55e";
const AMBER  = "#f59e0b";
const ORANGE = "#f97316";
const card: React.CSSProperties = { backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, backdropFilter: "blur(12px)" };

// ── City definitions ───────────────────────────────────────────────────────
interface CityConfig {
  name: string; country: string; flag: string;
  color: string;
  base: { temp: number; precip: number; heatDays: number; score: number; drought: number; flood: number; seaLevel: number };
  rates: { temp: number; precip: number; heatDays: number; score: number; drought: number; flood: number; seaLevel: number };
  monthlyTempBase: number[];
  monthlyPrecipBase: number[];
  heatFactors: number[];
}

const CITY_DEFS: CityConfig[] = [
  {
    name: "Amsterdam", country: "Netherlands", flag: "🇳🇱", color: "#3b82f6",
    base: { temp: 11.4, precip: 764, heatDays: 6, score: 78, drought: 14, flood: 55, seaLevel: 8 },
    rates: { temp: 0.104, precip: 1.31, heatDays: 0.61, score: -0.35, drought: 0.51, flood: 0.41, seaLevel: 1.2 },
    monthlyTempBase:  [1.5, 2.1, 5.4, 9.8, 13.6, 16.9, 19.2, 18.8, 15.4, 11.2, 6.1, 2.8],
    monthlyPrecipBase:[62, 47, 52, 40, 50, 57, 68, 78, 71, 76, 84, 70],
    heatFactors: [1.18, 1.12, 0.92, 0.88, 0.86, 0.90, 0.94, 0.94, 0.90, 0.93, 1.04, 1.15],
  },
  {
    name: "Dubai", country: "UAE", flag: "🇦🇪", color: "#ef4444",
    base: { temp: 33.8, precip: 88, heatDays: 168, score: 28, drought: 68, flood: 8, seaLevel: 12 },
    rates: { temp: 0.118, precip: -0.48, heatDays: 1.89, score: -0.27, drought: 0.18, flood: 0.08, seaLevel: 1.4 },
    monthlyTempBase:  [19.0, 20.8, 24.2, 29.6, 35.2, 38.8, 41.0, 41.2, 38.0, 32.4, 26.0, 21.2],
    monthlyPrecipBase:[18, 12, 8, 3, 1, 0, 0, 0, 1, 4, 14, 18],
    heatFactors: [0.95, 0.95, 0.95, 1.00, 1.02, 1.05, 1.08, 1.08, 1.05, 1.02, 0.97, 0.95],
  },
  {
    name: "Oslo", country: "Norway", flag: "🇳🇴", color: "#10b981",
    base: { temp: 7.4, precip: 704, heatDays: 1, score: 82, drought: 6, flood: 18, seaLevel: 5 },
    rates: { temp: 0.096, precip: 0.69, heatDays: 0.11, score: -0.19, drought: 0.12, flood: 0.18, seaLevel: 0.9 },
    monthlyTempBase:  [-3.2, -2.8, 2.1, 7.4, 13.2, 17.8, 20.1, 19.4, 14.2, 8.3, 2.1, -1.8],
    monthlyPrecipBase:[54, 42, 48, 52, 60, 72, 82, 80, 68, 72, 66, 58],
    heatFactors: [1.22, 1.18, 0.95, 0.88, 0.85, 0.88, 0.92, 0.92, 0.90, 0.95, 1.08, 1.20],
  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function computeCity(city: CityConfig, year: number) {
  const t = (year - 2025) / 75;
  const dt = year - 2025;
  const temp       = city.base.temp + city.rates.temp * dt;
  const precip     = Math.max(0, Math.round(city.base.precip + city.rates.precip * dt));
  const heatDays   = Math.max(0, Math.round(city.base.heatDays + city.rates.heatDays * dt));
  const score      = Math.max(5, Math.round(city.base.score + city.rates.score * dt));
  const drought    = Math.min(90, Math.round(city.base.drought + city.rates.drought * dt));
  const flood      = Math.min(90, Math.round(city.base.flood + city.rates.flood * dt));
  const seaLevel   = Math.round(city.base.seaLevel + city.rates.seaLevel * dt);
  const monthlyTemps  = city.monthlyTempBase.map((v, i) => v + city.rates.temp * dt * city.heatFactors[i]);
  const precipScale   = precip / city.base.precip;
  const monthlyPrecip = city.monthlyPrecipBase.map(v => Math.max(0, Math.round(v * precipScale)));
  const category =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" :
    score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
  return { temp, precip, heatDays, score, drought, flood, seaLevel, monthlyTemps, monthlyPrecip, category, t, dt };
}

// Precompute score trajectories (5-yr steps)
const TRAJ_YEARS = Array.from({ length: 16 }, (_, i) => 2025 + i * 5);
const TRAJECTORIES = CITY_DEFS.map(city =>
  TRAJ_YEARS.map(y => computeCity(city, y).score)
);

function scoreColor(s: number) {
  return s >= 85 ? GREEN : s >= 70 ? "#4ade80" : s >= 60 ? AMBER : s >= 40 ? ORANGE : RED;
}

// ── Mini components ────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 100, height: 100, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.25s ease" }} />
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: MUTED }}>/100</span>
      </div>
    </div>
  );
}

function Sparkline({ data, color, yearIdx, w = 80, h = 22 }: { data: number[]; color: string; yearIdx: number; w?: number; h?: number }) {
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * h * 0.88 + h * 0.06}`).join(" ");
  const cx  = (yearIdx / (data.length - 1)) * w;
  const cy  = h - ((data[yearIdx] - mn) / rng) * h * 0.88 + h * 0.06;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

// Score trajectory chart showing all 3 cities 2025→2100
function TrajectoryChart({ yearIdx }: { yearIdx: number }) {
  const W = 660, H = 180, px = 32, py = 12;
  const cW = W - px * 2, cH = H - py * 2 - 16;
  const minS = 0, maxS = 100, range = maxS - minS;
  const xp = (i: number) => px + (i / (TRAJ_YEARS.length - 1)) * cW;
  const yp = (s: number) => py + cH - ((s - minS) / range) * cH;

  // Current year x position
  const curX = px + ((yearIdx) / (TRAJ_YEARS.length - 1)) * cW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {/* Grid */}
      {[0, 25, 50, 75, 100].map(s => (
        <g key={s}>
          <line x1={px} y1={yp(s)} x2={W - px} y2={yp(s)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 4} y={yp(s) + 4} textAnchor="end" fill={MUTED} fontSize="9">{s}</text>
        </g>
      ))}
      {/* Current-year marker */}
      <line x1={curX} y1={py} x2={curX} y2={py + cH} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" style={{ transition: "x1 0.25s ease, x2 0.25s ease" }} />
      {/* City lines */}
      {CITY_DEFS.map((city, ci) => {
        const traj = TRAJECTORIES[ci];
        const pts = traj.map((s, i) => `${xp(i)},${yp(s)}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={city.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {traj.map((s, i) => (
              <circle key={i} cx={xp(i)} cy={yp(s)} r="2.5" fill={BG} stroke={city.color} strokeWidth="1.5" />
            ))}
          </g>
        );
      })}
      {/* Year labels */}
      {TRAJ_YEARS.filter((_, i) => i % 2 === 0).map((y, i) => (
        <text key={y} x={xp(i * 2)} y={H - 1} textAnchor="middle" fill={MUTED} fontSize="9">{y}</text>
      ))}
      {/* Current year label */}
      <text x={curX} y={py - 3} textAnchor="middle" fill={ACCENT} fontSize="9" fontWeight="700">{TRAJ_YEARS[yearIdx]}</text>
    </svg>
  );
}

function TempCompChart({ cityData }: { cityData: ReturnType<typeof computeCity>[] }) {
  const W = 620, H = 160, px = 28, py = 10;
  const all = cityData.flatMap(d => d.monthlyTemps);
  const minT = Math.floor(Math.min(...all) - 1), maxT = Math.ceil(Math.max(...all) + 1);
  const range = maxT - minT;
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (t: number) => py + cH - ((t - minT) / range) * cH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[Math.round(minT), 0, 10, 20, 30, 40].filter(v => v >= minT && v <= maxT).map(t => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W - px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 3} y={yp(t) + 3} textAnchor="end" fill={MUTED} fontSize="8">{t}°</text>
        </g>
      ))}
      {CITY_DEFS.map((city, ci) => {
        const pts = cityData[ci].monthlyTemps.map((t, i) => `${xp(i)},${yp(t)}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={city.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {cityData[ci].monthlyTemps.map((t, i) => (
              <circle key={i} cx={xp(i)} cy={yp(t)} r="2.5" fill={BG} stroke={city.color} strokeWidth="1.5" />
            ))}
          </g>
        );
      })}
      {MONTHS.map((m, i) => (
        <text key={i} x={xp(i)} y={H - 1} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>
      ))}
    </svg>
  );
}

function PrecipCompChart({ cityData }: { cityData: ReturnType<typeof computeCity>[] }) {
  const W = 620, H = 140, px = 28, py = 8;
  const maxP = Math.max(...cityData.flatMap(d => d.monthlyPrecip));
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const slotW = cW / 12, barW = slotW / 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[0, 25, 50, 75, 100].filter(p => p <= maxP + 10).map(p => {
        const yy = py + cH - (p / (maxP + 5)) * cH;
        return (
          <g key={p}>
            <line x1={px} y1={yy} x2={W - px} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={px - 3} y={yy + 3} textAnchor="end" fill={MUTED} fontSize="8">{p}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => {
        const sx = px + i * slotW;
        return (
          <g key={i}>
            {CITY_DEFS.map((city, ci) => {
              const val = cityData[ci].monthlyPrecip[i];
              const bh = (val / (maxP + 5)) * cH;
              return <rect key={ci} x={sx + ci * (barW + 1)} y={py + cH - bh} width={barW} height={bh} fill={city.color} opacity="0.82" rx="1" style={{ transition: "height 0.25s ease, y 0.25s ease" }} />;
            })}
            <text x={sx + slotW / 2} y={H - 1} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface TableRow { label: string; vals: string[]; winnerIdx: number; bgs?: string[] }

function CompareTable({ rows }: { rows: TableRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 14 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
          {["Metric", ...CITY_DEFS.map(c => `${c.flag} ${c.name}`), "Winner"].map(h => (
            <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, vals, winnerIdx, bgs }) => (
          <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <td style={{ padding: "8px 10px", color: MUTED }}>{label}</td>
            {vals.map((v, vi) => (
              <td key={vi} style={{ padding: "8px 10px", background: bgs ? bgs[vi] : (vi === winnerIdx ? "rgba(16,185,129,0.07)" : "transparent"), fontWeight: vi === winnerIdx ? 700 : 400, color: vi === winnerIdx ? "#34d399" : "white", transition: "background 0.25s ease" }}>{v}</td>
            ))}
            <td style={{ padding: "8px 10px", color: "#34d399", fontWeight: 700 }}>{CITY_DEFS[winnerIdx].name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export function ComparisonPage() {
  const [year, setYear] = useState(2050);

  const cityData = useMemo(
    () => CITY_DEFS.map(city => computeCity(city, year)),
    [year]
  );

  const ranked = useMemo(
    () => [...CITY_DEFS.map((c, i) => ({ city: c, data: cityData[i], origIdx: i }))]
      .sort((a, b) => b.data.score - a.data.score),
    [cityData]
  );

  // Year index in trajectory array (rounded to nearest 5-yr step)
  const traj5yr = Math.round((year - 2025) / 5);
  const yearIdx = Math.min(traj5yr, TRAJ_YEARS.length - 1);
  const tPct = ((year - 2025) / 75) * 100;

  // Dynamic table rows
  const tempRows: TableRow[] = [
    { label: "Annual Mean", vals: cityData.map(d => `${d.temp.toFixed(1)}°C`), winnerIdx: cityData.reduce((mi, d, i) => d.temp < cityData[mi].temp ? i : mi, 0) },
    { label: "Warmest Month (Jul/Aug)", vals: cityData.map((d, i) => `${Math.max(...d.monthlyTemps).toFixed(1)}°C`), winnerIdx: cityData.reduce((mi, d, i) => Math.max(...d.monthlyTemps) < Math.max(...cityData[mi].monthlyTemps) ? i : mi, 0) },
    { label: "Coldest Month (Jan)", vals: cityData.map(d => `${d.monthlyTemps[0].toFixed(1)}°C`), winnerIdx: cityData.reduce((mi, d, i) => Math.abs(d.monthlyTemps[0] - 10) < Math.abs(cityData[mi].monthlyTemps[0] - 10) ? i : mi, 0) },
    { label: "Change vs 2025", vals: CITY_DEFS.map((c, i) => `+${(cityData[i].dt * c.rates.temp).toFixed(1)}°`), winnerIdx: CITY_DEFS.reduce((mi, c, i) => c.rates.temp < CITY_DEFS[mi].rates.temp ? i : mi, 0) },
  ];

  const precipRows: TableRow[] = [
    { label: "Annual Total", vals: cityData.map(d => `${d.precip}mm`), winnerIdx: cityData.reduce((mi, d, i) => Math.abs(d.precip - 700) < Math.abs(cityData[mi].precip - 700) ? i : mi, 0) },
    { label: "Wettest Month", vals: cityData.map((d) => `${Math.max(...d.monthlyPrecip)}mm`), winnerIdx: 0 },
    { label: "Change vs 2025", vals: CITY_DEFS.map((c, i) => { const delta = ((cityData[i].precip / c.base.precip) - 1) * 100; return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`; }), winnerIdx: 2 },
  ];

  const riskRows: TableRow[] = [
    {
      label: "Heat Stress Days",
      vals: cityData.map(d => `${d.heatDays} days`),
      winnerIdx: cityData.reduce((mi, d, i) => d.heatDays < cityData[mi].heatDays ? i : mi, 0),
      bgs: cityData.map(d => d.heatDays > 100 ? "rgba(239,68,68,0.14)" : d.heatDays > 20 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.07)"),
    },
    {
      label: "Drought Risk",
      vals: cityData.map(d => `${d.drought}%`),
      winnerIdx: cityData.reduce((mi, d, i) => d.drought < cityData[mi].drought ? i : mi, 0),
      bgs: cityData.map(d => d.drought > 55 ? "rgba(239,68,68,0.14)" : d.drought > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)"),
    },
    {
      label: "Flood Risk",
      vals: cityData.map(d => `${d.flood}%`),
      winnerIdx: cityData.reduce((mi, d, i) => d.flood < cityData[mi].flood ? i : mi, 0),
      bgs: cityData.map(d => d.flood > 60 ? "rgba(239,68,68,0.14)" : d.flood > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)"),
    },
    {
      label: "Sea Level Rise",
      vals: cityData.map(d => `${d.seaLevel}cm`),
      winnerIdx: cityData.reduce((mi, d, i) => d.seaLevel < cityData[mi].seaLevel ? i : mi, 0),
      bgs: cityData.map(d => d.seaLevel > 60 ? "rgba(239,68,68,0.14)" : d.seaLevel > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)"),
    },
  ];

  // Compute decade winners (no duplicates per decade - strictly sorted)
  const DECADES = [2025, 2030, 2040, 2050, 2060, 2075, 2100];

  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header style={{ background: "rgba(10,13,20,0.90)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,hsl(192,91%,36%),hsl(215,91%,50%))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>CV</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ClimateVision</span>
            <div style={{ width: 1, height: 14, background: BORDER }} />
            <span style={{ fontSize: 13, color: MUTED }}>Compare Locations · {year}</span>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: `1px solid ${ACCENT}`, color: ACCENT, background: "transparent", fontSize: 12, cursor: "pointer" }}>
            + Add City
          </button>
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
                style={{ width: "100%", cursor: "pointer", accentColor: ACCENT }} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.35 }} />
            </div>
            {/* City score readouts */}
            <div style={{ display: "flex", gap: 6 }}>
              {CITY_DEFS.map((city, i) => (
                <div key={i} style={{ ...card, padding: "4px 10px", textAlign: "center", borderTop: `2px solid ${city.color}`, minWidth: 50 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: scoreColor(cityData[i].score) }}>{cityData[i].score}</div>
                  <div style={{ fontSize: 8, color: MUTED }}>{city.flag} {city.name}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Tick marks */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {[2025,2030,2035,2040,2045,2050,2055,2060,2065,2070,2075,2080,2085,2090,2095,2100].map(y => (
              <div key={y} style={{ width: 1, height: y % 25 === 0 ? 6 : 3, background: y % 25 === 0 ? MUTED : "rgba(255,255,255,0.15)", position: "relative" }}>
                {y % 25 === 0 && <span style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>

        {/* ── City Score Cards ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
          {CITY_DEFS.map((city, ci) => {
            const d = cityData[ci];
            const sc = scoreColor(d.score);
            const isLeader = ranked[0].origIdx === ci;
            return (
              <div key={ci} style={{ ...card, padding: 18, borderTop: `3px solid ${city.color}`, position: "relative", textAlign: "center" }}>
                {isLeader && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 16 }}>👑</div>}
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{city.flag} {city.name}</div>
                <ScoreRing score={d.score} color={city.color} />
                <div style={{ marginTop: 8, marginBottom: 10 }}>
                  <span style={{ background: `${city.color}20`, color: city.color, border: `1px solid ${city.color}40`, padding: "2px 10px", borderRadius: 14, fontSize: 11, fontWeight: 600 }}>
                    {d.category}
                  </span>
                </div>
                {/* Sparkline + trajectory */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 10 }}>
                  <Sparkline data={TRAJECTORIES[ci]} color={city.color} yearIdx={yearIdx} />
                  <div style={{ fontSize: 8, color: MUTED }}>2025→2100 trajectory</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                  {[
                    { label: "Temp", val: `${d.temp.toFixed(1)}°C` },
                    { label: "Precip", val: `${d.precip}mm` },
                    { label: "Heat", val: `${d.heatDays}d` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: 8, color: MUTED, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 1 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
          {CITY_DEFS.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
              <span style={{ color: MUTED }}>{c.flag} {c.name}</span>
            </div>
          ))}
        </div>

        {/* ── NEW: Score Trajectory Chart ──────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>📈 Habitability Score Trajectory (2025–2100)</h3>
            <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
              {CITY_DEFS.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 14, height: 2.5, background: c.color, borderRadius: 1 }} />
                  <span style={{ color: MUTED }}>{c.name}: {cityData[i].score}</span>
                </div>
              ))}
            </div>
          </div>
          <TrajectoryChart yearIdx={yearIdx} />
          <div style={{ marginTop: 8, padding: "8px 12px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 8, fontSize: 10, color: MUTED }}>
            💡 The vertical cyan line tracks the year slider position. Notice how Oslo maintains strong habitability while Dubai's score rapidly deteriorates.
          </div>
        </div>

        {/* ── Temperature Comparison ───────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🌡️ Temperature Comparison · {year}</h3>
          <TempCompChart cityData={cityData} />
          <CompareTable rows={tempRows} />
        </div>

        {/* ── Precipitation Comparison ─────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💧 Precipitation Comparison · {year}</h3>
          <PrecipCompChart cityData={cityData} />
          <CompareTable rows={precipRows} />
        </div>

        {/* ── Risk Comparison ──────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚡ Risk Comparison · {year}</h3>
          <CompareTable rows={riskRows} />
        </div>

        {/* ── NEW: Decade-by-Decade Winners ────────────────────────────────── */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏆 Best Habitability by Year</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ padding: "7px 10px", textAlign: "left", color: MUTED, fontSize: 10, textTransform: "uppercase" }}>Year</th>
                  {CITY_DEFS.map(c => (
                    <th key={c.name} style={{ padding: "7px 10px", textAlign: "left", color: MUTED, fontSize: 10, textTransform: "uppercase" }}>{c.flag} {c.name}</th>
                  ))}
                  <th style={{ padding: "7px 10px", textAlign: "left", color: MUTED, fontSize: 10, textTransform: "uppercase" }}>Winner</th>
                </tr>
              </thead>
              <tbody>
                {DECADES.map(y => {
                  // Compute unique scores for this year
                  const scores = CITY_DEFS.map(city => computeCity(city, y).score);
                  // Find winner index (highest score - guaranteed unique since different cities)
                  const winIdx = scores.reduce((mi, s, i) => s > scores[mi] ? i : mi, 0);
                  const isCurrent = year >= y && (DECADES[DECADES.indexOf(y) + 1] === undefined || year < DECADES[DECADES.indexOf(y) + 1]);
                  return (
                    <tr key={y} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isCurrent ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      <td style={{ padding: "8px 10px", fontWeight: isCurrent ? 700 : 400, color: isCurrent ? ACCENT : "white" }}>{y}{isCurrent ? " ◀" : ""}</td>
                      {scores.map((s, si) => (
                        <td key={si} style={{ padding: "8px 10px", fontWeight: si === winIdx ? 700 : 400, color: si === winIdx ? "#34d399" : scoreColor(s) }}>{s}</td>
                      ))}
                      <td style={{ padding: "8px 10px", color: "#34d399", fontWeight: 700 }}>
                        {CITY_DEFS[winIdx].flag} {CITY_DEFS[winIdx].name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: MUTED }}>
            Each row shows scores at that year's projection. Oslo leads consistently due to lower baseline temperatures; Dubai deteriorates sharply from heat stress.
          </div>
        </div>

        {/* ── Rankings ─────────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Overall Rankings · {year}</h3>
          {ranked.map(({ city, data: d, origIdx }, rank) => {
            const sc = scoreColor(d.score);
            const baseline = city.base.score;
            const delta = d.score - baseline;
            return (
              <div key={city.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: rank < ranked.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: rank === 0 ? "#facc15" : BORDER, width: 40, textAlign: "center" }}>#{rank + 1}</span>
                <span style={{ fontSize: 24 }}>{city.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{city.name}, {city.country}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                    Habitability {d.score}/100 · Heat: {d.heatDays}d/yr · Precip: {d.precip}mm · Sea level +{d.seaLevel}cm
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                    <span style={{ fontSize: 10, padding: "1px 6px", background: `${city.color}18`, color: city.color, border: `1px solid ${city.color}30`, borderRadius: 4 }}>
                      {delta >= 0 ? "+" : ""}{delta} pts vs baseline
                    </span>
                    <span style={{ fontSize: 10, padding: "1px 6px", background: BORDER, color: MUTED, borderRadius: 4 }}>
                      {d.category}
                    </span>
                  </div>
                </div>
                <ScoreRing score={d.score} color={city.color} />
              </div>
            );
          })}
        </div>

      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>ClimateVision · CBottle/ICON Atmospheric Physics · Model v2.4 · RCP 4.5 / SSP2-4.5</p>
      </footer>
    </div>
  );
}
