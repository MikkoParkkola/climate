import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, X, Plus, BarChart3, Globe, ArrowLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SCENARIOS, scenarioOptionLabel } from "@/lib/climate-constants";

// ── Theme ──────────────────────────────────────────────────────────────────
const BG = "hsl(222,47%,8%)";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED = "hsl(215,20%,65%)";
const RED = "#ef4444";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const ORANGE = "#f97316";
const card: React.CSSProperties = {
  backgroundColor: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  backdropFilter: "blur(12px)",
};

const PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#a855f7",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BASELINE_YEAR = 2025;
const MAX_YEAR = 2100;
const CURRENT_FORECAST_YEAR = Math.min(MAX_YEAR, Math.max(BASELINE_YEAR + 1, new Date().getFullYear()));
const FIVE_YEAR_CHECKPOINTS = Array.from({ length: 15 }, (_, i) => 2030 + i * 5).filter((year) => year >= CURRENT_FORECAST_YEAR);
const CHECKPOINTS = Array.from(new Set([BASELINE_YEAR, CURRENT_FORECAST_YEAR, ...FIVE_YEAR_CHECKPOINTS])).sort((a, b) => a - b);
const YEAR_TICKS = CHECKPOINTS;
const QUICK_YEAR_BUTTONS = Array.from(new Set([CURRENT_FORECAST_YEAR, 2030, 2050, 2075, 2100].filter((year) => year >= CURRENT_FORECAST_YEAR)));
// SCENARIOS imported from climate-constants — single source of truth for scenario wording.
type ScenarioId = (typeof SCENARIOS)[number]["id"];
const DEFAULT_SCENARIO: ScenarioId = "ssp245";
const DEFAULT_SCENARIO_POLICY_VERSION = "current-policy-reference-2025";
const DEFAULT_SCENARIO_EXPLANATION =
  "Default reference: 2025 UNEP current-policy and Climate Action Tracker policies/action estimates put end-century warming roughly between 2.6 C and just below 3 C, so fupit maps the reference case to the closest fully grounded SSP pathway. It is a versioned reference, not a prediction or hidden scenario average.";

// ── Types ────────────────────────────────────────────────────────────────────
interface ClimateLocation {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
}

interface ProjectionPoint {
  year: number;
  temperature: { annual_mean: number; monthly: number[] };
  precipitation: { annual_total: number; monthly: number[] };
  extremes: {
    heat_stress_days: number;
    drought_risk: number;
    flood_risk: number;
    sea_level_rise_cm?: number;
  };
  habitability: { score: number };
  atmospheric_physics?: { circulation_pattern?: string };
  location?: { climate_zone?: string };
}

interface Trajectory {
  location: ClimateLocation;
  color: string;
  points: ProjectionPoint[]; // sorted ascending by year
}

interface Snapshot {
  temp: number;
  precip: number;
  heatDays: number;
  score: number;
  drought: number; // %
  flood: number; // %
  seaLevel: number;
  monthlyTemps: number[];
  monthlyPrecip: number[];
  category: string;
  baseTemp: number;
  basePrecip: number;
  baseScore: number;
}

interface ClimateComparisonProps {
  onBack: () => void;
}

// ── Math helpers ─────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Interpolate a scalar metric at an arbitrary year between real checkpoint points.
function interpScalar(points: ProjectionPoint[], year: number, get: (p: ProjectionPoint) => number): number {
  if (points.length === 0) return 0;
  if (year <= points[0].year) return get(points[0]);
  const last = points[points.length - 1];
  if (year >= last.year) return get(last);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (year >= a.year && year <= b.year) {
      const t = (year - a.year) / (b.year - a.year || 1);
      return lerp(get(a), get(b), t);
    }
  }
  return get(last);
}

function riskScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function categoryFor(score: number) {
  return score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
}

function scoreColor(s: number) {
  return s >= 85 ? GREEN : s >= 70 ? "#4ade80" : s >= 60 ? AMBER : s >= 40 ? ORANGE : RED;
}

function computeSnapshot(traj: Trajectory, year: number): Snapshot {
  const pts = traj.points;
  const base = pts[0];
  const temp = interpScalar(pts, year, (p) => p.temperature.annual_mean);
  const precip = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.precipitation.annual_total)));
  const heatDays = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.heat_stress_days)));
  const score = Math.max(0, Math.min(100, Math.round(interpScalar(pts, year, (p) => p.habitability.score))));
  const drought = Math.round(riskScore(interpScalar(pts, year, (p) => p.extremes.drought_risk)));
  const flood = Math.round(riskScore(interpScalar(pts, year, (p) => p.extremes.flood_risk)));
  const seaLevel = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.sea_level_rise_cm ?? 0)));
  const monthlyTemps = Array.from({ length: 12 }, (_, m) =>
    interpScalar(pts, year, (p) => p.temperature.monthly?.[m] ?? p.temperature.annual_mean),
  );
  // Interpolate monthly precip, then rescale so the monthly sum matches the interpolated annual total.
  const rawMonthlyPrecip = Array.from({ length: 12 }, (_, m) =>
    Math.max(0, interpScalar(pts, year, (p) => p.precipitation.monthly?.[m] ?? p.precipitation.annual_total / 12)),
  );
  const rawSum = rawMonthlyPrecip.reduce((a, b) => a + b, 0) || 1;
  const monthlyPrecip = rawMonthlyPrecip.map((v) => Math.max(0, Math.round((v / rawSum) * precip)));
  return {
    temp,
    precip,
    heatDays,
    score,
    drought,
    flood,
    seaLevel,
    monthlyTemps,
    monthlyPrecip,
    category: categoryFor(score),
    baseTemp: base.temperature.annual_mean,
    basePrecip: base.precipitation.annual_total,
    baseScore: base.habitability.score,
  };
}

function shortName(loc: ClimateLocation) {
  return loc.city || loc.name.split(",")[0];
}

function scenarioInfo(id: ScenarioId) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS.find((scenario) => scenario.id === DEFAULT_SCENARIO)!;
}

function parseScenario(id: string): ScenarioId {
  return (SCENARIOS.some((scenario) => scenario.id === id) ? id : DEFAULT_SCENARIO) as ScenarioId;
}

// ── Mini components ────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 100, height: 100, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.25s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, color: MUTED }}>/100</span>
      </div>
    </div>
  );
}

function Sparkline({ data, years, color, year, w = 80, h = 22 }: { data: number[]; years: number[]; color: string; year: number; w?: number; h?: number }) {
  if (data.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }} />;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const rng = mx - mn || 1;
  const xForIdx = (i: number) => (i / (data.length - 1)) * w;
  const yForVal = (v: number) => h - ((v - mn) / rng) * h * 0.88 + h * 0.06;
  const pts = data.map((v, i) => `${xForIdx(i)},${yForVal(v)}`).join(" ");
  // fractional index of the slider year within the checkpoint years
  const span = years[years.length - 1] - years[0] || 1;
  const fi = Math.max(0, Math.min(((year - years[0]) / span) * (data.length - 1), data.length - 1));
  const lo = Math.floor(fi);
  const hi = Math.min(lo + 1, data.length - 1);
  const t = fi - lo;
  const cx = xForIdx(fi);
  const cy = yForVal(lerp(data[lo], data[hi], t));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

function TrajectoryChart({ trajectories, colors, year }: { trajectories: { years: number[]; scores: number[] }[]; colors: string[]; year: number }) {
  const W = 660, H = 180, px = 32, py = 12;
  const cW = W - px * 2, cH = H - py * 2 - 16;
  const xp = (yr: number) => px + ((yr - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * cW;
  const yp = (s: number) => py + cH - (s / 100) * cH;
  const curX = xp(year);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[0, 25, 50, 75, 100].map((s) => (
        <g key={s}>
          <line x1={px} y1={yp(s)} x2={W - px} y2={yp(s)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 4} y={yp(s) + 4} textAnchor="end" fill={MUTED} fontSize="9">{s}</text>
        </g>
      ))}
      <line x1={curX} y1={py} x2={curX} y2={py + cH} stroke={ACCENT} strokeWidth="1" strokeDasharray="3 2" opacity="0.7" style={{ transition: "x1 0.25s ease, x2 0.25s ease" }} />
      {trajectories.map((traj, ci) => {
        const pts = traj.years.map((yr, i) => `${xp(yr)},${yp(traj.scores[i])}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={colors[ci]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {traj.years.map((yr, i) => (
              <circle key={i} cx={xp(yr)} cy={yp(traj.scores[i])} r="2.5" fill={BG} stroke={colors[ci]} strokeWidth="1.5" />
            ))}
          </g>
        );
      })}
      {[BASELINE_YEAR, 2050, 2075, MAX_YEAR].map((y) => (
        <text key={y} x={xp(y)} y={H - 1} textAnchor="middle" fill={MUTED} fontSize="9">{y}</text>
      ))}
      <text x={curX} y={py - 3} textAnchor="middle" fill={ACCENT} fontSize="9" fontWeight="700">{year}</text>
    </svg>
  );
}

function TempCompChart({ series, colors }: { series: number[][]; colors: string[] }) {
  const W = 620, H = 160, px = 28, py = 10;
  const all = series.flat();
  if (all.length === 0) return null;
  const minT = Math.floor(Math.min(...all) - 1);
  const maxT = Math.ceil(Math.max(...all) + 1);
  const range = maxT - minT || 1;
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (t: number) => py + cH - ((t - minT) / range) * cH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[Math.round(minT), 0, 10, 20, 30, 40].filter((v) => v >= minT && v <= maxT).map((t) => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W - px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 3} y={yp(t) + 3} textAnchor="end" fill={MUTED} fontSize="8">{t}°</text>
        </g>
      ))}
      {series.map((monthly, ci) => {
        const pts = monthly.map((t, i) => `${xp(i)},${yp(t)}`).join(" ");
        return (
          <g key={ci}>
            <polyline points={pts} fill="none" stroke={colors[ci]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {monthly.map((t, i) => (
              <circle key={i} cx={xp(i)} cy={yp(t)} r="2.5" fill={BG} stroke={colors[ci]} strokeWidth="1.5" />
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

function PrecipCompChart({ series, colors }: { series: number[][]; colors: string[] }) {
  const W = 620, H = 140, px = 28, py = 8;
  const maxP = Math.max(...series.flat(), 1);
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const slotW = cW / 12;
  const n = series.length || 1;
  const barW = Math.max(2, (slotW * 0.8) / n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {[0, 50, 100, 150, 200].filter((p) => p <= maxP + 10).map((p) => {
        const yy = py + cH - (p / (maxP + 5)) * cH;
        return (
          <g key={p}>
            <line x1={px} y1={yy} x2={W - px} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={px - 3} y={yy + 3} textAnchor="end" fill={MUTED} fontSize="8">{p}</text>
          </g>
        );
      })}
      {MONTHS.map((m, i) => {
        const sx = px + i * slotW + slotW * 0.1;
        return (
          <g key={i}>
            {series.map((monthly, ci) => {
              const val = monthly[i] ?? 0;
              const bh = (val / (maxP + 5)) * cH;
              return (
                <rect
                  key={ci}
                  x={sx + ci * barW}
                  y={py + cH - bh}
                  width={Math.max(1, barW - 0.5)}
                  height={bh}
                  fill={colors[ci]}
                  opacity="0.82"
                  rx="1"
                  style={{ transition: "height 0.25s ease, y 0.25s ease" }}
                />
              );
            })}
            <text x={sx + (barW * n) / 2} y={H - 1} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface TableRow {
  label: string;
  vals: string[];
  winnerIdx: number;
  bgs?: string[];
}

function CompareTable({ rows, names }: { rows: TableRow[]; names: string[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 14 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Metric", ...names, "Best"].map((h, hi) => (
              <th key={hi} style={{ padding: "7px 10px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, vals, winnerIdx, bgs }) => (
            <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <td style={{ padding: "8px 10px", color: MUTED, whiteSpace: "nowrap" }}>{label}</td>
              {vals.map((v, vi) => (
                <td
                  key={vi}
                  style={{
                    padding: "8px 10px",
                    background: bgs ? bgs[vi] : vi === winnerIdx ? "rgba(16,185,129,0.07)" : "transparent",
                    fontWeight: vi === winnerIdx ? 700 : 400,
                    color: vi === winnerIdx ? "#34d399" : "white",
                    transition: "background 0.25s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v}
                </td>
              ))}
              <td style={{ padding: "8px 10px", color: "#34d399", fontWeight: 700, whiteSpace: "nowrap" }}>{names[winnerIdx]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// argmin / closest helpers for table winners
function argMin(vals: number[]): number {
  return vals.reduce((mi, v, i) => (v < vals[mi] ? i : mi), 0);
}
function argClosest(vals: number[], target: number): number {
  return vals.reduce((mi, v, i) => (Math.abs(v - target) < Math.abs(vals[mi] - target) ? i : mi), 0);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClimateComparison({ onBack }: ClimateComparisonProps) {
  const [selectedLocations, setSelectedLocations] = useState<ClimateLocation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [year, setYear] = useState(CURRENT_FORECAST_YEAR);
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO);
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Climate Comparison Tool | Compare Future Climate by Location";
  }, []);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const changeScenario = (nextScenario: ScenarioId) => {
    setScenario(nextScenario);
    setTrajectories([]);
    addLog(`Scenario changed to ${scenarioInfo(nextScenario).label}; run comparison again`);
  };

  // Search for locations
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/locations/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Failed to search locations");
      return response.json();
    },
    enabled: searchQuery.length > 2,
    staleTime: 5 * 60 * 1000,
  });

  // Compare locations: fetch a real multi-year trajectory per location, sequentially.
  const compareLocationsMutation = useMutation({
    mutationFn: async () => {
      const results: Trajectory[] = [];
      for (let i = 0; i < selectedLocations.length; i++) {
        const location = selectedLocations[i];
        addLog(`Modeling ${shortName(location)} at ${CHECKPOINTS.join(", ")}...`);
        const response = await fetch("/api/climate-trajectory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: { lat: location.lat, lng: location.lng },
            years: CHECKPOINTS,
            scenario,
          }),
        });
        if (!response.ok) {
          let detail = response.statusText;
          try {
            const errorData = await response.json();
            detail = errorData.message || detail;
          } catch {
            /* ignore */
          }
          throw new Error(`Failed for ${shortName(location)}: ${detail}`);
        }
        const data = await response.json();
        if (data.success && data.data?.points?.length) {
          const points: ProjectionPoint[] = [...data.data.points].sort((a: ProjectionPoint, b: ProjectionPoint) => a.year - b.year);
          results.push({ location, color: PALETTE[i % PALETTE.length], points });
          addLog(`✓ ${shortName(location)} complete`);
        } else {
          throw new Error(`Invalid data for ${shortName(location)}`);
        }
      }
      return results;
    },
    onSuccess: (data) => {
      setTrajectories(data);
      setIsComparing(false);
      addLog(`Comparison complete for ${data.length} locations`);
    },
    onError: (error) => {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsComparing(false);
    },
  });

  const addLocation = (location: any) => {
    if (selectedLocations.length >= 10) {
      addLog("Maximum 10 locations allowed for comparison");
      return;
    }
    const newLocation: ClimateLocation = {
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      country: location.country || "",
      city: location.city || "",
    };
    if (!selectedLocations.find((l) => Math.abs(l.lat - newLocation.lat) < 0.01 && Math.abs(l.lng - newLocation.lng) < 0.01)) {
      setSelectedLocations([...selectedLocations, newLocation]);
      setSearchQuery("");
      addLog(`Added ${shortName(newLocation)} to comparison`);
    }
  };

  const removeLocation = (index: number) => {
    const location = selectedLocations[index];
    setSelectedLocations(selectedLocations.filter((_, i) => i !== index));
    addLog(`Removed ${shortName(location)} from comparison`);
  };

  const startComparison = () => {
    if (selectedLocations.length < 2) {
      addLog("Please select at least 2 locations for comparison");
      return;
    }
    setIsComparing(true);
    setTrajectories([]);
    addLog(`Starting ${scenarioInfo(scenario).label} comparison for ${selectedLocations.length} locations (real model, ${CHECKPOINTS.length} checkpoints each)`);
    compareLocationsMutation.mutate();
  };

  // Derived data for the current slider year
  const snapshots = useMemo(() => trajectories.map((t) => computeSnapshot(t, year)), [trajectories, year]);
  const trajScores = useMemo(
    () => trajectories.map((t) => ({ years: t.points.map((p) => p.year), scores: t.points.map((p) => Math.round(p.habitability.score)) })),
    [trajectories],
  );
  const colors = trajectories.map((t) => t.color);
  const names = trajectories.map((t) => shortName(t.location));
  const selectedScenario = scenarioInfo(scenario);

  const ranked = useMemo(
    () => snapshots.map((s, i) => ({ s, i })).sort((a, b) => b.s.score - a.s.score),
    [snapshots],
  );

  // Comparison tables
  const tempRows: TableRow[] = snapshots.length
    ? [
        { label: "Annual Mean", vals: snapshots.map((d) => `${d.temp.toFixed(1)}°C`), winnerIdx: argClosest(snapshots.map((d) => d.temp), 14) },
        { label: "Warmest Month", vals: snapshots.map((d) => `${Math.max(...d.monthlyTemps).toFixed(1)}°C`), winnerIdx: argMin(snapshots.map((d) => Math.max(...d.monthlyTemps))) },
        { label: "Coldest Month", vals: snapshots.map((d) => `${Math.min(...d.monthlyTemps).toFixed(1)}°C`), winnerIdx: argClosest(snapshots.map((d) => Math.min(...d.monthlyTemps)), 5) },
        { label: `Change vs ${BASELINE_YEAR}`, vals: snapshots.map((d) => `${d.temp - d.baseTemp >= 0 ? "+" : ""}${(d.temp - d.baseTemp).toFixed(1)}°`), winnerIdx: argMin(snapshots.map((d) => d.temp - d.baseTemp)) },
      ]
    : [];

  const precipRows: TableRow[] = snapshots.length
    ? [
        { label: "Annual Total", vals: snapshots.map((d) => `${d.precip}mm`), winnerIdx: argClosest(snapshots.map((d) => d.precip), 750) },
        { label: "Wettest Month", vals: snapshots.map((d) => `${Math.max(...d.monthlyPrecip)}mm`), winnerIdx: argClosest(snapshots.map((d) => Math.max(...d.monthlyPrecip)), 80) },
        {
          label: `Change vs ${BASELINE_YEAR}`,
          vals: snapshots.map((d) => {
            const delta = d.basePrecip ? ((d.precip / d.basePrecip) - 1) * 100 : 0;
            return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
          }),
          winnerIdx: argMin(snapshots.map((d) => Math.abs(d.basePrecip ? (d.precip / d.basePrecip) - 1 : 0))),
        },
      ]
    : [];

  const riskRows: TableRow[] = snapshots.length
    ? [
        {
          label: "Heat Stress Days",
          vals: snapshots.map((d) => `${d.heatDays} days`),
          winnerIdx: argMin(snapshots.map((d) => d.heatDays)),
          bgs: snapshots.map((d) => (d.heatDays > 100 ? "rgba(239,68,68,0.14)" : d.heatDays > 20 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.07)")),
        },
        {
          label: "Drought Risk",
          vals: snapshots.map((d) => `${d.drought}%`),
          winnerIdx: argMin(snapshots.map((d) => d.drought)),
          bgs: snapshots.map((d) => (d.drought > 55 ? "rgba(239,68,68,0.14)" : d.drought > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)")),
        },
        {
          label: "Flood Risk",
          vals: snapshots.map((d) => `${d.flood}%`),
          winnerIdx: argMin(snapshots.map((d) => d.flood)),
          bgs: snapshots.map((d) => (d.flood > 60 ? "rgba(239,68,68,0.14)" : d.flood > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)")),
        },
        {
          label: "Sea Level Rise",
          vals: snapshots.map((d) => `${d.seaLevel}cm`),
          winnerIdx: argMin(snapshots.map((d) => d.seaLevel)),
          bgs: snapshots.map((d) => (d.seaLevel > 60 ? "rgba(239,68,68,0.14)" : d.seaLevel > 30 ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)")),
        },
      ]
    : [];

  const hasResults = trajectories.length > 0;

  return (
    <main className="min-h-screen p-4" style={{ background: BG, color: "white" }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Single Location
                </Button>
                <div>
                  <CardTitle as="h1" className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                    Climate Location Comparison
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-1">
                    Compare real climate projections side-by-side with a realtime year slider
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <div className="flex flex-col gap-1 min-w-[220px]">
                  <Label htmlFor="comparison-scenario" className="text-xs text-gray-400">Scenario</Label>
                  <select
                    id="comparison-scenario"
                    value={scenario}
                    onChange={(e) => changeScenario(parseScenario(e.target.value))}
                    disabled={isComparing}
                    className="h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white"
                    aria-label="Climate comparison scenario"
                  >
                    {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{scenarioOptionLabel(s)}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">{selectedScenario.caption}</span>
                  {scenario === DEFAULT_SCENARIO && (
                    <span className="text-xs leading-5 text-gray-500">
                      {DEFAULT_SCENARIO_EXPLANATION} Version: {DEFAULT_SCENARIO_POLICY_VERSION}.
                    </span>
                  )}
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {selectedLocations.length}/10 locations
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Location Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search and Add Locations */}
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Locations to Compare
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-search">Search for locations</Label>
                <Input
                  id="location-search"
                  placeholder="Search cities, countries, or coordinates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {isSearching && <div className="text-sm text-gray-400">Searching...</div>}

              {searchResults && searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {searchResults.slice(0, 10).map((result: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: BORDER }}
                      onClick={() => addLocation(result)}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-sm">{result.name}</div>
                          <div className="text-xs text-gray-500">
                            {result.lat?.toFixed(3)}, {result.lng?.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">Add</Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                The model runs {BASELINE_YEAR} as a baseline, {CURRENT_FORECAST_YEAR} as the current start, then every 5 years to {MAX_YEAR} per location.
              </p>
            </CardContent>
          </Card>

          {/* Selected Locations */}
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Selected Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLocations.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MapPin className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                  <p>No locations selected</p>
                  <p className="text-sm">Add 2-10 locations to start comparison</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedLocations.map((location, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: BORDER }}>
                      <div className="flex items-center gap-2">
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[index % PALETTE.length], display: "inline-block" }} />
                        <div>
                          <div className="font-medium text-sm">{shortName(location)}</div>
                          <div className="text-xs text-gray-500">
                            {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeLocation(index)} className="text-red-400 hover:text-red-300">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
                <Button onClick={startComparison} disabled={selectedLocations.length < 2 || isComparing} className="w-full" size="lg">
                  {isComparing ? "Running real model…" : `Compare ${selectedLocations.length} Locations`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="text-sm">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {logs.slice(-10).map((log, index) => (
                  <div key={index} className="text-xs text-gray-400 font-mono">{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Realtime Results ─────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Sticky Year Slider */}
          <div style={{ position: "sticky", top: 0, zIndex: 45, background: "rgba(8,11,18,0.97)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(20px)", marginTop: 24 }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "10px 20px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {QUICK_YEAR_BUTTONS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYear(y)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 5,
                        border: `1px solid ${year === y ? ACCENT : "rgba(255,255,255,0.12)"}`,
                        background: year === y ? `${ACCENT}18` : "transparent",
                        color: year === y ? ACCENT : MUTED,
                        fontSize: 11,
                        fontWeight: year === y ? 700 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.35 }} />
                    <input
                      type="range"
                      min={BASELINE_YEAR}
                      max={MAX_YEAR}
                      step="1"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      aria-label="Projection year"
                      style={{ width: "100%", cursor: "pointer", accentColor: ACCENT, position: "relative", zIndex: 1, margin: 0, display: "block" }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginTop: 1 }}>
                    {YEAR_TICKS.map((y) => (
                      <div key={y} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                        <div style={{ width: 1, height: y % 25 === 0 ? 6 : 3, background: y % 25 === 0 ? MUTED : "rgba(255,255,255,0.18)" }} />
                        {(y === CURRENT_FORECAST_YEAR || y % 25 === 0) && <span style={{ fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {trajectories.map((t, i) => (
                    <div key={i} style={{ ...card, padding: "4px 10px", textAlign: "center", borderTop: `2px solid ${t.color}`, minWidth: 54 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: scoreColor(snapshots[i].score) }}>{snapshots[i].score}</div>
                      <div style={{ fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{names[i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px" }}>
            {/* City Score Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
              {trajectories.map((t, ci) => {
                const d = snapshots[ci];
                const isLeader = ranked[0].i === ci;
                return (
                  <div key={ci} style={{ ...card, padding: 18, borderTop: `3px solid ${t.color}`, position: "relative", textAlign: "center" }}>
                    {isLeader && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 16 }}>👑</div>}
                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{names[ci]}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>{t.location.country}</div>
                    <ScoreRing score={d.score} color={t.color} />
                    <div style={{ marginTop: 8, marginBottom: 10 }}>
                      <span style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40`, padding: "2px 10px", borderRadius: 14, fontSize: 11, fontWeight: 600 }}>
                        {d.category}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 10 }}>
                      <Sparkline data={trajScores[ci].scores} years={trajScores[ci].years} color={t.color} year={year} />
                      <div style={{ fontSize: 8, color: MUTED }}>{BASELINE_YEAR} baseline to {MAX_YEAR}</div>
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

            {/* Legend */}
            <div style={{ display: "flex", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
              {trajectories.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: t.color }} />
                  <span style={{ color: MUTED }}>{names[i]}</span>
                </div>
              ))}
            </div>

            {/* Habitability Score Trajectory */}
            <div style={{ ...card, padding: 18, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>📈 Habitability Score Trajectory ({BASELINE_YEAR} baseline to {MAX_YEAR})</h3>
                <div style={{ display: "flex", gap: 10, fontSize: 10, flexWrap: "wrap" }}>
                  {trajectories.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 14, height: 2.5, background: t.color, borderRadius: 1 }} />
                      <span style={{ color: MUTED }}>{names[i]}: {snapshots[i].score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <TrajectoryChart trajectories={trajScores} colors={colors} year={year} />
              <div style={{ marginTop: 8, padding: "8px 12px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 8, fontSize: 10, color: MUTED }}>
                💡 The vertical cyan line tracks the year slider. Lines connect {BASELINE_YEAR}, {CURRENT_FORECAST_YEAR}, and 5-year model runs through {MAX_YEAR}.
              </div>
            </div>

            {/* Temperature Comparison */}
            <div style={{ ...card, padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🌡️ Temperature Comparison · {year}</h3>
              <TempCompChart series={snapshots.map((d) => d.monthlyTemps)} colors={colors} />
              <CompareTable rows={tempRows} names={names} />
            </div>

            {/* Precipitation Comparison */}
            <div style={{ ...card, padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💧 Precipitation Comparison · {year}</h3>
              <PrecipCompChart series={snapshots.map((d) => d.monthlyPrecip)} colors={colors} />
              <CompareTable rows={precipRows} names={names} />
            </div>

            {/* Risk Comparison */}
            <div style={{ ...card, padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚡ Risk Comparison · {year}</h3>
              <CompareTable rows={riskRows} names={names} />
            </div>

            {/* Overall Rankings */}
            <div style={{ ...card, padding: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Overall Rankings · {year}</h3>
              {ranked.map(({ s: d, i: origIdx }, rank) => {
                const t = trajectories[origIdx];
                const delta = d.score - Math.round(d.baseScore);
                return (
                  <div key={origIdx} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: rank < ranked.length - 1 ? `1px solid ${BORDER}` : "none", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: rank === 0 ? "#facc15" : BORDER, width: 40, textAlign: "center" }}>#{rank + 1}</span>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: t.color, display: "inline-block" }} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{names[origIdx]}{t.location.country ? `, ${t.location.country}` : ""}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        Habitability {d.score}/100 · Heat: {d.heatDays}d/yr · Precip: {d.precip}mm · Sea level +{d.seaLevel}cm
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, padding: "1px 6px", background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}30`, borderRadius: 4 }}>
                          {delta >= 0 ? "+" : ""}{delta} pts vs {BASELINE_YEAR}
                        </span>
                        <span style={{ fontSize: 10, padding: "1px 6px", background: BORDER, color: MUTED, borderRadius: 4 }}>{d.category}</span>
                      </div>
                    </div>
                    <ScoreRing score={d.score} color={t.color} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <footer className="mt-8 py-6 text-center text-xs text-slate-600" style={{ borderTop: "1px solid hsl(217,33%,15%)" }}>
        <p>
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 underline underline-offset-2 transition-colors">
            Mikko Parkkola
          </a>{" "}
          · fupit
        </p>
        <p className="mt-1">Powered by grounded CMIP6/IPCC projections · For research and planning purposes only</p>
      </footer>
    </main>
  );
}
