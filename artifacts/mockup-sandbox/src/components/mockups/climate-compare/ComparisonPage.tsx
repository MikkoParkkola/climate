import { Plus, Crown, ArrowRight, Thermometer, Droplets, Flame, Activity, Globe } from "lucide-react";

const BG = "hsl(222,47%,8%)";
const CARD = "hsl(222,47%,12%)";
const CARD2 = "hsl(222,47%,10%)";
const BORDER = "hsl(217,33%,22%)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED = "hsl(215,20%,65%)";

const CITIES = [
  {
    name: "Amsterdam", country: "Netherlands", flag: "🇳🇱",
    score: 71, badge: "Good", borderColor: "#3b82f6",
    temp: 14.2, precip: 812, heatDays: 14,
    tempChange: "+2.8°", precipChange: "+6.2%",
    drought: 12, flood: 28, seaLevel: 18,
    monthlyTemp: [3.8,4.2,7.5,11.2,14.8,18.2,21.5,21.0,17.8,13.5,8.2,4.5],
    monthlyPrecip: [68,52,58,45,55,62,75,85,78,82,92,60],
    breakdown: { temp: 26, precip: 22, infra: 30, heatPen: 4, droughtPen: 2, floodPen: 1 },
  },
  {
    name: "Dubai", country: "UAE", flag: "🇦🇪",
    score: 22, badge: "Severe", borderColor: "#ef4444",
    temp: 35.4, precip: 98, heatDays: 185,
    tempChange: "+3.6°", precipChange: "-8.1%",
    drought: 71, flood: 8, seaLevel: 22,
    monthlyTemp: [19,21,25,31,37,41,43,43,40,34,27,21],
    monthlyPrecip: [18,12,8,3,1,0,0,0,1,4,14,18],
    breakdown: { temp: 5, precip: 8, infra: 22, heatPen: 8, droughtPen: 4, floodPen: 1 },
  },
  {
    name: "Oslo", country: "Norway", flag: "🇳🇴",
    score: 78, badge: "Good", borderColor: "#10b981",
    temp: 9.8, precip: 768, heatDays: 3,
    tempChange: "+2.4°", precipChange: "+4.5%",
    drought: 6, flood: 18, seaLevel: 9,
    monthlyTemp: [-3.2,-2.8,2.1,7.4,13.2,17.8,20.1,19.4,14.2,8.3,2.1,-1.8],
    monthlyPrecip: [54,42,48,52,60,72,82,80,68,72,66,58],
    breakdown: { temp: 28, precip: 24, infra: 32, heatPen: 2, droughtPen: 2, floodPen: 2 },
    isWinner: true,
  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#3b82f6","#ef4444","#10b981"];

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 110, height: 110, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: MUTED }}>/100</span>
      </div>
    </div>
  );
}

function TempChart() {
  const maxTemp = 50;
  const minTemp = -10;
  const range = maxTemp - minTemp;
  const w = 680, h = 200, padX = 32, padY = 16;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const x = (i: number) => padX + (i / 11) * chartW;
  const y = (t: number) => padY + chartH - ((t - minTemp) / range) * chartH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 200 }}>
      {/* Grid lines */}
      {[-5,0,10,20,30,40].map(t => (
        <g key={t}>
          <line x1={padX} y1={y(t)} x2={w-padX} y2={y(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={padX-4} y={y(t)+4} textAnchor="end" fill={MUTED} fontSize="10">{t}°</text>
        </g>
      ))}
      {/* Lines */}
      {CITIES.map((city, ci) => {
        const pts = city.monthlyTemp.map((t, i) => `${x(i)},${y(t)}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={COLORS[ci]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {city.monthlyTemp.map((t, i) => (
              <circle key={i} cx={x(i)} cy={y(t)} r="3" fill={COLORS[ci]} />
            ))}
          </g>
        );
      })}
      {/* Month labels */}
      {MONTHS.map((m, i) => (
        <text key={i} x={x(i)} y={h-2} textAnchor="middle" fill={MUTED} fontSize="10">{m}</text>
      ))}
    </svg>
  );
}

function PrecipChart() {
  const maxP = 100;
  const w = 680, h = 160, padX = 32, padY = 10;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2 - 16;
  const slotW = chartW / 12;
  const barW = slotW / 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 160 }}>
      {[0,25,50,75,100].map(p => {
        const yy = padY + chartH - (p / maxP) * chartH;
        return (
          <g key={p}>
            <line x1={padX} y1={yy} x2={w-padX} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padX-4} y={yy+4} textAnchor="end" fill={MUTED} fontSize="9">{p}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => {
        const slotX = padX + i * slotW;
        return (
          <g key={i}>
            {CITIES.map((city, ci) => {
              const val = Math.min(city.monthlyPrecip[i], maxP);
              const bh = (val / maxP) * chartH;
              const bx = slotX + ci * (barW + 1);
              const by = padY + chartH - bh;
              return <rect key={ci} x={bx} y={by} width={barW} height={bh} fill={COLORS[ci]} opacity="0.85" rx="1" />;
            })}
            <text x={slotX + (slotW/2)} y={h-2} textAnchor="middle" fill={MUTED} fontSize="9">{m}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ComparisonPage() {
  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ background: "rgba(14,20,36,0.92)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, hsl(192,91%,36%), hsl(215,91%,50%))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

        {/* City Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {CITIES.map((city, ci) => (
            <div key={ci} style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${city.borderColor}`, borderRadius: 16, padding: 24, position: "relative", textAlign: "center" }}>
              {city.isWinner && (
                <div style={{ position: "absolute", top: 14, right: 14, color: "#facc15" }}>
                  <Crown size={20} />
                </div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>{city.flag} {city.name}</div>
              <ScoreRing score={city.score} color={city.borderColor} />
              <div style={{ marginTop: 10, marginBottom: 16 }}>
                <span style={{ background: `${city.borderColor}22`, color: city.borderColor, border: `1px solid ${city.borderColor}44`, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {city.badge}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                {[
                  { icon: <Thermometer size={11} />, label: "Temp", val: `${city.temp}°C` },
                  { icon: <Droplets size={11} />, label: "Precip", val: `${city.precip}mm` },
                  { icon: <Flame size={11} />, label: "Heat", val: `${city.heatDays}d` },
                ].map(({ icon, label, val }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 9, textTransform: "uppercase", marginBottom: 3 }}>{icon}{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          {CITIES.map((c, ci) => (
            <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[ci] }} />
              <span style={{ color: MUTED }}>{c.flag} {c.name}</span>
            </div>
          ))}
        </div>

        {/* Temperature Section */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Thermometer size={18} color="#f97316" /> Temperature Comparison
          </h3>
          <TempChart />
          <div style={{ marginTop: 20, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Metric", ...CITIES.map(c => `${c.flag} ${c.name}`), "Winner"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Annual Mean", vals: ["14.2°C","35.4°C","9.8°C"], winner: "Oslo", winnerIdx: 2 },
                  { label: "Warmest Month", vals: ["21.5°C","43.0°C","20.1°C"], winner: "Oslo", winnerIdx: 2 },
                  { label: "Coldest Month", vals: ["3.8°C","19.0°C","-3.2°C"], winner: "Amsterdam", winnerIdx: 0 },
                  { label: "Change vs 2020", vals: ["+2.8°","+3.6°","+2.4°"], winner: "Oslo", winnerIdx: 2 },
                ].map(({ label, vals, winner, winnerIdx }) => (
                  <tr key={label} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                    <td style={{ padding: "9px 12px", color: MUTED, fontWeight: 500 }}>{label}</td>
                    {vals.map((v, vi) => (
                      <td key={vi} style={{ padding: "9px 12px", background: vi === winnerIdx ? "rgba(16,185,129,0.07)" : "transparent", fontWeight: vi === winnerIdx ? 700 : 400, color: vi === winnerIdx ? "#34d399" : "white" }}>{v}</td>
                    ))}
                    <td style={{ padding: "9px 12px", color: "#34d399", fontWeight: 700 }}>{winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Precipitation Section */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Droplets size={18} color="#60a5fa" /> Precipitation Comparison
          </h3>
          <PrecipChart />
          <div style={{ marginTop: 20, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Metric", ...CITIES.map(c => `${c.flag} ${c.name}`), "Winner"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Annual Total", vals: ["812 mm","98 mm","768 mm"], winner: "Amsterdam", winnerIdx: 0 },
                  { label: "Wettest Month", vals: ["92 mm (Nov)","18 mm (Jan)","82 mm (Jul)"], winner: "Amsterdam", winnerIdx: 0 },
                  { label: "Driest Month", vals: ["45 mm (Apr)","0 mm (Jul)","42 mm (Feb)"], winner: "Amsterdam", winnerIdx: 0 },
                  { label: "Change vs 2020", vals: ["+6.2%","-8.1%","+4.5%"], winner: "Amsterdam", winnerIdx: 0 },
                ].map(({ label, vals, winner, winnerIdx }) => (
                  <tr key={label} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                    <td style={{ padding: "9px 12px", color: MUTED, fontWeight: 500 }}>{label}</td>
                    {vals.map((v, vi) => (
                      <td key={vi} style={{ padding: "9px 12px", background: vi === winnerIdx ? "rgba(16,185,129,0.07)" : "transparent", fontWeight: vi === winnerIdx ? 700 : 400, color: vi === winnerIdx ? "#34d399" : "white" }}>{v}</td>
                    ))}
                    <td style={{ padding: "9px 12px", color: "#34d399", fontWeight: 700 }}>{winner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Comparison */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} color="#fb923c" /> Risk Comparison
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["Risk Factor", "🇳🇱 Amsterdam", "🇦🇪 Dubai", "🇳🇴 Oslo", "Best"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Heat Stress Days", vals: ["14 days","185 days","3 days"], colors: ["rgba(251,146,60,0.1)","rgba(239,68,68,0.15)","rgba(16,185,129,0.1)"], best: "Oslo", bestColor: "#34d399" },
                { label: "Drought Risk", vals: ["12%","71%","6%"], colors: ["rgba(255,255,255,0.03)","rgba(239,68,68,0.15)","rgba(16,185,129,0.1)"], best: "Oslo", bestColor: "#34d399" },
                { label: "Flood Risk", vals: ["28%","8%","18%"], colors: ["rgba(239,68,68,0.1)","rgba(255,255,255,0.03)","rgba(255,255,255,0.03)"], best: "Dubai", bestColor: "#60a5fa" },
                { label: "Sea Level Rise", vals: ["18 cm","22 cm","9 cm"], colors: ["rgba(255,255,255,0.03)","rgba(239,68,68,0.1)","rgba(16,185,129,0.1)"], best: "Oslo", bestColor: "#34d399" },
              ].map(({ label, vals, colors, best, bestColor }) => (
                <tr key={label} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                  <td style={{ padding: "10px 12px", color: MUTED, fontWeight: 500 }}>{label}</td>
                  {vals.map((v, vi) => (
                    <td key={vi} style={{ padding: "10px 12px", background: colors[vi] }}>{v}</td>
                  ))}
                  <td style={{ padding: "10px 12px", color: bestColor, fontWeight: 700 }}>{best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Habitability Score Breakdown */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Habitability Score Breakdown</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CITIES.map((city, ci) => {
              const b = city.breakdown;
              const total = b.temp + b.precip + b.infra - b.heatPen - b.droughtPen - b.floodPen;
              const segments = [
                { label: "Temp", val: b.temp, color: "#f97316" },
                { label: "Precip", val: b.precip, color: "#60a5fa" },
                { label: "Infra", val: b.infra, color: "#a78bfa" },
                { label: "Heat−", val: -b.heatPen, color: "#ef4444" },
                { label: "Drought−", val: -b.droughtPen, color: "#fbbf24" },
                { label: "Flood−", val: -b.floodPen, color: "#22d3ee" },
              ];
              return (
                <div key={ci}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ width: 120, fontSize: 13, color: MUTED }}>{city.flag} {city.name}</span>
                    <div style={{ flex: 1, height: 28, borderRadius: 6, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.04)" }}>
                      {segments.map(({ label, val, color }) => (
                        <div key={label} style={{ width: `${Math.abs(val)}%`, background: color, opacity: val < 0 ? 0.5 : 0.85, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "white", fontWeight: 700, overflow: "hidden" }} title={`${label}: ${val > 0 ? "+" : ""}${val}`}>
                          {Math.abs(val) > 3 ? `${Math.abs(val)}` : ""}
                        </div>
                      ))}
                    </div>
                    <span style={{ width: 52, textAlign: "right", fontWeight: 800, color: COLORS[ci] }}>{total}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
              {[
                { label: "Temp Comfort", color: "#f97316" },
                { label: "Precipitation", color: "#60a5fa" },
                { label: "Infrastructure", color: "#a78bfa" },
                { label: "Heat Penalty", color: "#ef4444" },
                { label: "Drought Penalty", color: "#fbbf24" },
                { label: "Flood Penalty", color: "#22d3ee" },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: MUTED }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Overall Rankings · 2050</h3>
          {[...CITIES].sort((a, b) => b.score - a.score).map((city, rank) => (
            <div key={city.name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: rank < 2 ? `1px solid ${BORDER}` : "none" }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: rank === 0 ? "#facc15" : BORDER, width: 44, textAlign: "center" }}>#{rank + 1}</span>
              <span style={{ fontSize: 28 }}>{city.flag}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{city.name}, {city.country}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Habitability: {city.score}/100 · Heat days: {city.heatDays}/yr · Precip: {city.precip}mm</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ScoreRing score={city.score} color={COLORS[CITIES.indexOf(city)]} />
              </div>
              <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Full Report <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>

      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "24px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 12 }}>ClimateVision · CBottle/ICON Atmospheric Physics · Projections for planning purposes only</p>
      </footer>
    </div>
  );
}
