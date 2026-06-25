import { Plus, Crown, ArrowRight, Thermometer, Droplets, Flame, Activity, Globe } from "lucide-react";

const BG = "hsl(222,47%,8%)";
const CARD = "hsl(222,47%,12%)";
const BORDER = "hsl(217,33%,22%)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED = "hsl(215,20%,65%)";

const CITIES = [
  {
    name: "Amsterdam", country: "Netherlands", flag: "🇳🇱",
    score: 71, badge: "Good", borderColor: "#3b82f6",
    temp: 14.2, precip: 812, heatDays: 14,
    monthlyTemp: [3.8,4.2,7.5,11.2,14.8,18.2,21.5,21.0,17.8,13.5,8.2,4.5],
    monthlyPrecip: [68,52,58,45,55,62,75,85,78,82,92,60],
  },
  {
    name: "Dubai", country: "UAE", flag: "🇦🇪",
    score: 22, badge: "Severe", borderColor: "#ef4444",
    temp: 35.4, precip: 98, heatDays: 185,
    monthlyTemp: [19,21,25,31,37,41,43,43,40,34,27,21],
    monthlyPrecip: [18,12,8,3,1,0,0,0,1,4,14,18],
  },
  {
    name: "Oslo", country: "Norway", flag: "🇳🇴",
    score: 78, badge: "Good", borderColor: "#10b981",
    temp: 9.8, precip: 768, heatDays: 3,
    monthlyTemp: [-3.2,-2.8,2.1,7.4,13.2,17.8,20.1,19.4,14.2,8.3,2.1,-1.8],
    monthlyPrecip: [54,42,48,52,60,72,82,80,68,72,66,58],
    isWinner: true,
  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#3b82f6","#ef4444","#10b981"];

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: 110, height: 110, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: MUTED }}>/100</span>
      </div>
    </div>
  );
}

function TempChart() {
  const maxT = 50, minT = -10, range = 60;
  const W = 680, H = 200, px = 32, py = 16;
  const cW = W - px * 2, cH = H - py * 2;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (t: number) => py + cH - ((t - minT) / range) * cH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 200 }}>
      {[-5,0,10,20,30,40].map(t => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W-px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px-4} y={yp(t)+4} textAnchor="end" fill={MUTED} fontSize="10">{t}°</text>
        </g>
      ))}
      {CITIES.map((city, ci) => {
        const pts = city.monthlyTemp.map((t, i) => `${xp(i)},${yp(t)}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={COLORS[ci]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {city.monthlyTemp.map((t, i) => (
              <circle key={i} cx={xp(i)} cy={yp(t)} r="3" fill={COLORS[ci]} />
            ))}
          </g>
        );
      })}
      {MONTHS.map((m, i) => (
        <text key={i} x={xp(i)} y={H-2} textAnchor="middle" fill={MUTED} fontSize="10">{m}</text>
      ))}
    </svg>
  );
}

function PrecipChart() {
  const maxP = 100, W = 680, H = 160, px = 32, py = 10;
  const cW = W - px * 2, cH = H - py * 2 - 16;
  const slotW = cW / 12, barW = slotW / 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 160 }}>
      {[0,25,50,75,100].map(p => {
        const yy = py + cH - (p / maxP) * cH;
        return (
          <g key={p}>
            <line x1={px} y1={yy} x2={W-px} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={px-4} y={yy+4} textAnchor="end" fill={MUTED} fontSize="9">{p}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => {
        const sx = px + i * slotW;
        return (
          <g key={i}>
            {CITIES.map((city, ci) => {
              const val = Math.min(city.monthlyPrecip[i], maxP);
              const bh = (val / maxP) * cH;
              return <rect key={ci} x={sx + ci * (barW + 1)} y={py + cH - bh} width={barW} height={bh} fill={COLORS[ci]} opacity="0.85" rx="1" />;
            })}
            <text x={sx + slotW/2} y={H-2} textAnchor="middle" fill={MUTED} fontSize="9">{m}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface Row { label: string; vals: string[]; wi: number; winner: string; bg?: string[] }

function DataTable({ rows, flagHeaders }: { rows: Row[]; flagHeaders: string[] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Metric", ...flagHeaders, "Winner"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, vals, wi, winner, bg }) => (
            <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <td style={{ padding: "9px 12px", color: MUTED }}>{label}</td>
              {vals.map((v, vi) => (
                <td key={vi} style={{ padding: "9px 12px", background: bg ? bg[vi] : (vi === wi ? "rgba(16,185,129,0.07)" : "transparent"), fontWeight: vi === wi ? 700 : 400, color: vi === wi ? "#34d399" : "white" }}>{v}</td>
              ))}
              <td style={{ padding: "9px 12px", color: "#34d399", fontWeight: 700 }}>{winner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tempRows: Row[] = [
  { label: "Annual Mean", vals: ["14.2°C","35.4°C","9.8°C"], wi: 2, winner: "Oslo" },
  { label: "Warmest Month", vals: ["21.5°C (Jul)","43.0°C (Aug)","20.1°C (Jul)"], wi: 2, winner: "Oslo" },
  { label: "Coldest Month", vals: ["3.8°C (Jan)","19.0°C (Jan)","-3.2°C (Jan)"], wi: 0, winner: "Amsterdam" },
  { label: "Change vs 2020", vals: ["+2.8°","+3.6°","+2.4°"], wi: 2, winner: "Oslo" },
];

const precipRows: Row[] = [
  { label: "Annual Total", vals: ["812 mm","98 mm","768 mm"], wi: 0, winner: "Amsterdam" },
  { label: "Wettest Month", vals: ["92 mm (Nov)","18 mm (Jan)","82 mm (Jul)"], wi: 0, winner: "Amsterdam" },
  { label: "Driest Month", vals: ["45 mm (Apr)","0 mm (Jul/Aug)","42 mm (Feb)"], wi: 0, winner: "Amsterdam" },
  { label: "Change vs 2020", vals: ["+6.2%","-8.1%","+4.5%"], wi: 0, winner: "Amsterdam" },
];

const riskRows: Row[] = [
  { label: "Heat Stress Days", vals: ["14 days","185 days","3 days"], wi: 2, winner: "Oslo",
    bg: ["rgba(251,146,60,0.08)","rgba(239,68,68,0.15)","rgba(16,185,129,0.1)"] },
  { label: "Drought Risk", vals: ["12%","71%","6%"], wi: 2, winner: "Oslo",
    bg: ["rgba(255,255,255,0.03)","rgba(239,68,68,0.15)","rgba(16,185,129,0.1)"] },
  { label: "Flood Risk", vals: ["28%","8%","18%"], wi: 1, winner: "Dubai",
    bg: ["rgba(239,68,68,0.1)","rgba(16,185,129,0.07)","rgba(255,255,255,0.03)"] },
  { label: "Sea Level Rise", vals: ["18 cm","22 cm","9 cm"], wi: 2, winner: "Oslo",
    bg: ["rgba(255,255,255,0.03)","rgba(239,68,68,0.1)","rgba(16,185,129,0.1)"] },
];

export function ComparisonPage() {
  const flagHeaders = CITIES.map(c => `${c.flag} ${c.name}`);
  const ranked = [...CITIES].sort((a, b) => b.score - a.score);

  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>

      <header style={{ background: "rgba(14,20,36,0.92)", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,hsl(192,91%,36%),hsl(215,91%,50%))", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={16} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>ClimateVision</span>
            <span style={{ fontSize: 13, color: MUTED, marginLeft: 4 }}>/ Compare Locations · 2050</span>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${ACCENT}`, color: ACCENT, background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={14} /> Add City
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
          {CITIES.map((city, ci) => (
            <div key={ci} style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${city.borderColor}`, borderRadius: 16, padding: 24, position: "relative", textAlign: "center" }}>
              {city.isWinner && (
                <div style={{ position: "absolute", top: 14, right: 14, color: "#facc15" }}><Crown size={20} /></div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{city.flag} {city.name}</div>
              <ScoreRing score={city.score} color={city.borderColor} />
              <div style={{ marginTop: 10, marginBottom: 16 }}>
                <span style={{ background: `${city.borderColor}22`, color: city.borderColor, border: `1px solid ${city.borderColor}44`, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {city.badge}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                {[
                  { icon: <Thermometer size={10} />, label: "Temp", val: `${city.temp}°C` },
                  { icon: <Droplets size={10} />, label: "Precip", val: `${city.precip}mm` },
                  { icon: <Flame size={10} />, label: "Heat", val: `${city.heatDays}d` },
                ].map(({ icon, label, val }) => (
                  <div key={label}>
                    <div style={{ color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 9, textTransform: "uppercase", marginBottom: 3 }}>{icon}{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          {CITIES.map((c, ci) => (
            <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[ci] }} />
              <span style={{ color: MUTED }}>{c.flag} {c.name}</span>
            </div>
          ))}
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Thermometer size={18} color="#f97316" /> Temperature Comparison
          </h3>
          <TempChart />
          <DataTable rows={tempRows} flagHeaders={flagHeaders} />
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Droplets size={18} color="#60a5fa" /> Precipitation Comparison
          </h3>
          <PrecipChart />
          <DataTable rows={precipRows} flagHeaders={flagHeaders} />
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} color="#fb923c" /> Risk Comparison
          </h3>
          <DataTable rows={riskRows} flagHeaders={flagHeaders} />
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Overall Rankings · 2050</h3>
          {ranked.map((city, rank) => {
            const origIdx = CITIES.findIndex(c => c.name === city.name);
            return (
              <div key={city.name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: rank < ranked.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: rank === 0 ? "#facc15" : BORDER, width: 44, textAlign: "center" }}>#{rank+1}</span>
                <span style={{ fontSize: 26 }}>{city.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{city.name}, {city.country}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Habitability: {city.score}/100 · Heat days: {city.heatDays}/yr · Precip: {city.precip}mm</div>
                </div>
                <ScoreRing score={city.score} color={COLORS[origIdx]} />
                <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Full Report <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "24px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 12 }}>ClimateVision · CBottle/ICON Atmospheric Physics · Projections for planning purposes only</p>
      </footer>
    </div>
  );
}
