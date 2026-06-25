import { useState, useEffect, useMemo, useRef } from "react";
import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause } from "lucide-react";
import {
  agriculturalViability, biodiversityLoss, waterStress, projectedAqi, climateTwin,
  FALLBACK_BASELINE_AQI, type EstimateInputs,
} from "@/lib/climate-estimates";

// ── Theme ──────────────────────────────────────────────────────────────────
const BG = "hsl(222,47%,8%)";
const CARD = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "hsl(192,91%,46%)";
const MUTED = "hsl(215,20%,65%)";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const ORANGE = "#f97316";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const PURPLE = "#a78bfa";
const CYAN = "hsl(192,91%,46%)";
const card: React.CSSProperties = { backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, backdropFilter: "blur(12px)" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHECKPOINTS = [2025, 2050, 2075, 2100];

// ── Types ────────────────────────────────────────────────────────────────────
interface LocationOption {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
  state?: string;
}

interface ProjectionPoint {
  year: number;
  temperature: { annual_mean: number; monthly: number[]; anomaly: number; min: number; max: number };
  precipitation: { annual_total: number; monthly: number[]; anomaly_percent: number };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number; sea_level_rise_cm?: number };
  habitability: { score: number; category?: string; breakdown?: Record<string, number> };
  atmospheric_physics?: { circulation_pattern?: string; climate_sensitivity?: number; feedback_mechanisms?: string[] };
  location?: { climate_zone?: string; latitude?: number; longitude?: number };
  metadata?: { confidence?: string; resolution?: string; model?: string; model_version?: string };
}

// ── Math helpers ─────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

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

// Interpolate parallel year/value arrays at an arbitrary year.
function interpArr(years: number[], values: number[], year: number): number {
  if (values.length === 0) return 0;
  if (year <= years[0]) return values[0];
  if (year >= years[years.length - 1]) return values[values.length - 1];
  for (let i = 0; i < years.length - 1; i++) {
    if (year >= years[i] && year <= years[i + 1]) {
      const t = (year - years[i]) / (years[i + 1] - years[i] || 1);
      return lerp(values[i], values[i + 1], t);
    }
  }
  return values[values.length - 1];
}

function nearestPoint(points: ProjectionPoint[], year: number): ProjectionPoint {
  return points.reduce((best, p) => (Math.abs(p.year - year) < Math.abs(best.year - year) ? p : best), points[0]);
}

function categoryFor(score: number) {
  return score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
}

function scoreColor(s: number) {
  return s >= 85 ? GREEN : s >= 70 ? "#4ade80" : s >= 60 ? AMBER : s >= 40 ? ORANGE : RED;
}

function prettify(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function confidenceColor(c: string) {
  const v = (c || "").toLowerCase();
  if (v.includes("low")) return RED;
  if (v.includes("medium")) return AMBER;
  return GREEN;
}

function feedbackTag(text: string): { icon: string; label: string; color: string } {
  const v = text.toLowerCase();
  const short = text.split(":")[0].trim();
  if (v.includes("ice")) return { icon: "❄️", label: short, color: CYAN };
  if (v.includes("water vapor") || v.includes("moisture")) return { icon: "💧", label: short, color: PURPLE };
  if (v.includes("cloud")) return { icon: "☁️", label: short, color: BLUE };
  if (v.includes("vegetation") || v.includes("carbon")) return { icon: "🌱", label: short, color: GREEN };
  return { icon: "🔁", label: short, color: AMBER };
}

// First year (2025–2100) at which an interpolated metric crosses a threshold.
function crossYear(points: ProjectionPoint[], threshold: number, dir: "above" | "below", get: (p: ProjectionPoint) => number): number | null {
  for (let y = 2025; y <= 2100; y++) {
    const v = interpScalar(points, y, get);
    if (dir === "above" ? v >= threshold : v <= threshold) return y;
  }
  return null;
}

// ── Charts ─────────────────────────────────────────────────────────────────
interface TrendZone { from: number; to: number; color: string }

function TrendChart({
  years, values, year, label, unit, color, decimals = 0, thresholdY, zones, fillOpacity = 0.1,
}: {
  years: number[]; values: number[]; year: number; label: string; unit: string; color: string;
  decimals?: number; thresholdY?: number; zones?: TrendZone[]; fillOpacity?: number;
}) {
  const VW = 100, VH = 56, px = 1, py = 5, bH = 9;
  const cW = VW - px * 2, cH = VH - py - bH;
  const mn = Math.min(...values), mx = Math.max(...values), rng = mx - mn || 1;
  const xOf = (yr: number) => px + ((yr - 2025) / 75) * cW;
  const yOf = (v: number) => py + cH - ((v - mn) / rng) * cH;

  const curV = interpArr(years, values, year);
  const mrkX = xOf(year);
  const mrkY = yOf(curV);
  const pts = values.map((v, i) => `${xOf(years[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
  const areaD = `M${xOf(years[0]).toFixed(2)},${(py + cH).toFixed(2)}` +
    values.map((v, i) => ` L${xOf(years[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join("") +
    ` L${xOf(years[years.length - 1]).toFixed(2)},${(py + cH).toFixed(2)}Z`;

  const callW = 26, callH = 11;
  const cxPos = mrkX + 2 + callW > VW - px ? mrkX - 2 - callW : mrkX + 2;
  const cyPos = Math.max(0, Math.min(VH - bH - callH, mrkY - callH / 2));
  const displayV = decimals > 0 ? curV.toFixed(decimals) : Math.round(curV).toString();

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: 80, display: "block" }}>
        {zones?.map((z, zi) => {
          const clampedHi = Math.min(z.to, mx), clampedLo = Math.max(z.from, mn);
          if (clampedHi <= clampedLo) return null;
          return <rect key={zi} x={px} y={yOf(clampedHi)} width={cW} height={yOf(clampedLo) - yOf(clampedHi)} fill={z.color} opacity="0.14" />;
        })}
        <path d={areaD} fill={color} opacity={fillOpacity} />
        {[0.33, 0.67].map((f) => {
          const yy = py + f * cH;
          return <line key={f} x1={px} y1={yy} x2={px + cW} y2={yy} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
        })}
        {thresholdY !== undefined && thresholdY >= mn && thresholdY <= mx && (
          <line x1={px} y1={yOf(thresholdY)} x2={px + cW} y2={yOf(thresholdY)} stroke={RED} strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.6" />
        )}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={mrkX} y1={py} x2={mrkX} y2={py + cH} stroke={ACCENT} strokeWidth="0.9" strokeDasharray="2.5 2" opacity="0.85" />
        <circle cx={mrkX} cy={mrkY} r="2.4" fill={color} stroke="white" strokeWidth="0.9" />
        <rect x={cxPos} y={cyPos} width={callW} height={callH} rx="2" fill="rgba(6,9,16,0.88)" stroke={color} strokeWidth="0.5" />
        <text x={cxPos + callW / 2} y={cyPos + callH - 2.5} textAnchor="middle" fill="white" fontSize="5.5" fontWeight="700">{displayV}{unit}</text>
        {years.map((yr, i) => (
          <text key={i} x={xOf(yr)} y={VH - 0.5} textAnchor="middle" fill={MUTED} fontSize="4.8">{yr}</text>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, padding: "0 1px" }}>
        <span style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "monospace" }}>{displayV}{unit}</span>
      </div>
    </div>
  );
}

function MonthlyTempChart({ temps, baseline }: { temps: number[]; baseline: number[] }) {
  const W = 480, H = 140, px = 24, py = 12;
  const all = [...temps, ...baseline];
  const min = Math.floor(Math.min(...all) - 2);
  const max = Math.ceil(Math.max(...all) + 2);
  const range = max - min || 1;
  const cW = W - px * 2, cH = H - py * 2 - 14;
  const xp = (i: number) => px + (i / 11) * cW;
  const yp = (v: number) => py + cH - ((Math.max(min, Math.min(max, v)) - min) / range) * cH;
  const gridVals = Array.from({ length: 5 }, (_, i) => Math.round(min + (range / 4) * i));
  const pts = temps.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  const bpts = baseline.map((v, i) => `${xp(i)},${yp(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      {gridVals.map((t) => (
        <g key={t}>
          <line x1={px} y1={yp(t)} x2={W - px} y2={yp(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={px - 3} y={yp(t) + 3} textAnchor="end" fill={MUTED} fontSize="8">{t}°</text>
        </g>
      ))}
      <polyline points={bpts} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={pts} fill="none" stroke={RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {temps.map((v, i) => <circle key={i} cx={xp(i)} cy={yp(v)} r="2.5" fill={BG} stroke={RED} strokeWidth="1.5" />)}
      {MONTHS.map((m, i) => <text key={i} x={xp(i)} y={H - 2} textAnchor="middle" fill={MUTED} fontSize="8">{m[0]}</text>)}
    </svg>
  );
}

function PrecipBars({ vals }: { vals: number[] }) {
  const max = Math.max(...vals, 1);
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

function ScoreSparkline({ years, data, color, year }: { years: number[]; data: number[]; color: string; year: number }) {
  const W = 80, H = 22;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const xOf = (yr: number) => ((yr - 2025) / 75) * W;
  const yOf = (v: number) => H - ((v - mn) / rng) * H * 0.88 + H * 0.06;
  const pts = data.map((v, i) => `${xOf(years[i])},${yOf(v)}`).join(" ");
  const cx = xOf(year);
  const cy = yOf(interpArr(years, data, year));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

// Semicircular gauge for the derived environmental estimates.
function GaugeMeter({ value, max, color }: { value: number; max: number; color: string }) {
  const R = 32, cx = 42, cy = 40, sw = 8;
  const arcLen = Math.PI * R;
  const pct = Math.max(0, Math.min(1, value / max));
  const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  return (
    <svg viewBox="0 0 84 50" style={{ width: 96, height: 56 }}>
      <path d={arc} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} strokeLinecap="round" />
      <path d={arc} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${pct * arcLen} ${arcLen}`} style={{ transition: "stroke-dasharray 0.35s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>{Math.round(value)}</text>
    </svg>
  );
}

const ESTIMATE_BADGE: React.CSSProperties = {
  fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: AMBER,
  background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
  borderRadius: 4, padding: "2px 6px", marginLeft: "auto",
};

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ClimateApp() {
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [suggestions, setSuggestions] = useState<LocationOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [year, setYear] = useState(2050);
  const [trajectory, setTrajectory] = useState<ProjectionPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Present-day measured AQI baseline (Open-Meteo, free, no key) for the AQI estimate.
  const [baselineAqi, setBaselineAqi] = useState<number | null>(null);
  const [aqiMeasured, setAqiMeasured] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "ClimateVision — Future Climate Projections for Any Location on Earth";
  }, []);

  // Fetch present-day air quality for the selected location once results load.
  useEffect(() => {
    if (!trajectory || !selectedLocation) return;
    let cancelled = false;
    setBaselineAqi(null);
    setAqiMeasured(false);
    (async () => {
      try {
        const r = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lng}&current=us_aqi`
        );
        const j = await r.json();
        const v = j?.current?.us_aqi;
        if (cancelled) return;
        if (typeof v === "number" && isFinite(v)) {
          setBaselineAqi(v);
          setAqiMeasured(true);
        } else {
          setBaselineAqi(FALLBACK_BASELINE_AQI);
          setAqiMeasured(false);
        }
      } catch {
        if (!cancelled) {
          setBaselineAqi(FALLBACK_BASELINE_AQI);
          setAqiMeasured(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [trajectory, selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".location-input-container")) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (locationText.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(locationText)}`);
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (err) {
        console.warn("Location search failed:", err);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [locationText]);

  useEffect(() => {
    if (!isLoading) { setLoadingStep(0); return; }
    const id = setInterval(() => setLoadingStep((s) => Math.min(s + 1, CHECKPOINTS.length - 1)), 4000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Auto-glide the year slider 2025 → 2100 so users can watch the climate evolve.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const SPEED = (2100 - 2025) / 11000; // years per ms → full sweep ≈ 11s
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); // clamp big gaps (tab refocus)
      last = now;
      setYear((y) => Math.min(2100, y + dt * SPEED));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Stop playback once the timeline reaches the end.
  useEffect(() => {
    if (playing && year >= 2100) setPlaying(false);
  }, [playing, year]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (year >= 2099.5) setYear(2025); // replay from the start
    setPlaying(true);
  };

  const setYearManual = (y: number) => { setPlaying(false); setYear(y); };

  const selectLocation = (opt: LocationOption) => {
    setSelectedLocation(opt);
    setLocationText(opt.name);
    setShowSuggestions(false);
  };

  const generate = async () => {
    if (!selectedLocation) { setError("Please select a location from the suggestions."); return; }
    setError(null);
    setIsLoading(true);
    setTrajectory(null);
    try {
      const response = await fetch("/api/climate-trajectory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: { lat: selectedLocation.lat, lng: selectedLocation.lng }, years: CHECKPOINTS }),
      });
      if (!response.ok) {
        let detail = response.statusText;
        try { const e = await response.json(); detail = e.message || detail; } catch { /* ignore */ }
        throw new Error(detail);
      }
      const data = await response.json();
      if (data.success && data.data?.points?.length) {
        const points: ProjectionPoint[] = [...data.data.points].sort((a: ProjectionPoint, b: ProjectionPoint) => a.year - b.year);
        setTrajectory(points);
      } else {
        throw new Error("Invalid response from climate model.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const newSearch = () => {
    setPlaying(false);
    setTrajectory(null);
    setError(null);
  };

  const exportPDF = async () => {
    if (!resultsRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(resultsRef.current, { backgroundColor: "#0b111e", scale: 2, useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const name = selectedLocation?.city || selectedLocation?.name.split(",")[0] || "location";
      pdf.save(`climate-projection-${name}-${Math.round(year)}.pdf`);
    } catch (err) {
      console.warn("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Derived trend arrays (stable per trajectory)
  const traj = useMemo(() => {
    if (!trajectory) return null;
    const years = trajectory.map((p) => p.year);
    return {
      years,
      temp: trajectory.map((p) => p.temperature.annual_mean),
      precip: trajectory.map((p) => p.precipitation.annual_total),
      heat: trajectory.map((p) => p.extremes.heat_stress_days),
      score: trajectory.map((p) => p.habitability.score),
      sea: trajectory.map((p) => p.extremes.sea_level_rise_cm ?? 0),
      drought: trajectory.map((p) => p.extremes.drought_risk * 100),
    };
  }, [trajectory]);

  // Snapshot at current slider year
  const d = useMemo(() => {
    if (!trajectory) return null;
    const pts = trajectory;
    const avgTemp = interpScalar(pts, year, (p) => p.temperature.annual_mean);
    const tempChange = interpScalar(pts, year, (p) => p.temperature.anomaly);
    const annualPrecip = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.precipitation.annual_total)));
    const precipChange = interpScalar(pts, year, (p) => p.precipitation.anomaly_percent);
    const heatDays = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.heat_stress_days)));
    const baseHeatDays = Math.round(pts[0].extremes.heat_stress_days);
    const drought = Math.max(0, Math.min(100, Math.round(interpScalar(pts, year, (p) => p.extremes.drought_risk * 100))));
    const flood = Math.max(0, Math.min(100, Math.round(interpScalar(pts, year, (p) => p.extremes.flood_risk * 100))));
    const seaLevel = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.sea_level_rise_cm ?? 0)));
    const score = Math.max(0, Math.min(100, Math.round(interpScalar(pts, year, (p) => p.habitability.score))));
    const category = categoryFor(score);
    const monthlyTemps = Array.from({ length: 12 }, (_, m) => interpScalar(pts, year, (p) => p.temperature.monthly?.[m] ?? p.temperature.annual_mean));
    const rawMonthlyPrecip = Array.from({ length: 12 }, (_, m) => Math.max(0, interpScalar(pts, year, (p) => p.precipitation.monthly?.[m] ?? p.precipitation.annual_total / 12)));
    const rawSum = rawMonthlyPrecip.reduce((a, b) => a + b, 0) || 1;
    const monthlyPrecip = rawMonthlyPrecip.map((v) => Math.max(0, Math.round((v / rawSum) * annualPrecip)));

    let minIdx = 0, maxIdx = 0;
    monthlyTemps.forEach((v, i) => { if (v < monthlyTemps[minIdx]) minIdx = i; if (v > monthlyTemps[maxIdx]) maxIdx = i; });
    let wetIdx = 0, dryIdx = 0;
    monthlyPrecip.forEach((v, i) => { if (v > monthlyPrecip[wetIdx]) wetIdx = i; if (v < monthlyPrecip[dryIdx]) dryIdx = i; });

    const breakdownKeys = pts[0].habitability.breakdown ? Object.keys(pts[0].habitability.breakdown) : [];
    const breakdown = breakdownKeys.map((k) => ({
      key: k,
      label: prettify(k),
      neg: k.toLowerCase().includes("penalty"),
      val: interpScalar(pts, year, (p) => p.habitability.breakdown?.[k] ?? 0),
    }));

    const np = nearestPoint(pts, year);
    const sensitivity = np.atmospheric_physics?.climate_sensitivity;
    const sensLabel = sensitivity == null ? null : sensitivity >= 2.2 ? "High" : sensitivity >= 1.6 ? "Moderate" : "Low";
    const sensColor = sensLabel === "High" ? ORANGE : sensLabel === "Moderate" ? AMBER : GREEN;
    const feedbacks = np.atmospheric_physics?.feedback_mechanisms ?? [];

    // Derived estimates (clearly labelled as estimates in the UI) — computed from
    // the real modeled variables plus published scientific relationships.
    const estInputs: EstimateInputs = {
      avgTemp, tempAnomaly: tempChange, annualPrecip, precipChangePct: precipChange,
      heatDays, baseHeatDays, droughtRisk: drought / 100,
    };
    const agri = agriculturalViability(estInputs);
    const bio = biodiversityLoss(estInputs);
    const water = waterStress(estInputs);
    const aqi = projectedAqi(baselineAqi ?? FALLBACK_BASELINE_AQI, estInputs);
    const twin = climateTwin(avgTemp, annualPrecip, selectedLocation?.name);

    return {
      avgTemp, tempChange, annualPrecip, precipChange, heatDays, baseHeatDays, drought, flood, seaLevel,
      score, category, monthlyTemps, monthlyPrecip, minIdx, maxIdx, wetIdx, dryIdx, breakdown,
      np, sensitivity, sensLabel, sensColor, feedbacks,
      agri, bio, water, aqi, twin,
      circulation: np.atmospheric_physics?.circulation_pattern,
      climateZone: np.location?.climate_zone,
      confidence: np.metadata?.confidence ?? "medium-high",
      resolution: np.metadata?.resolution,
      model: np.metadata?.model ?? "CBottle / ICON",
      modelVersion: np.metadata?.model_version ?? "",
    };
  }, [trajectory, year, baselineAqi, selectedLocation]);

  // Tipping points computed from real interpolated trajectory
  const tipping = useMemo(() => {
    if (!trajectory) return [];
    const items = [
      { icon: "🌡️", label: "Heat stress exceeds 15 days/yr", year: crossYear(trajectory, 15, "above", (p) => p.extremes.heat_stress_days) },
      { icon: "⚠️", label: "Habitability drops below 70 (Fair territory)", year: crossYear(trajectory, 70, "below", (p) => p.habitability.score) },
      { icon: "🌊", label: "Sea level rise exceeds 50 cm", year: crossYear(trajectory, 50, "above", (p) => p.extremes.sea_level_rise_cm ?? 0) },
      { icon: "💧", label: "Drought risk exceeds 50%", year: crossYear(trajectory, 50, "above", (p) => p.extremes.drought_risk * 100) },
    ];
    return items.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
  }, [trajectory]);

  const displayYear = Math.round(year);
  const sc = d ? scoreColor(d.score) : GREEN;
  const tPct = ((year - 2025) / 75) * 100;
  const maxBreakdown = d ? Math.max(...d.breakdown.map((b) => Math.abs(b.val)), 1) : 1;

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!trajectory) {
    return (
      <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ background: "rgba(10,13,20,0.90)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(16px)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,hsl(192,91%,36%),hsl(215,91%,50%))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>CV</div>
              <span style={{ fontWeight: 700, fontSize: 17 }}>ClimateVision</span>
            </div>
            <button onClick={() => (window.location.href = "/comparison")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 13, cursor: "pointer" }}>
              <GitCompare style={{ width: 15, height: 15 }} />
              <span>Compare Locations</span>
            </button>
          </div>
        </header>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD, fontSize: 11, color: ACCENT, marginBottom: 20, letterSpacing: "0.05em" }}>
              CBottle · ICON Atmospheric Physics
            </div>
            <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, marginBottom: 14 }}>
              See the future climate<br />of any place on Earth
            </h1>
            <p style={{ fontSize: 15, color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>
              Search a location, then glide through 2025–2100 to watch temperature, precipitation,
              risk and habitability evolve — backed by a real atmospheric model.
            </p>

            <div className="location-input-container" style={{ position: "relative", textAlign: "left" }}>
              <div style={{ position: "relative" }}>
                <Search style={{ width: 18, height: 18, color: MUTED, position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={locationText}
                  onChange={(e) => { setLocationText(e.target.value); setSelectedLocation(null); }}
                  onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
                  placeholder="Search a city or place — e.g. Amsterdam"
                  style={{ width: "100%", padding: "14px 14px 14px 44px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.05)", color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "rgba(15,20,30,0.98)", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", zIndex: 20, backdropFilter: "blur(16px)" }}>
                  {suggestions.slice(0, 6).map((s, i) => (
                    <div key={i} onClick={() => selectLocation(s)}
                      style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderBottom: i < Math.min(suggestions.length, 6) - 1 ? `1px solid ${BORDER}` : "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <MapPin style={{ width: 15, height: 15, color: ACCENT, flexShrink: 0 }} />
                      <span style={{ fontSize: 14 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={generate}
              disabled={isLoading || !selectedLocation}
              style={{
                marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
                cursor: isLoading || !selectedLocation ? "not-allowed" : "pointer",
                background: isLoading || !selectedLocation ? "hsl(217,33%,22%)" : "linear-gradient(135deg, hsl(192,91%,40%) 0%, hsl(215,91%,55%) 100%)",
                color: isLoading || !selectedLocation ? "hsl(215,20%,45%)" : "white",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {isLoading ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> Running model…</> : "Generate Projection"}
            </button>

            {isLoading && (
              <div style={{ marginTop: 18, fontSize: 13, color: MUTED }}>
                Running CBottle ICON model — checkpoint {Math.min(loadingStep + 1, CHECKPOINTS.length)}/{CHECKPOINTS.length} ({CHECKPOINTS[loadingStep]})
                <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: ACCENT, borderRadius: 2, width: `${((loadingStep + 1) / CHECKPOINTS.length) * 100}%`, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Sampling 4 checkpoint years (~15s) so the slider can glide between them.</div>
              </div>
            )}
            {error && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: `${RED}14`, border: `1px solid ${RED}30`, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
          </div>
        </main>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  // Plain-language outlook, derived live from the real modeled values.
  const placeName = selectedLocation?.name?.split(",")[0] ?? "This location";
  const heatDelta = d!.heatDays - d!.baseHeatDays;
  const nextTip = tipping.find((t) => t.year != null && (t.year as number) > displayYear);
  const crossedTips = tipping.filter((t) => t.year != null && (t.year as number) <= displayYear).length;

  return (
    <div style={{ backgroundColor: BG, color: "white", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sticky Header */}
      <header style={{ background: "rgba(10,13,20,0.90)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,hsl(192,91%,36%),hsl(215,91%,50%))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white" }}>CV</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ClimateVision</span>
            <div style={{ width: 1, height: 14, background: BORDER }} />
            <span style={{ fontSize: 13 }}>{selectedLocation?.name}</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{displayYear}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={newSearch} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12, cursor: "pointer" }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> New Search
            </button>
            <button onClick={() => (window.location.href = "/comparison")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: "pointer" }}>
              <GitCompare style={{ width: 13, height: 13 }} /> Compare
            </button>
            <button onClick={exportPDF} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: exporting ? "wait" : "pointer" }}>
              {exporting ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 13, height: 13 }} />} Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Year Slider — sticky */}
      <div style={{ position: "sticky", top: 48, zIndex: 45, background: "rgba(8,11,18,0.97)", borderBottom: `1px solid ${BORDER}`, backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={togglePlay} title={playing ? "Pause" : "Play 2025 → 2100"} aria-label={playing ? "Pause timeline" : "Play timeline"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer", color: playing ? ACCENT : "white", border: `1px solid ${playing ? ACCENT : "rgba(255,255,255,0.18)"}`, background: playing ? `${ACCENT}22` : CARD, transition: "all 0.2s ease" }}>
              {playing ? <Pause style={{ width: 15, height: 15 }} /> : <Play style={{ width: 15, height: 15, marginLeft: 1 }} />}
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              {[2025, 2030, 2050, 2075, 2100].map((y) => (
                <button key={y} onClick={() => setYearManual(y)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${displayYear === y ? ACCENT : "rgba(255,255,255,0.12)"}`, background: displayYear === y ? `${ACCENT}18` : "transparent", color: displayYear === y ? ACCENT : MUTED, fontSize: 11, fontWeight: displayYear === y ? 700 : 400, cursor: "pointer" }}>
                  {y}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.3 }} />
                <input type="range" min={2025} max={2100} step={0.1} value={year}
                  onChange={(e) => setYearManual(Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: ACCENT, position: "relative", zIndex: 1, margin: 0, display: "block" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginTop: 1 }}>
                {Array.from({ length: 16 }, (_, i) => 2025 + i * 5).map((y) => (
                  <div key={y} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <div style={{ width: 1, height: y % 25 === 0 ? 6 : 3, background: y % 25 === 0 ? MUTED : "rgba(255,255,255,0.18)" }} />
                    {y % 25 === 0 && <span style={{ fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {[
                { v: displayYear.toString(), sub: "year", c: ACCENT },
                { v: d!.score.toString(), sub: "score", c: sc },
                { v: `+${d!.tempChange.toFixed(1)}°`, sub: "warming", c: RED },
              ].map(({ v, sub, c }) => (
                <div key={sub} style={{ ...card, padding: "4px 11px", textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 8, color: MUTED, marginTop: 1 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main ref={resultsRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 20px" }}>
        {/* Location Banner */}
        <div style={{ ...card, padding: 18, marginBottom: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,0.03) 1px,transparent 0)", backgroundSize: "24px 24px", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>{selectedLocation?.name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
                <span>{Math.abs(selectedLocation!.lat).toFixed(4)}° {selectedLocation!.lat >= 0 ? "N" : "S"}, {Math.abs(selectedLocation!.lng).toFixed(4)}° {selectedLocation!.lng >= 0 ? "E" : "W"}</span>
                {d!.climateZone && <><span>·</span><span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>{d!.climateZone}</span></>}
                {d!.sensLabel && <><span>·</span><span>Sensitivity: <span style={{ color: d!.sensColor, fontWeight: 600 }}>{d!.sensLabel}</span></span></>}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d!.circulation && (
                  <span style={{ background: `${BLUE}14`, border: `1px solid ${BLUE}28`, color: BLUE, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500 }}>🔄 {d!.circulation.split(/[-–(]/)[0].trim()}</span>
                )}
                {d!.feedbacks.slice(0, 3).map((f, i) => {
                  const t = feedbackTag(f);
                  return <span key={i} style={{ background: `${t.color}14`, border: `1px solid ${t.color}28`, color: t.color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 500 }}>{t.icon} {t.label}</span>;
                })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Warming Scenario</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>RCP 4.5–8.5 · SSP2</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 2 }}>+{d!.tempChange.toFixed(1)}°C</div>
              <div style={{ fontSize: 11, color: MUTED }}>vs baseline</div>
            </div>
          </div>
        </div>

        {/* Climate Outlook — plain-language summary (updates live with the slider) */}
        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span style={{ fontSize: 15 }}>📋</span>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Climate Outlook · {displayYear}</h2>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "rgba(255,255,255,0.9)", margin: 0 }}>
            By <strong style={{ color: "white" }}>{displayYear}</strong>, {placeName} is projected to be{" "}
            <strong style={{ color: RED }}>+{d!.tempChange.toFixed(1)}°C warmer</strong> than its baseline — close to today's climate in{" "}
            <strong style={{ color: ACCENT }}>{d!.twin}</strong>. Heat-stress days{" "}
            <strong style={{ color: ORANGE }}>{heatDelta >= 0 ? "rise" : "fall"} from {d!.baseHeatDays} to {d!.heatDays}/yr</strong>, annual rainfall shifts{" "}
            <strong style={{ color: BLUE }}>{d!.precipChange >= 0 ? "+" : ""}{d!.precipChange.toFixed(1)}%</strong>, and overall habitability sits at{" "}
            <strong style={{ color: sc }}>{d!.score}/100 ({d!.category})</strong>.
            {nextTip
              ? <> The next threshold ahead — <strong style={{ color: AMBER }}>{nextTip.label.toLowerCase()}</strong> — is crossed around <strong style={{ color: AMBER }}>{nextTip.year}</strong>.</>
              : crossedTips > 0
                ? <> All <strong style={{ color: RED }}>{crossedTips}</strong> modeled tipping points have already been crossed by this point.</>
                : <> No modeled tipping points are crossed at this horizon.</>}
          </p>
        </div>

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Avg Temperature</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.avgTemp.toFixed(1)}°C</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: RED }}>+{d!.tempChange.toFixed(1)}°</span>
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Annual Precip</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.annualPrecip}mm</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>{d!.precipChange >= 0 ? "+" : ""}{d!.precipChange.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Heat Stress</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.heatDays}</span>
              <span style={{ fontSize: 12, color: MUTED }}>days/yr</span>
            </div>
            <div style={{ marginTop: 6, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
              <div style={{ height: "100%", borderRadius: 2, background: ORANGE, width: `${Math.min((d!.heatDays / Math.max(...traj!.heat, 1)) * 100, 100)}%`, transition: "width 0.25s ease" }} />
            </div>
          </div>
          <div style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Habitability</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{d!.score}<span style={{ fontSize: 14, color: MUTED }}>/100</span></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: sc, marginTop: 2 }}>{d!.category}</div>
            </div>
            <div style={{ position: "relative", width: 54, height: 54 }}>
              <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="4" strokeDasharray={`${d!.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.3s ease" }} />
              </svg>
            </div>
          </div>
        </div>

        {/* Metric Trajectories */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>📈</span>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Metric Trajectories</h2>
              <span style={{ fontSize: 10, color: MUTED, marginLeft: 4 }}>2025 → 2100</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: MUTED }}>
              <div style={{ width: 14, height: 1.5, borderTop: `1.5px dashed ${ACCENT}`, opacity: 0.7 }} />
              <span>= selected year marker (synced with slider above)</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <TrendChart years={traj!.years} values={traj!.temp} year={year} label="Temperature" unit="°C" color={RED} decimals={1} thresholdY={18} />
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch", flexShrink: 0 }} />
            <TrendChart years={traj!.years} values={traj!.precip} year={year} label="Precipitation" unit="mm" color={BLUE} decimals={0} />
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch", flexShrink: 0 }} />
            <TrendChart years={traj!.years} values={traj!.heat} year={year} label="Heat Days" unit="d" color={ORANGE} decimals={0} thresholdY={15} />
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch", flexShrink: 0 }} />
            <TrendChart years={traj!.years} values={traj!.score} year={year} label="Habitability" unit="" color={sc} decimals={0}
              zones={[
                { from: 85, to: 100, color: GREEN }, { from: 70, to: 85, color: "#4ade80" },
                { from: 60, to: 70, color: AMBER }, { from: 40, to: 60, color: ORANGE }, { from: 0, to: 40, color: RED },
              ]} />
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch", flexShrink: 0 }} />
            <TrendChart years={traj!.years} values={traj!.sea} year={year} label="Sea Level" unit="cm" color={CYAN} decimals={0} thresholdY={50} />
            <div style={{ width: 1, background: BORDER, alignSelf: "stretch", flexShrink: 0 }} />
            <TrendChart years={traj!.years} values={traj!.drought} year={year} label="Drought Risk" unit="%" color={AMBER} decimals={0} thresholdY={50} />
          </div>
          <div style={{ marginTop: 12, padding: "6px 10px", background: `${ACCENT}07`, border: `1px solid ${ACCENT}18`, borderRadius: 8, fontSize: 10, color: MUTED }}>
            💡 Drag the year slider to move the marker across all six charts simultaneously and see how each metric evolves. Dashed horizontal lines mark critical thresholds.
          </div>
        </div>

        {/* Temperature */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Temperature Projection</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span style={{ color: MUTED }}>2025 baseline</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 20, height: 2, background: RED, borderRadius: 1 }} />
                <span style={{ color: MUTED }}>{displayYear}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 158px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Mean", value: `${d!.avgTemp.toFixed(1)}°C` },
                { label: "Change", value: `+${d!.tempChange.toFixed(1)}°`, color: RED },
                { label: `Min (${MONTHS[d!.minIdx]})`, value: `${d!.monthlyTemps[d!.minIdx].toFixed(1)}°C` },
                { label: `Max (${MONTHS[d!.maxIdx]})`, value: `${d!.monthlyTemps[d!.maxIdx].toFixed(1)}°C` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <MonthlyTempChart temps={d!.monthlyTemps} baseline={trajectory![0].temperature.monthly} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (°C)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d!.monthlyTemps[i].toFixed(1)}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Precipitation */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Precipitation Pattern</h2>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 158px", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Annual Total", value: `${d!.annualPrecip}mm` },
                { label: "Change", value: `${d!.precipChange >= 0 ? "+" : ""}${d!.precipChange.toFixed(1)}%`, color: BLUE },
                { label: "Wettest", value: `${MONTHS[d!.wetIdx]} ${d!.monthlyPrecip[d!.wetIdx]}mm` },
                { label: "Driest", value: `${MONTHS[d!.dryIdx]} ${d!.monthlyPrecip[d!.dryIdx]}mm` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 7, padding: "8px 9px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", color: MUTED }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: color ?? "white", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
            <PrecipBars vals={d!.monthlyPrecip} />
            <div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>Monthly (mm)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ color: MUTED }}>{m}</span>
                    <span style={{ fontFamily: "monospace" }}>{d!.monthlyPrecip[i]}mm</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Risk & Extremes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Heat Stress", value: d!.heatDays, unit: "days/yr", delta: `+${Math.max(0, d!.heatDays - d!.baseHeatDays)}d`, color: RED },
            { label: "Drought Risk", value: `${d!.drought}%`, sub: d!.drought < 25 ? "Low" : d!.drought < 40 ? "Elevated" : "High", bar: d!.drought / 100, color: AMBER },
            { label: "Flood Risk", value: `${d!.flood}%`, sub: d!.flood < 30 ? "Low" : d!.flood < 60 ? "Elevated" : "High", bar: d!.flood / 100, color: BLUE },
            { label: "Sea Level Rise", value: `${d!.seaLevel}cm`, sub: d!.seaLevel < 25 ? "Manageable" : d!.seaLevel < 50 ? "Serious" : "Critical", color: CYAN },
          ].map(({ label, value, unit, delta, sub, bar, color }) => (
            <div key={label} style={{ ...card, padding: 14, borderTop: `2px solid ${color}` }}>
              <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 }}>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 700, color }}>{value}</span>
                  {unit && <span style={{ fontSize: 10, color: MUTED, display: "block", marginTop: -2 }}>{unit}</span>}
                </div>
                {delta && <span style={{ fontSize: 10, padding: "2px 5px", background: `${RED}20`, color: RED, borderRadius: 4 }}>{delta}</span>}
                {sub && <span style={{ fontSize: 10, fontWeight: 600, color }}>{sub}</span>}
              </div>
              {bar !== undefined && (
                <div style={{ marginTop: 8, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(bar * 100, 100)}%`, transition: "width 0.25s ease" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Climate Twin + Atmospheric Physics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {/* Climate Twin (estimated analog) */}
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🌍</span>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Climate Twin</h3>
              <span style={ESTIMATE_BADGE}>ESTIMATE</span>
            </div>
            <p style={{ fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 1.5 }}>
              {(selectedLocation?.city || selectedLocation?.name.split(",")[0])} in {Math.round(year)} will feel like today's climate of:
            </p>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, marginBottom: 12, lineHeight: 1.2 }}>{d!.twin}</div>
            <p style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.5 }}>
              Nearest present-day climate analog, matched on annual mean temperature and precipitation against a reference set of global city climate normals. Drag the slider to watch the analog migrate as warming progresses.
            </p>
          </div>

          {/* Atmospheric Physics (model output) */}
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⚛️</span>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Atmospheric Physics</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
              {[
                { label: "Circulation Pattern", value: d!.circulation ?? "—", color: BLUE },
                { label: "Climate Sensitivity", value: d!.sensitivity != null ? `${d!.sensitivity.toFixed(1)}°C per CO₂ doubling` : "—", color: ORANGE },
                { label: "Active Feedbacks", value: d!.feedbacks.length ? d!.feedbacks.map((f) => f.split(":")[0].trim()).join(" · ") : "—", color: PURPLE },
                { label: "Model Confidence", value: prettify(d!.confidence), color: confidenceColor(d!.confidence) },
                { label: "Model", value: d!.modelVersion ? `${d!.model} ${d!.modelVersion}` : d!.model, color: MUTED },
                { label: "Resolution", value: d!.resolution ?? "—", color: MUTED },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: 6, marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: MUTED, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontWeight: 600, color, textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Environmental & Agricultural Impact (derived estimates) */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🌿</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Environmental & Agricultural Impact</h2>
            <span style={ESTIMATE_BADGE}>ESTIMATES</span>
          </div>
          <p style={{ fontSize: 10.5, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
            Derived from the modeled climate variables and public datasets (FAO agro-climatic suitability, IPCC AR6 range-loss figures, Open-Meteo air quality) — these are estimates, not direct model outputs.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {(() => {
              const aqiColor = d!.aqi < 50 ? GREEN : d!.aqi < 100 ? AMBER : d!.aqi < 150 ? ORANGE : RED;
              const aqiSub = d!.aqi < 50 ? "Good" : d!.aqi < 100 ? "Moderate" : d!.aqi < 150 ? "Unhealthy (SG)" : "Unhealthy";
              const agriColor = d!.agri >= 70 ? GREEN : d!.agri >= 45 ? AMBER : ORANGE;
              const agriSub = d!.agri >= 70 ? "Favorable" : d!.agri >= 45 ? "Reduced" : "Stressed";
              const waterColor = d!.water < 35 ? GREEN : d!.water < 60 ? AMBER : RED;
              const waterSub = d!.water < 35 ? "Low stress" : d!.water < 60 ? "Moderate" : "High stress";
              const bioColor = d!.bio < 10 ? AMBER : d!.bio < 25 ? ORANGE : RED;
              const bioSub = d!.bio < 10 ? "Mild" : d!.bio < 25 ? "Moderate" : "Severe";
              const gauges = [
                { name: "Air Quality", value: d!.aqi, max: 200, color: aqiColor, sub: `US AQI · ${aqiSub}`, note: aqiMeasured ? "Measured baseline + climate ozone penalty" : "Estimated baseline + climate ozone penalty" },
                { name: "Agricultural Viability", value: d!.agri, max: 100, color: agriColor, sub: agriSub, note: "Agro-climatic suitability (thermal + water)" },
                { name: "Water Stress", value: d!.water, max: 100, color: waterColor, sub: waterSub, note: "From modeled drought risk + precipitation" },
                { name: "Biodiversity Loss", value: d!.bio, max: 60, color: bioColor, sub: `${bioSub} · % species`, note: "Range loss calibrated to IPCC AR6" },
              ];
              return gauges.map((g) => (
                <div key={g.name} style={{ textAlign: "center", padding: "14px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", justifyContent: "center" }}><GaugeMeter value={g.value} max={g.max} color={g.color} /></div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{g.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: g.color, marginTop: 2 }}>{g.sub}</div>
                  <div style={{ fontSize: 9.5, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{g.note}</div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Tipping Points */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Tipping Point Timeline</h2>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED }}>Computed from this location's trajectory</span>
          </div>
          <div style={{ height: 4, background: BORDER, borderRadius: 2, marginBottom: 16, position: "relative" }}>
            <div style={{ height: "100%", borderRadius: 2, background: `linear-gradient(to right, ${GREEN}, ${AMBER}, ${RED})`, width: `${tPct}%`, transition: "width 0.25s ease" }} />
            <div style={{ position: "absolute", top: "50%", left: `${tPct}%`, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: ACCENT, border: "2px solid white", transition: "left 0.25s ease" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {tipping.map((tp) => {
              const reached = tp.year != null;
              const passed = reached && year >= tp.year!;
              const isNext = reached && !passed && tipping.filter((x) => x.year != null && year < x.year!)[0]?.year === tp.year;
              return (
                <div key={tp.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: passed ? "rgba(239,68,68,0.07)" : isNext ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${passed ? "rgba(239,68,68,0.22)" : isNext ? "rgba(245,158,11,0.22)" : BORDER}`, transition: "all 0.25s ease" }}>
                  <span style={{ fontSize: 16 }}>{tp.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: passed ? RED : isNext ? AMBER : MUTED }}>{tp.label}</div>
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{reached ? `${tp.year} · ${tp.year! - 2025} years from baseline` : "Not reached by 2100"}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: passed ? RED : MUTED }}>{reached ? tp.year : "—"}</div>
                  {passed && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(239,68,68,0.18)", color: RED, borderRadius: 4, fontWeight: 700 }}>CROSSED</span>}
                  {isNext && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(245,158,11,0.18)", color: AMBER, borderRadius: 4, fontWeight: 700 }}>NEXT</span>}
                  {!passed && !isNext && reached && <span style={{ fontSize: 9, padding: "2px 6px", background: BORDER, color: MUTED, borderRadius: 4 }}>FUTURE</span>}
                  {!reached && <span style={{ fontSize: 9, padding: "2px 6px", background: `${GREEN}18`, color: GREEN, borderRadius: 4, fontWeight: 700 }}>STABLE</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Habitability Assessment */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Habitability Assessment</h2>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
              <div style={{ position: "relative", width: 100, height: 100 }}>
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={sc} strokeWidth="3" strokeDasharray={`${d!.score}, 100`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.25s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: sc }}>{d!.score}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: sc }}>{d!.category}</span>
              <ScoreSparkline years={traj!.years} data={traj!.score} color={sc} year={year} />
              <div style={{ fontSize: 8, color: MUTED }}>2025 → 2100 trajectory</div>
            </div>
            {d!.breakdown.length > 0 && (
              <div style={{ flex: 1, minWidth: 280 }}>
                {/* Diverging axis legend: penalties grow left, contributions grow right */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 175, flexShrink: 0 }} />
                  <div style={{ flex: 1, position: "relative", height: 11 }}>
                    <span style={{ position: "absolute", left: 0, fontSize: 9, color: MUTED }}>− penalty</span>
                    <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 9, color: MUTED }}>0</span>
                    <span style={{ position: "absolute", right: 0, fontSize: 9, color: MUTED }}>+ contribution</span>
                  </div>
                  <div style={{ width: 40, flexShrink: 0 }} />
                </div>
                {d!.breakdown.map((item) => {
                  const half = Math.min((Math.abs(item.val) / maxBreakdown) * 50, 50);
                  return (
                    <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                      <div style={{ fontSize: 11, width: 175, color: MUTED, flexShrink: 0 }}>{item.label}</div>
                      <div style={{ flex: 1, position: "relative", height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.22)" }} />
                        <div style={{ position: "absolute", top: 0, bottom: 0, width: `${half}%`, left: item.neg ? undefined : "50%", right: item.neg ? "50%" : undefined, background: item.neg ? RED : GREEN, borderRadius: item.neg ? "3px 0 0 3px" : "0 3px 3px 0", transition: "width 0.25s ease, left 0.25s ease, right 0.25s ease" }} />
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: item.neg ? RED : GREEN, width: 40, textAlign: "right" }}>
                        {item.neg ? "−" : "+"}{Math.abs(item.val).toFixed(1)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 13, fontWeight: 700, color: sc }}>
                  Total: {d!.score}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ r: "0–39", l: "Severe", c: RED }, { r: "40–59", l: "Poor", c: ORANGE }, { r: "60–69", l: "Fair", c: AMBER }, { r: "70–84", l: "Good", c: GREEN }, { r: "85–100", l: "Excellent", c: "#4ade80" }].map((b) => {
              const active = b.l === d!.category;
              return <div key={b.r} style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, background: active ? `${b.c}18` : "rgba(255,255,255,0.04)", color: active ? b.c : MUTED, fontWeight: active ? 700 : 400, border: active ? `1px solid ${b.c}35` : "none" }}>{b.l} ({b.r})</div>;
            })}
          </div>
        </div>
      </main>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>
          ClimateVision · {d!.model}{d!.modelVersion ? ` ${d!.modelVersion}` : ""} · Confidence: {prettify(d!.confidence)} · RCP 4.5–8.5 / SSP2 · For research &amp; planning
        </p>
      </footer>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
