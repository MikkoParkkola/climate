import { useState, useEffect, useMemo, useRef } from "react";
import { GitCompare, Loader2, Download, Search, MapPin, ArrowLeft, Play, Pause, ShieldCheck, ExternalLink, Share2, Check } from "lucide-react";
import GuidedClimateExplainer from "@/components/guided-climate-explainer";
import ScenarioSmallMultiples, { type ScenarioSmallMultipleMetric } from "@/components/scenario-small-multiples";
import ScoreSensitivity, { type ScoreSensitivityInput } from "@/components/score-sensitivity";

// ── Theme: "field report" — warm ink, ember accent, opaque hairline panels ──
const BG = "hsl(28,13%,8%)";
const CARD = "hsl(28,13%,11.5%)";
const BORDER = "hsl(34,12%,22%)";
const ACCENT = "hsl(24,88%,56%)";
const MUTED = "hsl(38,11%,60%)";
const RED = "hsl(6,72%,57%)";
const BLUE = "hsl(200,45%,58%)";
const ORANGE = "hsl(28,82%,56%)";
const GREEN = "hsl(150,38%,50%)";
const AMBER = "hsl(38,72%,56%)";
const PURPLE = "hsl(280,30%,66%)";
const CYAN = "hsl(200,48%,58%)";
const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_MONO = "'Space Mono', ui-monospace, monospace";
const card: React.CSSProperties = { backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 4 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BASELINE_YEAR = 2025;
const MAX_YEAR = 2100;
const CURRENT_FORECAST_YEAR = Math.min(MAX_YEAR, Math.max(BASELINE_YEAR + 1, new Date().getFullYear()));
const FIVE_YEAR_CHECKPOINTS = Array.from({ length: 15 }, (_, i) => 2030 + i * 5).filter((year) => year >= CURRENT_FORECAST_YEAR);
const CHECKPOINTS = Array.from(new Set([BASELINE_YEAR, CURRENT_FORECAST_YEAR, ...FIVE_YEAR_CHECKPOINTS])).sort((a, b) => a - b);
const YEAR_TICKS = CHECKPOINTS;
const QUICK_YEAR_BUTTONS = Array.from(new Set([CURRENT_FORECAST_YEAR, 2030, 2050, 2075, 2100].filter((year) => year >= CURRENT_FORECAST_YEAR)));
const ROADMAP_YEARS = Array.from(new Set([CURRENT_FORECAST_YEAR, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].filter((year) => year >= CURRENT_FORECAST_YEAR && year <= MAX_YEAR))).sort((a, b) => a - b);
const FREEZING_MONTHLY_MEAN_C = 0;
const SCENARIOS = [
  { id: "ssp126", label: "SSP1-2.6", caption: "low emissions; strong mitigation" },
  { id: "ssp245", label: "SSP2-4.5", caption: "middle path; current-policy-adjacent reference" },
  { id: "ssp370", label: "SSP3-7.0", caption: "high emissions; weak mitigation stress case" },
  { id: "ssp585", label: "SSP5-8.5", caption: "very high emissions; low-likelihood stress test" },
] as const;
type ScenarioId = (typeof SCENARIOS)[number]["id"];
const DEFAULT_SCENARIO: ScenarioId = "ssp245";
const DEFAULT_SCENARIO_POLICY_VERSION = "current-policy-reference-2025";
const DEFAULT_SCENARIO_EXPLANATION =
  "Default reference: 2025 UNEP current-policy and Climate Action Tracker policies/action estimates put end-century warming roughly between 2.6 C and just below 3 C, so fupit maps the reference case to the closest fully grounded SSP pathway. It is a versioned reference, not a prediction or hidden scenario average.";

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
  scenario?: string;
  temperature: {
    annual_mean: number;
    monthly: number[];
    anomaly: number;
    min: number;
    max: number;
    model_consensus?: { annual_mean?: number; monthly?: number[]; anomaly?: number; source?: string; method?: string };
    ipcc_calibrated?: {
      annual_mean?: number;
      monthly?: number[];
      anomaly?: number;
      adjustment_c?: number;
      calibration_factor?: number;
      uncertainty?: { annual_mean_low?: number; annual_mean_high?: number; anomaly_spread?: number };
      method?: string;
    };
    uncertainty?: { annual_mean_low?: number; annual_mean_high?: number; anomaly_spread?: number; method?: string };
  };
  precipitation: {
    annual_total: number;
    monthly: number[];
    anomaly_percent: number;
    uncertainty?: { annual_total_low?: number; annual_total_high?: number; anomaly_percent_spread?: number; method?: string };
  };
  extremes: {
    heat_stress_days: number;
    drought_risk: number;
    flood_risk: number;
    sea_level_rise_cm?: number;
    sea_level_applicable?: boolean;
    detail?: {
      tropical_nights_per_year?: number;
      consecutive_dry_days?: number;
      max_5day_precip_mm?: number;
      humid_heat?: {
        max_monthly_mean_wet_bulb_c?: number;
        max_month?: string;
        monthly_mean_wet_bulb_c?: number[];
        monthly_relative_humidity_percent?: number[];
        relative_humidity_anomaly_percent_points?: number;
        relative_humidity_spread_percent_points?: number;
        relative_humidity_baseline_source?: string;
        domain_clipped_months?: number;
        temperature_domain_warning_months?: number;
        source_id?: string;
        method?: string;
        caveat?: string;
      };
      uncertainty?: {
        tropical_nights_spread_days?: number;
        consecutive_dry_days_spread?: number;
        max_5day_precip_spread_mm?: number;
        sea_level_low_cm?: number;
        sea_level_high_cm?: number;
        method?: string;
      };
      thresholds?: {
        tropical_night_C?: number;
        drought_max_cdd?: number;
        flood_max_rx5_mm?: number;
      };
    };
  };
  habitability: { score: number; category?: string; breakdown?: Record<string, number> };
  atmospheric_physics?: { circulation_pattern?: string; climate_sensitivity?: number; feedback_mechanisms?: string[] };
  location?: { climate_zone?: string; latitude?: number; longitude?: number };
  metadata?: {
    confidence?: string;
    resolution?: string;
    model?: string;
    model_version?: string;
    scenario?: string;
    baseline?: string;
    baseline_source?: {
      temperature?: string;
      precipitation?: string;
      humidity?: string;
      observed_period?: string;
      observed_resolution?: string;
      observed_citation?: string;
      observed_temperature_months?: number;
      observed_precipitation_months?: number;
      observed_annual_temperature_c?: number;
      observed_annual_precipitation_mm?: number;
      delta_reference_period?: string;
    };
    projection_year_basis?: {
      requested_year?: number;
      source_year_low?: number;
      source_year_high?: number;
      effective_source_year?: number;
      mode?: string;
      cadence?: string;
      note?: string;
    };
    projection_method?: string;
    uncertainty?: {
      temperature_anomaly_spread_c?: number;
      temperature_ipcc_calibrated_anomaly_c?: number;
      temperature_ipcc_adjustment_c?: number;
      temperature_ipcc_calibration_factor?: number;
      precipitation_anomaly_spread_pct?: number;
      relative_humidity_anomaly_spread_percent_points?: number;
      sea_level_low_cm?: number;
      sea_level_high_cm?: number;
    };
    source_trail?: Array<{ label: string; source: string; method: string; citation: string }>;
  };
}

interface AnalogCandidate {
  name: string;
  country: string;
  lat: number;
  lng: number;
  year: number;
  scenario: ScenarioId;
  temperature: { annual_mean: number; monthly: number[] };
  precipitation: { annual_total: number; monthly: number[] };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number };
  metadata?: { baseline_source?: NonNullable<ProjectionPoint["metadata"]>["baseline_source"] };
}

interface AnalogCatalog {
  version: string;
  catalogYear: number;
  scenario: ScenarioId;
  candidateCount: number;
  method: string;
  source: string;
  candidates: AnalogCandidate[];
}

type CoastCoord = [number, number];

interface CoastalProximityArtifact {
  catalog: "natural_earth_coastline_110m";
  label: string;
  version: string;
  sourceId: "natural-earth-coastline-110m-v5";
  coastalThresholdKm: number;
  nearCoastalThresholdKm: number;
  regionalThresholdKm: number;
  method: string;
  caveats: string[];
  lines: CoastCoord[][];
}

interface CoastalRelevance {
  status: "loading" | "unavailable" | "coastal" | "near_coastal" | "regional" | "inland";
  label: string;
  shortLabel: string;
  summary: string;
  receipt: string;
  thresholdLabel: string;
  isLocallyRelevant: boolean;
  distanceKm?: number;
}

interface ClimateAnalogMatch {
  candidate: AnalogCandidate;
  distance: number;
  comparedCount: number;
  annualTempDelta: number;
  annualPrecipDelta: number;
  heatDaysDelta: number;
  droughtDelta: number;
  floodDelta: number;
}

interface ScenarioContrastRow {
  id: ScenarioId;
  label: string;
  role: string;
  caption: string;
  tempChange: number;
  ipccDelta: number;
  heatDays: number;
  precipChange: number;
  score: number;
  category: string;
}

const SCENARIO_LINE_COLORS: Record<ScenarioId, string> = {
  ssp126: GREEN,
  ssp245: BLUE,
  ssp370: ORANGE,
  ssp585: PURPLE,
};

interface RoadmapItem {
  year: number;
  tempChange: number;
  heatDays: number;
  coldMonths: number;
  precipChange: number;
  drought: number;
  flood: number;
  seaLevel: number;
  score: number;
  category: string;
  driver: { label: string; text: string; color: string };
  scenarioDelta?: string;
}

interface ShareStory {
  headline: string;
  metricLine: string;
  driverLine: string;
  analogLine: string;
  caveat: string;
  text: string;
  clipboardText: string;
}

type LearningPromptAction = "pathways" | "twin" | "comparison";

interface LearningPrompt {
  eyebrow: string;
  question: string;
  detail: string;
  action: LearningPromptAction;
  actionLabel: string;
  receipt: string;
  disabled?: boolean;
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

function interpOptionalScalar(points: ProjectionPoint[], year: number, get: (p: ProjectionPoint) => number | undefined): number | undefined {
  if (points.length === 0) return undefined;
  const first = points[0];
  const firstValue = get(first);
  if (year <= first.year) return firstValue;

  const last = points[points.length - 1];
  const lastValue = get(last);
  if (year >= last.year) return lastValue;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (year >= a.year && year <= b.year) {
      const av = get(a);
      const bv = get(b);
      if (year === a.year) return av;
      if (year === b.year) return bv;
      if (av == null || bv == null) return undefined;
      const t = (year - a.year) / (b.year - a.year || 1);
      return lerp(av, bv, t);
    }
  }

  return undefined;
}

function riskScore(value: number): number {
  return Math.max(0, Math.min(100, value));
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

function signedNumber(value: number, decimals = 1) {
  const rounded = value.toFixed(decimals);
  return value >= 0 ? `+${rounded}` : rounded;
}

function roundedValue(value: number | undefined | null, unit: string, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return "not exposed";
  return `${decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()}${unit}`;
}

function normalizeLngDelta(candidateLng: number, originLng: number): number {
  let delta = candidateLng - originLng;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function distancePointToSegmentKm(lat: number, lng: number, a: CoastCoord, b: CoastCoord): number {
  const kmPerLat = 111.32;
  const kmPerLng = Math.max(0.001, 111.32 * Math.cos((lat * Math.PI) / 180));
  const ax = normalizeLngDelta(a[0], lng) * kmPerLng;
  const ay = (a[1] - lat) * kmPerLat;
  const bx = normalizeLngDelta(b[0], lng) * kmPerLng;
  const by = (b[1] - lat) * kmPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
  return Math.hypot(ax + dx * t, ay + dy * t);
}

function nearestCoastDistanceKm(lat: number, lng: number, artifact: CoastalProximityArtifact): number | undefined {
  let best = Infinity;
  for (const line of artifact.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const distance = distancePointToSegmentKm(lat, lng, line[i], line[i + 1]);
      if (distance < best) best = distance;
      if (best < 1) return best;
    }
  }
  return Number.isFinite(best) ? best : undefined;
}

function formatDistanceKm(distanceKm: number | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "not evaluated";
  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
}

function coastalRelevanceFor(location: LocationOption, artifact: CoastalProximityArtifact): CoastalRelevance {
  const distanceKm = nearestCoastDistanceKm(location.lat, location.lng, artifact);
  const distanceText = formatDistanceKm(distanceKm);
  const baseReceipt =
    `Coarse nearest-coast distance is ${distanceText} using Natural Earth 1:110m coastline (${artifact.sourceId}). This gates wording only: no elevation, tides, storm surge, subsidence, coastal defenses, rivers, drainage, or parcel exposure are modeled.`;

  if (distanceKm == null) {
    return {
      status: "unavailable",
      label: "Coastal relevance not evaluated",
      shortLabel: "not evaluated",
      summary: "Coastal relevance could not be evaluated, so sea-level rise stays regional context only.",
      receipt: baseReceipt,
      thresholdLabel: "50 cm regional context",
      isLocallyRelevant: false,
    };
  }

  if (distanceKm <= artifact.coastalThresholdKm) {
    return {
      status: "coastal",
      label: `Coastal relevance screen: within ${distanceText} of generalized coastline`,
      shortLabel: `${distanceText} from coast`,
      summary: `This location is within ${distanceText} of the generalized Natural Earth coastline, so regional sea-level rise is locally relevant enough to inspect, but it is still not a flood-exposure result.`,
      receipt: baseReceipt,
      thresholdLabel: "50 cm coastal context",
      isLocallyRelevant: true,
      distanceKm,
    };
  }

  if (distanceKm <= artifact.nearCoastalThresholdKm) {
    return {
      status: "near_coastal",
      label: `Near-coastal screen: ${distanceText} from generalized coastline`,
      shortLabel: `${distanceText} from coast`,
      summary: `This location is near the generalized coastline (${distanceText}), so sea-level rise is worth reading as a screening context, not as proof of exposure.`,
      receipt: baseReceipt,
      thresholdLabel: "50 cm near-coastal context",
      isLocallyRelevant: false,
      distanceKm,
    };
  }

  if (distanceKm <= artifact.regionalThresholdKm) {
    return {
      status: "regional",
      label: `Regional coastal context: ${distanceText} from generalized coastline`,
      shortLabel: `${distanceText} from coast`,
      summary: `This location is ${distanceText} from the generalized coastline, so sea-level rise is shown as broad regional context rather than local exposure.`,
      receipt: baseReceipt,
      thresholdLabel: "50 cm regional context",
      isLocallyRelevant: false,
      distanceKm,
    };
  }

  return {
    status: "inland",
    label: `Inland screen: ${distanceText} from generalized coastline`,
    shortLabel: `${distanceText} inland`,
    summary: `This location is far inland by the coarse Natural Earth screen (${distanceText}), so sea-level rise should be treated as regional background context, not a local risk signal.`,
    receipt: baseReceipt,
    thresholdLabel: "50 cm regional context",
    isLocallyRelevant: false,
    distanceKm,
  };
}

function climateVector(monthlyTemps: number[], monthlyPrecip: number[]): number[] | null {
  if (monthlyTemps.length !== 12 || monthlyPrecip.length !== 12) return null;
  const vals = [
    ...monthlyTemps,
    ...monthlyPrecip.map((v) => Math.log1p(Math.max(0, v))),
  ];
  return vals.every(Number.isFinite) ? vals : null;
}

function candidateClimateVector(candidate: AnalogCandidate): number[] | null {
  return climateVector(candidate.temperature.monthly, candidate.precipitation.monthly);
}

function sameCatalogPlace(candidate: AnalogCandidate, location: LocationOption): boolean {
  return Math.abs(candidate.lat - location.lat) < 0.15 && Math.abs(candidate.lng - location.lng) < 0.15;
}

function findClimateAnalog(
  catalog: AnalogCatalog,
  location: LocationOption,
  year: number,
  snapshot: {
    monthlyTemps: number[];
    monthlyPrecip: number[];
    avgTemp: number;
    annualPrecip: number;
    heatDays: number;
    drought: number;
    flood: number;
  },
): ClimateAnalogMatch | null {
  const candidateRows = catalog.candidates
    .map((candidate) => ({ candidate, vector: candidateClimateVector(candidate) }))
    .filter((row): row is { candidate: AnalogCandidate; vector: number[] } => row.vector !== null);
  const target = climateVector(snapshot.monthlyTemps, snapshot.monthlyPrecip);
  if (!target || candidateRows.length === 0) return null;

  const dims = target.length;
  const means = Array.from({ length: dims }, (_, i) =>
    candidateRows.reduce((sum, row) => sum + row.vector[i], 0) / candidateRows.length,
  );
  const stds = means.map((mean, i) => {
    const variance = candidateRows.reduce((sum, row) => sum + (row.vector[i] - mean) ** 2, 0) / candidateRows.length;
    return Math.sqrt(variance) || 1;
  });

  const excludeSelf = year > catalog.catalogYear + 2;
  const scored = candidateRows
    .filter((row) => !(excludeSelf && sameCatalogPlace(row.candidate, location)))
    .map((row) => {
      const squared = row.vector.reduce((sum, v, i) => {
        const z = (target[i] - v) / stds[i];
        return sum + z * z;
      }, 0);
      return { candidate: row.candidate, distance: Math.sqrt(squared / dims) };
    })
    .sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  if (!best) return null;
  const c = best.candidate;
  return {
    candidate: c,
    distance: best.distance,
    comparedCount: scored.length,
    annualTempDelta: snapshot.avgTemp - c.temperature.annual_mean,
    annualPrecipDelta: snapshot.annualPrecip - c.precipitation.annual_total,
    heatDaysDelta: snapshot.heatDays - c.extremes.heat_stress_days,
    droughtDelta: snapshot.drought - c.extremes.drought_risk,
    floodDelta: snapshot.flood - c.extremes.flood_risk,
  };
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

function componentScoreEffect(key: string, delta: number): number {
  return key.toLowerCase().includes("penalty") ? -delta : delta;
}

function isDriverComponent(key: string): boolean {
  const normalized = key.toLowerCase();
  // base_score/final_score are aggregates; comfort_optimum_c is a setting, not a score driver.
  if (["base_score", "final_score", "comfort_optimum_c"].includes(normalized)) return false;
  return true;
}

function perDecade(current: number, baseline: number, currentYear: number, baselineYear = BASELINE_YEAR): number {
  const years = Math.max(1, currentYear - baselineYear);
  return ((current - baseline) / years) * 10;
}

function describeSignalLevel(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  if (score >= 15) return "emerging";
  return "low";
}

function heatLifeText(days: number, delta: number): string {
  if (days >= 120) {
    return `Heat stress is modeled for ${days} days per year, making cooling demand, outdoor work, sport, and sleep disruption persistent warm-season issues.`;
  }
  if (days >= 30) {
    return `Heat stress is modeled for ${days} days per year, so the change is likely felt as a recurring seasonal constraint on outdoor activity and cooling needs.`;
  }
  if (days > 0) {
    return `Heat stress remains occasional at ${days} days per year, but the direction matters: ${delta >= 0 ? "the modeled burden rises from baseline" : "the modeled burden eases from baseline"}.`;
  }
  return "Heat stress is not a prominent modeled signal here; precipitation, flood, drought, or cold-season effects may matter more locally.";
}

function countMonthlyFreezeContext(monthlyTemps: number[]): number {
  return monthlyTemps.filter((value) => Number.isFinite(value) && value <= FREEZING_MONTHLY_MEAN_C).length;
}

function coldSeasonLifeText(coldMonths: number, baselineColdMonths: number, coldestMonth: string, coldestMeanC: number): string {
  const coldest = `${coldestMonth} averages ${coldestMeanC.toFixed(1)}°C`;
  if (coldMonths >= 4) {
    return `${coldMonths} modeled months have monthly mean temperature at or below 0°C. That points to a long cold-season climate context; daily freeze-thaw, snow, road, crop, and heating impacts still need finer daily and local data.`;
  }
  if (coldMonths > 0) {
    const direction = coldMonths < baselineColdMonths
      ? `down from ${baselineColdMonths} baseline monthly-mean freeze months`
      : coldMonths > baselineColdMonths
        ? `up from ${baselineColdMonths} baseline monthly-mean freeze months`
        : "similar to the baseline monthly-mean freeze season";
    return `${coldMonths} modeled ${coldMonths === 1 ? "month has" : "months have"} monthly mean temperature at or below 0°C, ${direction}; ${coldest}. This is winter climate context, not a daily cold-stress count.`;
  }
  if (baselineColdMonths > 0) {
    return `No selected-year month has monthly mean temperature at or below 0°C, down from ${baselineColdMonths} baseline monthly-mean freeze months. ${coldest}, so cold snaps can still occur even though this monthly proxy has crossed above freezing.`;
  }
  if (coldestMeanC <= 5) {
    return `No modeled month averages at or below 0°C, but the coldest month remains cool (${coldest}). Daily frost, heating demand, pests, and freeze-thaw damage require daily or local datasets not included here.`;
  }
  return `The monthly-mean freeze proxy is not prominent here: ${coldest}, and no selected-year month averages at or below 0°C. Daily cold extremes are not modeled in this build.`;
}

function precipitationLifeText(percent: number): string {
  if (percent <= -15) {
    return "The annual precipitation signal is substantially drier, which can pressure freshwater reliability where storage, groundwater, snowpack, or demand are already limiting.";
  }
  if (percent < -5) {
    return "The annual precipitation signal trends drier; local freshwater risk still depends on seasonality, infrastructure, groundwater, and demand that this page does not fully model.";
  }
  if (percent >= 15) {
    return "The annual precipitation signal is substantially wetter; more water does not automatically mean more usable freshwater, and drainage or heavy-rain disruption can become more important.";
  }
  if (percent > 5) {
    return "The annual precipitation signal trends wetter; the practical effect depends on whether extra rain arrives in useful seasons or as disruptive heavy-rain events.";
  }
  return "The annual precipitation signal is weak at this horizon, so year-to-year variability and local water management may dominate lived experience.";
}

function circulationContextFor(lat?: number, lng?: number): { region: string } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const europeNorthAtlantic = lat >= 35 && lat <= 72 && lng >= -35 && lng <= 45;
  const arctic = lat >= 66;
  const westAfricanMonsoon = lat >= 0 && lat <= 25 && lng >= -20 && lng <= 25;
  if (arctic) return { region: "Arctic and North Atlantic" };
  if (europeNorthAtlantic) return { region: "Europe and the North Atlantic" };
  if (westAfricanMonsoon) return { region: "West African monsoon region" };
  return null;
}

function scenarioInfo(id?: string): { id: ScenarioId; label: string; caption: string } {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS.find((s) => s.id === DEFAULT_SCENARIO)!;
}

function scenarioRole(id: ScenarioId): string {
  if (id === "ssp126") return "Lower-warming comparison";
  if (id === "ssp245") return "Current-policy-adjacent reference";
  if (id === "ssp370") return "Higher-warming stress case";
  return "Very-high, lower-likelihood stress test";
}

function contrastSnapshot(points: ProjectionPoint[], year: number, scenarioId: ScenarioId): ScenarioContrastRow {
  const info = scenarioInfo(scenarioId);
  const score = Math.max(0, Math.min(100, Math.round(interpScalar(points, year, (p) => p.habitability.score))));
  return {
    id: scenarioId,
    label: info.label,
    role: scenarioRole(scenarioId),
    caption: info.caption,
    tempChange: interpScalar(points, year, (p) => p.temperature.anomaly),
    ipccDelta: interpScalar(points, year, (p) => p.temperature.ipcc_calibrated?.anomaly ?? p.temperature.anomaly),
    heatDays: Math.max(0, Math.round(interpScalar(points, year, (p) => p.extremes.heat_stress_days))),
    precipChange: interpScalar(points, year, (p) => p.precipitation.anomaly_percent),
    score,
    category: categoryFor(score),
  };
}

function roadmapDriver(current: Omit<RoadmapItem, "driver">, previous: Omit<RoadmapItem, "driver">): RoadmapItem["driver"] {
  const heatDelta = current.heatDays - previous.heatDays;
  const coldDelta = current.coldMonths - previous.coldMonths;
  const droughtDelta = current.drought - previous.drought;
  const floodDelta = current.flood - previous.flood;
  const precipDelta = current.precipChange - previous.precipChange;
  const scoreDelta = current.score - previous.score;
  const candidates = [
    {
      weight: Math.abs(heatDelta) / 7,
      label: "Heat",
      color: ORANGE,
      text: heatDelta >= 0
        ? `heat-stress days rise by ${Math.round(heatDelta)} since the previous roadmap point`
        : `heat-stress days ease by ${Math.abs(Math.round(heatDelta))} since the previous roadmap point`,
    },
    {
      weight: Math.abs(coldDelta),
      label: "Cold season",
      color: coldDelta > 0 ? BLUE : GREEN,
      text: coldDelta > 0
        ? `monthly-mean freeze-season proxy gains ${coldDelta} ${coldDelta === 1 ? "month" : "months"}`
        : `monthly-mean freeze-season proxy loses ${Math.abs(coldDelta)} ${Math.abs(coldDelta) === 1 ? "month" : "months"}`,
    },
    {
      weight: Math.abs(droughtDelta) / 10,
      label: "Drought",
      color: droughtDelta >= 0 ? RED : GREEN,
      text: droughtDelta >= 0
        ? `drought pressure rises by ${Math.round(droughtDelta)} points`
        : `drought pressure eases by ${Math.abs(Math.round(droughtDelta))} points`,
    },
    {
      weight: Math.abs(floodDelta) / 10,
      label: "Heavy rain",
      color: floodDelta >= 0 ? BLUE : GREEN,
      text: floodDelta >= 0
        ? `heavy-rain/flood pressure rises by ${Math.round(floodDelta)} points`
        : `heavy-rain/flood pressure eases by ${Math.abs(Math.round(floodDelta))} points`,
    },
    {
      weight: Math.abs(precipDelta) / 8,
      label: "Water",
      color: BLUE,
      text: `annual precipitation signal shifts ${signedNumber(precipDelta, 1)} percentage points`,
    },
    {
      weight: Math.abs(scoreDelta) / 4,
      label: "Score",
      color: scoreDelta < 0 ? RED : GREEN,
      text: scoreDelta < 0
        ? `habitability score falls by ${Math.abs(Math.round(scoreDelta))} points`
        : `habitability score rises by ${Math.round(scoreDelta)} points`,
    },
  ].sort((a, b) => b.weight - a.weight);
  const top = candidates[0];
  if (!top || top.weight < 0.15) {
    return { label: "Stable", color: MUTED, text: "no single modeled signal changes sharply in this interval" };
  }
  return { label: top.label, color: top.color, text: top.text };
}

function roadmapSnapshot(points: ProjectionPoint[], year: number, previous?: Omit<RoadmapItem, "driver">): RoadmapItem {
  const score = Math.max(0, Math.min(100, Math.round(interpScalar(points, year, (p) => p.habitability.score))));
  const monthlyTemps = Array.from({ length: 12 }, (_, month) => interpScalar(points, year, (p) => p.temperature.monthly?.[month] ?? p.temperature.annual_mean));
  const base = {
    year,
    tempChange: interpScalar(points, year, (p) => p.temperature.anomaly),
    heatDays: Math.max(0, Math.round(interpScalar(points, year, (p) => p.extremes.heat_stress_days))),
    coldMonths: countMonthlyFreezeContext(monthlyTemps),
    precipChange: interpScalar(points, year, (p) => p.precipitation.anomaly_percent),
    drought: Math.round(riskScore(interpScalar(points, year, (p) => p.extremes.drought_risk))),
    flood: Math.round(riskScore(interpScalar(points, year, (p) => p.extremes.flood_risk))),
    seaLevel: Math.max(0, Math.round(interpScalar(points, year, (p) => p.extremes.sea_level_rise_cm ?? 0))),
    seaLevelApplicable: points[0]?.extremes?.sea_level_applicable !== false,
    score,
    category: categoryFor(score),
  };
  return {
    ...base,
    driver: previous ? roadmapDriver(base, previous) : { label: "Baseline", color: ACCENT, text: "current roadmap start for this forecast" },
  };
}

function jsonFileSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "location";
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[,.!?;:]?$/, "")}...`;
  }
  return lines;
}

function svgTextLines(lines: string[], x: number, y: number, size: number, fill: string, weight = 700, lineHeight = Math.round(size * 1.22)): string {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeSvgText(line)}</text>`,
  ).join("");
}

function buildShareImageSvg(story: ShareStory, shareUrl: string): string {
  const headline = wrapText(story.headline, 38, 3);
  const metric = wrapText(story.metricLine, 76, 2);
  const driver = wrapText(story.driverLine, 62, 2);
  const twin = wrapText(story.analogLine, 62, 2);
  const caveat = wrapText(story.caveat, 92, 2);
  const urlLabel = shareUrl.replace(/^https?:\/\//, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.55" stop-color="#102033"/>
      <stop offset="1" stop-color="#162011"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#67e8f9"/>
      <stop offset="0.5" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1020" cy="82" r="170" fill="#67e8f9" opacity="0.08"/>
  <circle cx="1090" cy="510" r="230" fill="#f59e0b" opacity="0.08"/>
  <path d="M58 488 C190 418 326 474 454 404 S719 303 871 350 S1084 317 1142 256" fill="none" stroke="url(#line)" stroke-width="9" stroke-linecap="round" opacity="0.88"/>
  <path d="M58 536 C198 474 330 512 456 466 S740 397 866 429 S1069 408 1142 366" fill="none" stroke="#67e8f9" stroke-width="3" stroke-linecap="round" opacity="0.28"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="rgba(5,10,18,0.58)" stroke="rgba(255,255,255,0.15)"/>
  <text x="82" y="98" font-size="30" font-weight="900" fill="#67e8f9">fupit</text>
  <text x="166" y="98" font-size="18" font-weight="700" fill="rgba(255,255,255,0.68)">grounded climate projection</text>
  ${svgTextLines(headline, 82, 180, 48, "#ffffff", 900, 58)}
  ${svgTextLines(metric, 82, 356, 24, "rgba(255,255,255,0.82)", 700, 32)}
  <rect x="82" y="424" width="486" height="86" rx="18" fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.35)"/>
  <text x="108" y="456" font-size="15" font-weight="900" fill="#f59e0b">TOP LOCAL DRIVER</text>
  ${svgTextLines(driver, 108, 482, 18, "rgba(255,255,255,0.84)", 700, 24)}
  <rect x="608" y="424" width="486" height="86" rx="18" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.35)"/>
  <text x="634" y="456" font-size="15" font-weight="900" fill="#a855f7">CLIMATE TWIN</text>
  ${svgTextLines(twin, 634, 482, 18, "rgba(255,255,255,0.84)", 700, 24)}
  ${svgTextLines(caveat, 82, 554, 15, "rgba(255,255,255,0.58)", 600, 20)}
  <text x="1118" y="554" text-anchor="end" font-size="15" font-weight="800" fill="rgba(255,255,255,0.74)">${escapeSvgText(urlLabel)}</text>
</svg>`;
}

function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas_unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("png_blob_unavailable"));
      }, "image/png", 0.92);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("share_image_render_failed"));
    };
    image.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseScenario(id: string | null): ScenarioId {
  return (SCENARIOS.some((s) => s.id === id) ? id : DEFAULT_SCENARIO) as ScenarioId;
}

function forecastUrl(location: LocationOption, year: number, scenario: ScenarioId, autoRun = true): string {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("lat", location.lat.toFixed(4));
  url.searchParams.set("lng", location.lng.toFixed(4));
  url.searchParams.set("place", location.name);
  if (location.country) url.searchParams.set("country", location.country);
  url.searchParams.set("year", Math.round(year).toString());
  url.searchParams.set("scenario", scenario);
  if (autoRun) url.searchParams.set("run", "1");
  return url.toString();
}

function linkLocationFromParams(): { location: LocationOption; year?: number; scenario: ScenarioId; autoRun: boolean } | null {
  const params = new URLSearchParams(window.location.search);
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  // No coordinates in the URL → fresh visit. Leave the search box empty so the
  // placeholder can guide the user to type a place name. (Number(null) === 0,
  // which would otherwise fabricate a bogus "0.0000, 0.0000" location at sea.)
  if (latRaw === null || lngRaw === null || latRaw.trim() === "" || lngRaw.trim() === "") {
    return null;
  }
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const name = params.get("place") || params.get("location") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const year = Number(params.get("year"));
  return {
    location: {
      name,
      lat,
      lng,
      country: params.get("country") || "",
      city: name.split(",")[0] || name,
    },
    year: Number.isInteger(year) && year >= BASELINE_YEAR && year <= MAX_YEAR ? year : undefined,
    scenario: parseScenario(params.get("scenario")),
    autoRun: params.get("run") === "1",
  };
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

// First year at which an interpolated metric crosses a threshold.
function crossYear(points: ProjectionPoint[], threshold: number, dir: "above" | "below", get: (p: ProjectionPoint) => number): number | null {
  for (let y = BASELINE_YEAR; y <= MAX_YEAR; y++) {
    const v = interpScalar(points, y, get);
    if (dir === "above" ? v >= threshold : v <= threshold) return y;
  }
  return null;
}

function ReceiptDetails({ label = "source", text }: { label?: string; text: string }) {
  return (
    <details style={{ display: "inline-block", maxWidth: "100%" }}>
      <summary
        aria-label={`${label}: ${text}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 18,
          cursor: "pointer",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: MUTED,
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          padding: "2px 6px",
          userSelect: "none",
        }}
      >
        {label}
      </summary>
      <div
        role="note"
        style={{
          marginTop: 6,
          maxWidth: 340,
          padding: "8px 9px",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: "rgba(6,9,16,0.94)",
          color: "rgba(255,255,255,0.78)",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </details>
  );
}

function ChartValuesDetails({
  label,
  rows,
}: {
  label: string;
  rows: { year: number; value: string; range?: string }[];
}) {
  return (
    <details style={{ display: "inline-block", maxWidth: "100%" }}>
      <summary
        aria-label={`${label} annual values table`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 18,
          cursor: "pointer",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: MUTED,
          border: `1px solid ${BORDER}`,
          borderRadius: 999,
          padding: "2px 6px",
          userSelect: "none",
        }}
      >
        values
      </summary>
      <div
        role="note"
        style={{
          marginTop: 6,
          maxWidth: 300,
          maxHeight: 220,
          overflow: "auto",
          padding: "8px 9px",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: "rgba(6,9,16,0.94)",
          color: "rgba(255,255,255,0.78)",
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        <div style={{ marginBottom: 6, color: MUTED }}>
          Displayed yearly values are linearly interpolated between grounded API checkpoints.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Year</th>
              <th style={{ textAlign: "right", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Value</th>
              <th style={{ textAlign: "right", color: MUTED, fontWeight: 600, padding: "2px 0" }}>Range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}` }}>{row.year}</td>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, textAlign: "right", color: "white" }}>{row.value}</td>
                <td style={{ padding: "2px 0", borderTop: `1px solid ${BORDER}`, textAlign: "right", color: row.range ? "white" : MUTED }}>{row.range || "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── Charts ─────────────────────────────────────────────────────────────────
interface TrendZone { from: number; to: number; color: string }

function TrendChart({
  years, values, year, label, unit, color, decimals = 0, thresholdY, zones, fillOpacity = 0.1,
  lowValues, highValues, uncertaintyLabel, scenarioLabel, thresholdLabel,
}: {
  years: number[]; values: number[]; year: number; label: string; unit: string; color: string;
  decimals?: number; thresholdY?: number; zones?: TrendZone[]; fillOpacity?: number;
  lowValues?: number[]; highValues?: number[]; uncertaintyLabel?: string; scenarioLabel?: string; thresholdLabel?: string;
}) {
  const VW = 100, VH = 56, px = 1, py = 5, bH = 9;
  const cW = VW - px * 2, cH = VH - py - bH;
  const hasRange = lowValues?.length === values.length && highValues?.length === values.length &&
    lowValues.every(Number.isFinite) && highValues.every(Number.isFinite);
  const rangeLow = hasRange ? lowValues!.map((v, i) => Math.min(v, highValues![i])) : [];
  const rangeHigh = hasRange ? lowValues!.map((v, i) => Math.max(v, highValues![i])) : [];
  const annualYears = Array.from({ length: MAX_YEAR - BASELINE_YEAR + 1 }, (_, i) => BASELINE_YEAR + i);
  const annualValues = annualYears.map((yr) => interpArr(years, values, yr));
  const annualLow = hasRange ? annualYears.map((yr) => interpArr(years, rangeLow, yr)) : [];
  const annualHigh = hasRange ? annualYears.map((yr) => interpArr(years, rangeHigh, yr)) : [];
  const scaleValues = hasRange ? [...annualValues, ...annualLow, ...annualHigh] : annualValues;
  const mn = Math.min(...scaleValues), mx = Math.max(...scaleValues), rng = mx - mn || 1;
  const xOf = (yr: number) => px + ((yr - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * cW;
  const yOf = (v: number) => py + cH - ((v - mn) / rng) * cH;
  const fmt = (v: number) => (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString());
  const withUnit = (v: number) => `${fmt(v)}${unit}`;

  const curV = interpArr(years, values, year);
  const curLow = hasRange ? interpArr(years, rangeLow, year) : null;
  const curHigh = hasRange ? interpArr(years, rangeHigh, year) : null;
  const mrkX = xOf(year);
  const mrkY = yOf(curV);
  const pts = annualValues.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
  const areaD = `M${xOf(years[0]).toFixed(2)},${(py + cH).toFixed(2)}` +
    annualValues.map((v, i) => ` L${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join("") +
    ` L${xOf(years[years.length - 1]).toFixed(2)},${(py + cH).toFixed(2)}Z`;
  const rangeD = hasRange
    ? `M${annualHigh.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).join(" L")} ` +
      `L${annualLow.map((v, i) => `${xOf(annualYears[i]).toFixed(2)},${yOf(v).toFixed(2)}`).reverse().join(" L")}Z`
    : "";

  const callW = 26, callH = 11;
  const cxPos = mrkX + 2 + callW > VW - px ? mrkX - 2 - callW : mrkX + 2;
  const cyPos = Math.max(0, Math.min(VH - bH - callH, mrkY - callH / 2));
  const displayV = fmt(curV);
  const displayRange = hasRange && curLow !== null && curHigh !== null ? `${fmt(curLow)}-${fmt(curHigh)}${unit}` : null;
  const thresholdInRange = thresholdY !== undefined && thresholdY >= mn && thresholdY <= mx;
  const thresholdTextY = thresholdInRange ? Math.max(py + 4, Math.min(py + cH - 1, yOf(thresholdY!) - 1)) : 0;
  const sourceYears = new Set(years);
  const axisYears = Array.from(new Set([BASELINE_YEAR, CURRENT_FORECAST_YEAR, 2050, 2075, MAX_YEAR]))
    .filter((yr) => yr >= BASELINE_YEAR && yr <= MAX_YEAR);
  const pointLabel = (i: number) => {
    const yr = annualYears[i];
    const value = withUnit(annualValues[i]);
    const range = hasRange ? `, range ${withUnit(annualLow[i])} to ${withUnit(annualHigh[i])}` : "";
    const source = sourceYears.has(yr) ? "grounded API checkpoint" : "linear interpolation between grounded API checkpoints";
    return `${label} ${yr}: ${value}${range}. ${source}${scenarioLabel ? `, ${scenarioLabel}` : ""}.`;
  };
  const valueRows = annualYears.map((yr, i) => ({
    year: yr,
    value: withUnit(annualValues[i]),
    range: hasRange ? `${withUnit(annualLow[i])} to ${withUnit(annualHigh[i])}` : undefined,
  }));

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        role="img"
        aria-label={`${label} trend from ${BASELINE_YEAR} to ${MAX_YEAR}${scenarioLabel ? `, ${scenarioLabel}` : ""}. Displayed yearly points are linearly interpolated between grounded API checkpoints.${thresholdLabel ? ` Threshold marker: ${thresholdLabel}.` : ""}`}
        style={{ width: "100%", height: 80, display: "block" }}
      >
        <title>{`${label} trend. Hover plotted yearly points for values; open the values disclosure below for keyboard and touch access.`}</title>
        {zones?.map((z, zi) => {
          const clampedHi = Math.min(z.to, mx), clampedLo = Math.max(z.from, mn);
          if (clampedHi <= clampedLo) return null;
          return <rect key={zi} x={px} y={yOf(clampedHi)} width={cW} height={yOf(clampedLo) - yOf(clampedHi)} fill={z.color} opacity="0.14" />;
        })}
        {hasRange && <path d={rangeD} fill={color} opacity="0.18" />}
        <path d={areaD} fill={color} opacity={fillOpacity} />
        {[0.33, 0.67].map((f) => {
          const yy = py + f * cH;
          return <line key={f} x1={px} y1={yy} x2={px + cW} y2={yy} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
        })}
        {thresholdInRange && (
          <g>
            <title>{thresholdLabel ?? `Threshold marker at ${withUnit(thresholdY!)}`}</title>
            <line x1={px} y1={yOf(thresholdY!)} x2={px + cW} y2={yOf(thresholdY!)} stroke={RED} strokeWidth="0.7" strokeDasharray="2 1.5" opacity="0.6" />
            {thresholdLabel && (
              <text x={VW - px - 0.5} y={thresholdTextY} textAnchor="end" fill={RED} fontSize="4.5" fontWeight="700">
                {thresholdLabel}
              </text>
            )}
          </g>
        )}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={mrkX} y1={py} x2={mrkX} y2={py + cH} stroke={ACCENT} strokeWidth="0.9" strokeDasharray="2.5 2" opacity="0.85" />
        {hasRange && curLow !== null && curHigh !== null && (
          <line x1={mrkX} y1={yOf(curHigh)} x2={mrkX} y2={yOf(curLow)} stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.32" />
        )}
        {annualYears.map((yr, i) => (
          <circle
            key={yr}
            cx={xOf(yr)}
            cy={yOf(annualValues[i])}
            r={sourceYears.has(yr) ? "0.95" : "0.65"}
            fill={color}
            opacity={sourceYears.has(yr) ? "0.44" : "0.2"}
          >
            <title>{pointLabel(i)}</title>
          </circle>
        ))}
        <circle cx={mrkX} cy={mrkY} r="2.4" fill={color} stroke="white" strokeWidth="0.9" />
        <rect x={cxPos} y={cyPos} width={callW} height={callH} rx="2" fill="rgba(6,9,16,0.88)" stroke={color} strokeWidth="0.5" />
        <text x={cxPos + callW / 2} y={cyPos + callH - 2.5} textAnchor="middle" fill="white" fontSize="5.5" fontWeight="700">{displayV}{unit}</text>
        {axisYears.map((yr) => (
          <text key={yr} x={xOf(yr)} y={VH - 0.5} textAnchor="middle" fill={MUTED} fontSize="4.8">{yr}</text>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginTop: 2, padding: "0 1px" }}>
        <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
          {scenarioLabel && <span style={{ fontSize: 8, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 999, padding: "1px 5px" }}>{scenarioLabel}</span>}
          <ChartValuesDetails label={label} rows={valueRows} />
          {hasRange && uncertaintyLabel && <ReceiptDetails label="range" text={uncertaintyLabel} />}
          {thresholdLabel && <ReceiptDetails label="threshold" text={`Dashed marker: ${thresholdLabel}. It is a chart reference for the displayed metric, not a property-level or safety-critical decision boundary.`} />}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "monospace", textAlign: "right", flexShrink: 0 }}>
          {displayV}{unit}
          {displayRange && <span style={{ display: "block", fontSize: 8, color: MUTED, fontWeight: 600 }}>range {displayRange}</span>}
        </span>
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
  const xOf = (yr: number) => ((yr - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * W;
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ClimateApp() {
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [suggestions, setSuggestions] = useState<LocationOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [year, setYear] = useState(CURRENT_FORECAST_YEAR);
  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO);
  const [trajectory, setTrajectory] = useState<ProjectionPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareStoryCopied, setShareStoryCopied] = useState(false);
  const [shareImageBusy, setShareImageBusy] = useState(false);
  const [shareImageSaved, setShareImageSaved] = useState(false);
  const [rawJsonCopied, setRawJsonCopied] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [analogCatalog, setAnalogCatalog] = useState<AnalogCatalog | null>(null);
  const [analogError, setAnalogError] = useState<string | null>(null);
  const [coastalArtifact, setCoastalArtifact] = useState<CoastalProximityArtifact | null>(null);
  const [coastalArtifactError, setCoastalArtifactError] = useState<string | null>(null);
  const [scenarioContrast, setScenarioContrast] = useState<Partial<Record<ScenarioId, ProjectionPoint[]>> | null>(null);
  const [scenarioContrastLoading, setScenarioContrastLoading] = useState(false);
  const [scenarioContrastError, setScenarioContrastError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const deepLinkRunRef = useRef(false);

  useEffect(() => {
    document.title = "fupit — see where the climate is still livable";
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/climate-analog-catalog.current.json")
      .then((response) => {
        if (!response.ok) throw new Error("catalog_unavailable");
        return response.json();
      })
      .then((catalog: AnalogCatalog) => {
        if (!cancelled) setAnalogCatalog(catalog);
      })
      .catch(() => {
        if (!cancelled) setAnalogError("Climate twin catalog unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/coastal-proximity.natural-earth-110m.json")
      .then((response) => {
        if (!response.ok) throw new Error("coastal_proximity_unavailable");
        return response.json();
      })
      .then((artifact: CoastalProximityArtifact) => {
        if (cancelled) return;
        if (artifact.catalog !== "natural_earth_coastline_110m" || artifact.sourceId !== "natural-earth-coastline-110m-v5" || !Array.isArray(artifact.lines)) {
          throw new Error("coastal_proximity_invalid");
        }
        setCoastalArtifact(artifact);
      })
      .catch(() => {
        if (!cancelled) setCoastalArtifactError("Coastal proximity artifact unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const linked = linkLocationFromParams();
    if (!linked) return;
    setSelectedLocation(linked.location);
    setLocationText(linked.location.name);
    setShowSuggestions(false);
    if (linked.year) setYear(linked.year);
    setScenario(linked.scenario);
    deepLinkRunRef.current = linked.autoRun;
  }, []);

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

  // Auto-glide the year slider from the current forecast year to 2100.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const SPEED = (MAX_YEAR - CURRENT_FORECAST_YEAR) / 11000; // years per ms -> full sweep approx 11s
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100); // clamp big gaps (tab refocus)
      last = now;
      setYear((y) => Math.min(MAX_YEAR, y + dt * SPEED));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Stop playback once the timeline reaches the end.
  useEffect(() => {
    if (playing && year >= MAX_YEAR) setPlaying(false);
  }, [playing, year]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (year >= MAX_YEAR - 0.5) setYear(CURRENT_FORECAST_YEAR); // replay from the current forecast start
    setPlaying(true);
  };

  const setYearManual = (y: number) => { setPlaying(false); setYear(y); };

  const selectLocation = (opt: LocationOption) => {
    setSelectedLocation(opt);
    setLocationText(opt.name);
    setShowSuggestions(false);
  };

  const fetchTrajectory = async (targetLocation: LocationOption, scenarioOverride: ScenarioId): Promise<ProjectionPoint[]> => {
    const response = await fetch("/api/climate-trajectory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: { lat: targetLocation.lat, lng: targetLocation.lng }, years: CHECKPOINTS, scenario: scenarioOverride }),
    });
    if (!response.ok) {
      let detail = response.statusText;
      try { const e = await response.json(); detail = e.message || detail; } catch { /* ignore */ }
      throw new Error(detail);
    }
    const data = await response.json();
    if (data.success && data.data?.points?.length) {
      return [...data.data.points].sort((a: ProjectionPoint, b: ProjectionPoint) => a.year - b.year);
    }
    throw new Error("Invalid response from climate model.");
  };

  const generate = async (locationOverride?: LocationOption, scenarioOverride: ScenarioId = scenario) => {
    const targetLocation = locationOverride ?? selectedLocation;
    if (!targetLocation) { setError("Please select a location from the suggestions."); return; }
    setError(null);
    setIsLoading(true);
    setTrajectory(null);
    setScenarioContrast(null);
    setScenarioContrastError(null);
    try {
      setTrajectory(await fetchTrajectory(targetLocation, scenarioOverride));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenarioContrast = async () => {
    if (!selectedLocation || !trajectory || scenarioContrastLoading) return;
    setScenarioContrastLoading(true);
    setScenarioContrastError(null);
    try {
      const next: Partial<Record<ScenarioId, ProjectionPoint[]>> = { [scenario]: trajectory };
      for (const row of SCENARIOS) {
        if (!next[row.id]) next[row.id] = await fetchTrajectory(selectedLocation, row.id);
      }
      setScenarioContrast(next);
    } catch (err) {
      setScenarioContrastError(err instanceof Error ? err.message : "Scenario contrast could not be loaded.");
    } finally {
      setScenarioContrastLoading(false);
    }
  };

  const changeScenario = (next: ScenarioId) => {
    setScenario(next);
    setShareCopied(false);
    setPlaying(false);
    if (trajectory && selectedLocation) {
      void generate(selectedLocation, next);
    }
  };

  useEffect(() => {
    if (!selectedLocation || !deepLinkRunRef.current || isLoading || trajectory) return;
    deepLinkRunRef.current = false;
    void generate(selectedLocation, scenario);
  }, [selectedLocation, isLoading, trajectory, scenario]);

  const newSearch = () => {
    setPlaying(false);
    setTrajectory(null);
    setError(null);
    setShareCopied(false);
    setRawJsonCopied(false);
    setReportSaved(false);
    setScenarioContrast(null);
    setScenarioContrastError(null);
    window.history.replaceState(null, "", "/");
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
      pdf.save(`climate-projection-${name}-${Math.round(year)}-${scenario}.pdf`);
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
      tempLow: trajectory.map((p) => p.temperature.uncertainty?.annual_mean_low ?? p.temperature.annual_mean),
      tempHigh: trajectory.map((p) => p.temperature.uncertainty?.annual_mean_high ?? p.temperature.annual_mean),
      precip: trajectory.map((p) => p.precipitation.annual_total),
      precipLow: trajectory.map((p) => p.precipitation.uncertainty?.annual_total_low ?? p.precipitation.annual_total),
      precipHigh: trajectory.map((p) => p.precipitation.uncertainty?.annual_total_high ?? p.precipitation.annual_total),
      heat: trajectory.map((p) => p.extremes.heat_stress_days),
      score: trajectory.map((p) => p.habitability.score),
      sea: trajectory.map((p) => p.extremes.sea_level_rise_cm ?? 0),
      seaLow: trajectory.map((p) => p.extremes.detail?.uncertainty?.sea_level_low_cm ?? p.metadata?.uncertainty?.sea_level_low_cm ?? p.extremes.sea_level_rise_cm ?? 0),
      seaHigh: trajectory.map((p) => p.extremes.detail?.uncertainty?.sea_level_high_cm ?? p.metadata?.uncertainty?.sea_level_high_cm ?? p.extremes.sea_level_rise_cm ?? 0),
      drought: trajectory.map((p) => riskScore(p.extremes.drought_risk)),
      flood: trajectory.map((p) => riskScore(p.extremes.flood_risk)),
    };
  }, [trajectory]);

  // Snapshot at current slider year
  const d = useMemo(() => {
    if (!trajectory) return null;
    const pts = trajectory;
    const avgTemp = interpScalar(pts, year, (p) => p.temperature.annual_mean);
    const tempChange = interpScalar(pts, year, (p) => p.temperature.anomaly);
    const ipccTemp = interpScalar(pts, year, (p) => p.temperature.ipcc_calibrated?.annual_mean ?? p.temperature.annual_mean);
    const ipccDelta = interpScalar(pts, year, (p) => p.temperature.ipcc_calibrated?.anomaly ?? p.temperature.anomaly);
    const ipccAdjustment = interpScalar(pts, year, (p) => p.temperature.ipcc_calibrated?.adjustment_c ?? 0);
    const calibrationFactor = interpScalar(pts, year, (p) => p.temperature.ipcc_calibrated?.calibration_factor ?? 1);
    const annualPrecip = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.precipitation.annual_total)));
    const precipChange = interpScalar(pts, year, (p) => p.precipitation.anomaly_percent);
    const heatDays = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.heat_stress_days)));
    const baseHeatDays = Math.round(pts[0].extremes.heat_stress_days);
    const drought = Math.round(riskScore(interpScalar(pts, year, (p) => p.extremes.drought_risk)));
    const flood = Math.round(riskScore(interpScalar(pts, year, (p) => p.extremes.flood_risk)));
    const seaLevel = Math.max(0, Math.round(interpScalar(pts, year, (p) => p.extremes.sea_level_rise_cm ?? 0)));
    const seaLevelApplicable = pts[0]?.extremes?.sea_level_applicable !== false;
    const heatNightsRaw = interpOptionalScalar(pts, year, (p) => p.extremes.detail?.tropical_nights_per_year ?? p.extremes.heat_stress_days);
    const drySpellDays = interpOptionalScalar(pts, year, (p) => p.extremes.detail?.consecutive_dry_days);
    const maxFiveDayRain = interpOptionalScalar(pts, year, (p) => p.extremes.detail?.max_5day_precip_mm);
    const humidHeatWetBulb = interpOptionalScalar(pts, year, (p) => p.extremes.detail?.humid_heat?.max_monthly_mean_wet_bulb_c);
    const score = Math.max(0, Math.min(100, Math.round(interpScalar(pts, year, (p) => p.habitability.score))));
    const category = categoryFor(score);
    const monthlyTemps = Array.from({ length: 12 }, (_, m) => interpScalar(pts, year, (p) => p.temperature.monthly?.[m] ?? p.temperature.annual_mean));
    const baselineMonthlyTemps = Array.from({ length: 12 }, (_, m) => pts[0].temperature.monthly?.[m] ?? pts[0].temperature.annual_mean);
    const coldMonthCount = countMonthlyFreezeContext(monthlyTemps);
    const baselineColdMonthCount = countMonthlyFreezeContext(baselineMonthlyTemps);
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
    const humidHeat = np.extremes.detail?.humid_heat;
    const humidHeatMonthIndex = humidHeat?.max_month ? MONTHS.indexOf(humidHeat.max_month) : -1;
    const humidHeatRh = humidHeatMonthIndex >= 0 ? humidHeat?.monthly_relative_humidity_percent?.[humidHeatMonthIndex] : undefined;
    const sensitivity = np.atmospheric_physics?.climate_sensitivity;
    const sensLabel = sensitivity == null ? null : sensitivity >= 2.2 ? "High" : sensitivity >= 1.6 ? "Moderate" : "Low";
    const sensColor = sensLabel === "High" ? ORANGE : sensLabel === "Moderate" ? AMBER : GREEN;
    const feedbacks = np.atmospheric_physics?.feedback_mechanisms ?? [];

    return {
      avgTemp, tempChange, ipccTemp, ipccDelta, ipccAdjustment, calibrationFactor, annualPrecip, precipChange, heatDays, baseHeatDays, drought, flood, seaLevel, seaLevelApplicable,
      score, category, monthlyTemps, monthlyPrecip, minIdx, maxIdx, wetIdx, dryIdx, breakdown,
      coldMonthCount, baselineColdMonthCount,
      np, sensitivity, sensLabel, sensColor, feedbacks,
      circulation: np.atmospheric_physics?.circulation_pattern,
      climateZone: np.location?.climate_zone,
      confidence: np.metadata?.confidence ?? "medium-high",
      resolution: np.metadata?.resolution,
      model: np.metadata?.model ?? "CMIP6 / IPCC AR6",
      modelVersion: np.metadata?.model_version ?? "",
      scenario: np.metadata?.scenario ?? np.scenario,
      baseline: np.metadata?.baseline,
      baselineSource: np.metadata?.baseline_source,
      projectionYearBasis: np.metadata?.projection_year_basis,
      projectionMethod: np.metadata?.projection_method,
      tempSpread: np.temperature.uncertainty?.anomaly_spread,
      tempLow: np.temperature.uncertainty?.annual_mean_low,
      tempHigh: np.temperature.uncertainty?.annual_mean_high,
      precipSpreadPct: np.precipitation.uncertainty?.anomaly_percent_spread,
      precipLow: np.precipitation.uncertainty?.annual_total_low,
      precipHigh: np.precipitation.uncertainty?.annual_total_high,
      heatNightsRaw,
      drySpellDays,
      maxFiveDayRain,
      humidHeatWetBulb,
      humidHeatMonth: humidHeat?.max_month,
      humidHeatRh,
      humidHeatRhDelta: humidHeat?.relative_humidity_anomaly_percent_points,
      humidHeatRhSpread: humidHeat?.relative_humidity_spread_percent_points ?? np.metadata?.uncertainty?.relative_humidity_anomaly_spread_percent_points,
      humidHeatClippedMonths: humidHeat?.domain_clipped_months,
      humidHeatTempDomainWarningMonths: humidHeat?.temperature_domain_warning_months,
      humidHeatMethod: humidHeat?.method,
      humidHeatCaveat: humidHeat?.caveat,
      humidHeatSourceId: humidHeat?.source_id,
      heatNightsSpread: np.extremes.detail?.uncertainty?.tropical_nights_spread_days,
      drySpellSpread: np.extremes.detail?.uncertainty?.consecutive_dry_days_spread,
      maxFiveDayRainSpread: np.extremes.detail?.uncertainty?.max_5day_precip_spread_mm,
      tropicalNightThreshold: np.extremes.detail?.thresholds?.tropical_night_C,
      droughtMaxCdd: np.extremes.detail?.thresholds?.drought_max_cdd,
      floodMaxRx5: np.extremes.detail?.thresholds?.flood_max_rx5_mm,
      seaLow: np.extremes.detail?.uncertainty?.sea_level_low_cm ?? np.metadata?.uncertainty?.sea_level_low_cm,
      seaHigh: np.extremes.detail?.uncertainty?.sea_level_high_cm ?? np.metadata?.uncertainty?.sea_level_high_cm,
      sourceTrail: np.metadata?.source_trail ?? [],
    };
  }, [trajectory, year]);

  const displayYear = Math.round(year);

  const climateAnalog = useMemo(() => {
    if (!analogCatalog || !selectedLocation || !d) return null;
    return findClimateAnalog(analogCatalog, selectedLocation, displayYear, d);
  }, [analogCatalog, selectedLocation, d, displayYear]);

  const coastalRelevance = useMemo<CoastalRelevance | null>(() => {
    if (!selectedLocation) return null;
    if (coastalArtifact) return coastalRelevanceFor(selectedLocation, coastalArtifact);
    if (coastalArtifactError) {
      return {
        status: "unavailable",
        label: "Coastal relevance unavailable",
        shortLabel: "coast screen unavailable",
        summary: "Coastal relevance could not be evaluated, so sea-level rise stays regional context only.",
        receipt: "The Natural Earth 1:110m coastal proximity artifact did not load. No local coastal exposure inference is made.",
        thresholdLabel: "50 cm regional context",
        isLocallyRelevant: false,
      };
    }
    return {
      status: "loading",
      label: "Coastal relevance loading",
      shortLabel: "coast screen loading",
      summary: "Coastal relevance is still loading, so sea-level rise is temporarily shown as regional context only.",
      receipt: "Waiting for the Natural Earth 1:110m coastal proximity artifact. No local coastal exposure inference is made while it is unavailable.",
      thresholdLabel: "50 cm regional context",
      isLocallyRelevant: false,
    };
  }, [selectedLocation, coastalArtifact, coastalArtifactError]);

  const scenarioContrastRows = useMemo(() => {
    if (!scenarioContrast) return [];
    return SCENARIOS
      .map((row) => {
        const points = scenarioContrast[row.id];
        return points ? contrastSnapshot(points, displayYear, row.id) : null;
      })
      .filter((row): row is ScenarioContrastRow => row !== null);
  }, [scenarioContrast, displayYear]);

  const scenarioSmallMultipleMetrics = useMemo<ScenarioSmallMultipleMetric[]>(() => {
    if (!scenarioContrast) return [];
    const series = SCENARIOS
      .map((row) => {
        const points = scenarioContrast[row.id];
        if (!points?.length) return null;
        return {
          id: row.id,
          label: row.label,
          role: scenarioRole(row.id),
          color: SCENARIO_LINE_COLORS[row.id],
          years: points.map((point) => point.year),
          active: row.id === scenario,
          points,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const makeMetric = (
      id: string,
      label: string,
      unit: string,
      color: string,
      decimals: number,
      getValue: (point: ProjectionPoint) => number,
      receipt: string,
      thresholdY?: number,
      thresholdLabel?: string,
    ): ScenarioSmallMultipleMetric => ({
      id,
      label,
      unit,
      color,
      decimals,
      thresholdY,
      thresholdLabel,
      receipt,
      series: series.map((line) => ({
        id: line.id,
        label: line.label,
        role: line.role,
        color: line.color,
        years: line.years,
        values: line.points.map(getValue),
        active: line.active,
      })),
    });

    return [
      makeMetric("raw-warming", "Raw warming", "°C", RED, 1, (point) => point.temperature.anomaly, "Raw warming uses the same location trajectory from /api/climate-trajectory for each SSP; annual display values are interpolated between grounded checkpoints."),
      makeMetric("ipcc-assessed", "IPCC assessed warming", "°C", AMBER, 1, (point) => point.temperature.ipcc_calibrated?.anomaly ?? point.temperature.anomaly, "IPCC assessed warming uses temperature.ipcc_calibrated.anomaly when the grounded API exposes it, otherwise the raw CMIP6 anomaly is shown for that checkpoint."),
      makeMetric("heat-days", "Heat-stress days", "d", ORANGE, 0, (point) => Math.max(0, point.extremes.heat_stress_days), "Heat-stress days come from the grounded extremes layer returned by the trajectory endpoint for each scenario."),
      makeMetric("rainfall-change", "Rainfall change", "%", BLUE, 1, (point) => point.precipitation.anomaly_percent, "Rainfall change is annual precipitation anomaly percent from the same-coordinate trajectory; it is not a freshwater availability model."),
      makeMetric("drought-risk", "Drought risk", "%", AMBER, 0, (point) => riskScore(point.extremes.drought_risk), "Drought risk is the displayed normalized ETCCDI-derived risk score from the grounded trajectory response.", 50, "50% elevated risk"),
      makeMetric("flood-risk", "Flood risk", "%", BLUE, 0, (point) => riskScore(point.extremes.flood_risk), "Flood risk is the displayed normalized ETCCDI-derived heavy-rain risk score from the grounded trajectory response.", 50, "50% elevated risk"),
      makeMetric(
        "sea-level-context",
        "Sea-level relevance",
        "cm",
        CYAN,
        0,
        (point) => Math.max(0, point.extremes.sea_level_rise_cm ?? 0),
        `Sea-level context uses the regional AR6 sea-level value returned by the API. ${coastalRelevance?.receipt ?? "Coastal relevance is not evaluated, so no local exposure inference is made."}`,
        50,
        coastalRelevance?.thresholdLabel ?? "50 cm regional context",
      ),
      makeMetric("habitability", "Habitability score", "", GREEN, 0, (point) => Math.max(0, Math.min(100, point.habitability.score)), "Habitability is the app's registered composite score for the same scenario trajectory; use component receipts and the methodology page to inspect inputs."),
    ];
  }, [scenarioContrast, scenario, coastalRelevance]);

  const scenarioContrastTakeaway = useMemo(() => {
    const low = scenarioContrastRows.find((row) => row.id === "ssp126");
    const high = scenarioContrastRows.find((row) => row.id === "ssp370");
    if (!low || !high) return null;
    const tempGap = high.tempChange - low.tempChange;
    const heatGap = high.heatDays - low.heatDays;
    const scoreGap = high.score - low.score;
    const scorePhrase = scoreGap < 0
      ? `${Math.abs(scoreGap)} points lower`
      : scoreGap > 0
        ? `${scoreGap} points higher`
        : "about the same";
    return {
      low,
      high,
      text: `By ${displayYear}, raw warming differs by ${signedNumber(tempGap, 1)}°C between ${low.label} and ${high.label} at this location, with ${signedNumber(heatGap, 0)} heat-stress days per year and habitability ${scorePhrase}.`,
    };
  }, [scenarioContrastRows, displayYear]);

  const roadmapItems = useMemo(() => {
    if (!trajectory) return [];
    let previous: RoadmapItem | undefined;
    return ROADMAP_YEARS.map((roadmapYear) => {
      const item = roadmapSnapshot(trajectory, roadmapYear, previous);
      previous = item;
      const lowPoints = scenarioContrast?.ssp126;
      const highPoints = scenarioContrast?.ssp370;
      if (!lowPoints || !highPoints) return item;
      const low = contrastSnapshot(lowPoints, roadmapYear, "ssp126");
      const high = contrastSnapshot(highPoints, roadmapYear, "ssp370");
      return {
        ...item,
        scenarioDelta: `SSP3-7.0 vs SSP1-2.6: ${signedNumber(high.tempChange - low.tempChange, 1)}°C raw warming, ${signedNumber(high.heatDays - low.heatDays, 0)} heat-stress days, ${signedNumber(high.score - low.score, 0)} score points.`,
      };
    });
  }, [trajectory, scenarioContrast]);

  const scoreStory = useMemo(() => {
    if (!trajectory || !d) return null;
    const baseline = trajectory[0];
    const baselineBreakdown = baseline.habitability.breakdown ?? {};
    const baselineScore = Math.round(baseline.habitability.score);
    const baselineHeat = Math.max(0, Math.round(baseline.extremes.heat_stress_days));
    const baselineDrought = Math.round(riskScore(baseline.extremes.drought_risk));
    const baselineFlood = Math.round(riskScore(baseline.extremes.flood_risk));
    const baselineSea = Math.max(0, Math.round(baseline.extremes.sea_level_rise_cm ?? 0));
    const scoreDrivers = d.breakdown
      .filter((item) => isDriverComponent(item.key))
      .map((item) => {
        const baselineValue = baselineBreakdown[item.key] ?? 0;
        const delta = item.val - baselineValue;
        const effect = componentScoreEffect(item.key, delta);
        return {
          ...item,
          baselineValue,
          delta,
          effect,
          movement: item.neg
            ? delta >= 0 ? "penalty increased" : "penalty eased"
            : delta >= 0 ? "contribution increased" : "contribution decreased",
        };
      })
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
      .filter((driver) => Math.abs(driver.effect) >= 0.05 || Math.abs(driver.delta) >= 0.05)
      .slice(0, 4);

    const tempPerDecade = perDecade(d.tempChange, baseline.temperature.anomaly, displayYear, baseline.year);
    const heatPerDecade = perDecade(d.heatDays, baselineHeat, displayYear, baseline.year);
    const precipPerDecade = perDecade(d.precipChange, baseline.precipitation.anomaly_percent, displayYear, baseline.year);
    const scorePerDecade = perDecade(d.score, baselineScore, displayYear, baseline.year);

    return {
      baselineYear: baseline.year,
      baselineScore,
      scoreDelta: d.score - baselineScore,
      scoreDrivers,
      trendRates: [
        { label: "Temperature", value: `${signedNumber(tempPerDecade, 2)}°C/decade`, color: RED },
        { label: "Heat stress", value: `${signedNumber(heatPerDecade, 1)} days/decade`, color: ORANGE },
        { label: "Rainfall", value: `${signedNumber(precipPerDecade, 1)}%/decade`, color: BLUE },
        { label: "Habitability", value: `${signedNumber(scorePerDecade, 1)} pts/decade`, color: scorePerDecade < 0 ? RED : GREEN },
      ],
      deltas: {
        heat: d.heatDays - baselineHeat,
        drought: d.drought - baselineDrought,
        flood: d.flood - baselineFlood,
        sea: d.seaLevel - baselineSea,
      },
    };
  }, [trajectory, d, displayYear]);

  const scoreSensitivityInputs = useMemo<ScoreSensitivityInput[]>(() => {
    if (!d) return [];
    const byKey = new Map(d.breakdown.map((item) => [item.key, item]));
    const makeInput = (
      key: string,
      label: string,
      kind: ScoreSensitivityInput["kind"],
      description: string,
    ): ScoreSensitivityInput | null => {
      const item = byKey.get(key);
      if (!item || !Number.isFinite(item.val)) return null;
      return { key, label, kind, value: Math.max(0, Math.abs(item.val)), description };
    };

    return [
      makeInput("temperature_comfort", "Temperature comfort", "contribution", "Weighted annual-temperature comfort contribution returned by the model."),
      makeInput("precipitation_adequacy", "Precipitation adequacy", "contribution", "Weighted annual-precipitation adequacy contribution returned by the model."),
      makeInput("heat_stress_penalty", "Heat-stress penalty", "penalty", "Penalty derived from the grounded tropical-night heat-stress layer."),
      makeInput("humid_heat_penalty", "Humid-heat penalty", "penalty", "Penalty from the grounded wet-bulb humid-heat screen (Stull 2011); humid heat is the strongest survivability limit."),
      makeInput("drought_penalty", "Drought penalty", "penalty", "Penalty derived from the grounded consecutive-dry-days risk score."),
      makeInput("flood_penalty", "Flood penalty", "penalty", "Penalty derived from the grounded heavy-rain flood-risk score."),
    ].filter((item): item is ScoreSensitivityInput => item !== null);
  }, [d]);

  const dailyLifeSignals = useMemo(() => {
    if (!d || !scoreStory) return [];
    const signals = [
      {
        label: "Heat, sleep, and cooling",
        value: `${d.heatDays}/yr`,
        color: ORANGE,
        text: heatLifeText(d.heatDays, scoreStory.deltas.heat),
        receipt: "Uses the grounded heat_stress_days trajectory; it is not personal medical or occupational-safety advice.",
      },
      {
        label: "Humid heat feel",
        value: d.humidHeatWetBulb == null ? "not exposed" : `${d.humidHeatWetBulb.toFixed(1)}°C Tw`,
        color: d.humidHeatWetBulb != null && d.humidHeatWetBulb >= 24 ? RED : ORANGE,
        text: d.humidHeatWetBulb == null
          ? "This build did not expose a humid-heat screen for the selected year."
          : `The warmest humid month is ${d.humidHeatMonth ?? "not identified"} with a monthly mean wet-bulb screen of ${d.humidHeatWetBulb.toFixed(1)}°C. Higher wet-bulb values mean sweat evaporation works less well; daily peaks can be higher than this monthly mean.`,
        receipt: `Uses ${d.humidHeatSourceId ?? "the registered humid-heat method"}: ${d.humidHeatMethod ?? "monthly mean temperature plus CMIP6 relative humidity through the Stull wet-bulb approximation."} ${d.humidHeatCaveat ?? "It is not WBGT, a daily exceedance count, or medical/occupational-safety advice."}`,
      },
      {
        label: "Cold-season context",
        value: `${d.coldMonthCount} mo`,
        color: d.coldMonthCount >= 3 ? BLUE : d.coldMonthCount > 0 ? CYAN : GREEN,
        text: coldSeasonLifeText(d.coldMonthCount, d.baselineColdMonthCount, MONTHS[d.minIdx], d.monthlyTemps[d.minIdx]),
        receipt: `Uses the selected-year monthly mean temperature trajectory for ${scenarioInfo(d.scenario ?? scenario).label}. It counts months at or below ${FREEZING_MONTHLY_MEAN_C}°C as cold-season context, not daily freeze days, freeze-thaw events, heating demand, road conditions, crop damage, pests, or personal health risk.`,
      },
      {
        label: "Water reliability",
        value: `${signedNumber(d.precipChange, 1)}%`,
        color: BLUE,
        text: precipitationLifeText(d.precipChange),
        receipt: "Uses annual and monthly precipitation projections. Groundwater, storage, demand, and snowpack are not fully modeled here.",
      },
      {
        label: "Drought and flood pressure",
        value: `${describeSignalLevel(Math.max(d.drought, d.flood))}`,
        color: Math.max(d.drought, d.flood) >= 70 ? RED : Math.max(d.drought, d.flood) >= 40 ? AMBER : GREEN,
        text: `The drought index is ${d.drought}/100 and the flood/heavy-rain index is ${d.flood}/100. Treat these as screening indicators for planning questions, not site-level engineering conclusions.`,
        receipt: "Uses CMIP6-derived dry-spell and heavy-precipitation risk layers; local drainage, rivers, soils, and defenses are outside the current score.",
      },
      {
        label: "Sea-level relevance, infrastructure, and ecosystems",
        value: d.seaLevelApplicable ? `${d.seaLevel} cm · ${coastalRelevance?.shortLabel ?? "regional context"}` : "N/A · inland location",
        color: CYAN,
        text: d.seaLevelApplicable
          ? `${coastalRelevance?.summary ?? "Coastal relevance is not evaluated, so sea-level rise stays regional context only."} Regional AR6 sea-level rise is ${d.seaLevel} cm at this horizon. Local exposure still depends on elevation, tides, subsidence, defenses, rivers, drainage, and storm surge. Climate-zone movement can pressure biodiversity, pests, and ecosystem services, but species-specific outcomes are not modeled yet.`
          : "This location is inland (no ocean within ~75 km), so regional sea-level rise does not apply and is shown as N/A rather than a misleading number. Climate-zone movement can still pressure biodiversity, pests, and ecosystem services, but species-specific outcomes are not modeled yet.",
        receipt: d.seaLevelApplicable
          ? `Sea-level data comes through the registered AR6/NASA source trail. ${coastalRelevance?.receipt ?? "No Natural Earth coastal proximity receipt is available, so inland users should treat the number as regional context."} Biodiversity and infrastructure text is educational context, not a quantified impact model.`
          : "Sea-level rise is gated to coastal locations using a land/ocean mask; inland points return no value by design. Biodiversity and infrastructure text is educational context, not a quantified impact model.",
      },
    ];
    const circulation = circulationContextFor(selectedLocation?.lat, selectedLocation?.lng);
    if (circulation) {
      signals.push({
        label: "AMOC/Gulf Stream context",
        value: "regional tail risk",
        color: PURPLE,
        text: `For the ${circulation.region}, IPCC AR6 assesses that the Atlantic Meridional Overturning Circulation is very likely to weaken during this century. The app does not turn that into a local cooling or warming correction, because this build has no cited local AMOC impact layer.`,
        receipt: "Uses the registered IPCC AR6 circulation context source. This row is broad regional context only: weakening is expected, abrupt collapse before 2100 is not the central IPCC assessment, and no deterministic local correction or collapse date is applied.",
      });
    }
    return signals;
  }, [d, scoreStory, scenario, selectedLocation?.lat, selectedLocation?.lng, coastalRelevance]);

  // Tipping points computed from real interpolated trajectory
  const tipping = useMemo(() => {
    if (!trajectory) return [];
    const items = [
      { icon: "🌡️", label: "Heat stress exceeds 15 days/yr", year: crossYear(trajectory, 15, "above", (p) => p.extremes.heat_stress_days) },
      { icon: "⚠️", label: "Habitability drops below 70 (Fair territory)", year: crossYear(trajectory, 70, "below", (p) => p.habitability.score) },
      { icon: "🌊", label: `${coastalRelevance?.isLocallyRelevant ? "Coastal" : "Regional"} sea-level context exceeds 50 cm`, year: crossYear(trajectory, 50, "above", (p) => p.extremes.sea_level_rise_cm ?? 0) },
      { icon: "💧", label: "Drought risk exceeds 50%", year: crossYear(trajectory, 50, "above", (p) => riskScore(p.extremes.drought_risk)) },
    ];
    return items.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
  }, [trajectory, coastalRelevance]);

  const selectedScenario = scenarioInfo(scenario);
  const shownScenario = scenarioInfo(d?.scenario ?? scenario);
  const shareUrl = useMemo(() => selectedLocation ? forecastUrl(selectedLocation, displayYear, scenario, true) : "", [selectedLocation, displayYear, scenario]);
  const shareStory = useMemo(() => {
    if (!selectedLocation || !d || !scoreStory || !shareUrl) return null;
    const shortPlace = selectedLocation.city || selectedLocation.name.split(",")[0] || selectedLocation.name;
    const topDriver = scoreStory.scoreDrivers[0];
    const headline = climateAnalog
      ? `${shortPlace} in ${displayYear} looks most like ${climateAnalog.candidate.name}, ${climateAnalog.candidate.country} today`
      : `${shortPlace} in ${displayYear}: grounded fupit climate story`;
    const metricLine = `${shownScenario.label}: raw warming ${signedNumber(d.tempChange, 1)}°C from ${BASELINE_YEAR}, ${d.heatDays} heat-stress days/yr, habitability ${d.score}/100 (${d.category}).`;
    const driverLine = topDriver
      ? `Top visible score driver: ${topDriver.label} ${topDriver.movement}, ${signedNumber(topDriver.effect, 1)} score points.`
      : "Top visible score driver: no single score component moved enough to dominate this horizon.";
    const analogLine = climateAnalog
      ? `Current-day climate twin: ${climateAnalog.candidate.name}, ${climateAnalog.candidate.country}; distance ${climateAnalog.distance.toFixed(2)} standardized climate units across ${climateAnalog.comparedCount} bounded-catalog cities.`
      : `Current-day climate twin: bounded climate-twin catalog ${analogCatalog ? `${analogCatalog.candidateCount} cities loaded; match still resolving` : "loading"}.`;
    const caveat = "Educational projection only. The share text uses already visible grounded fields and the bounded climate-twin catalog, with no unregistered enrichments and no safe-city claim.";
    const text = [metricLine, driverLine, analogLine, caveat].join("\n");
    return {
      headline,
      metricLine,
      driverLine,
      analogLine,
      caveat,
      text,
      clipboardText: `${headline}\n${text}\n${shareUrl}`,
    };
  }, [selectedLocation, d, scoreStory, shareUrl, climateAnalog, analogCatalog, shownScenario.label, displayYear]);

  const learningPrompts = useMemo<LearningPrompt[]>(() => {
    if (!selectedLocation || !d || !scoreStory) return [];
    const shortPlace = selectedLocation.city || selectedLocation.name.split(",")[0] || selectedLocation.name;
    const topDriver = scoreStory.scoreDrivers[0];
    return [
      {
        eyebrow: "Pathway question",
        question: `How different is ${shortPlace} under lower vs higher warming by ${displayYear}?`,
        detail: scenarioContrastTakeaway
          ? scenarioContrastTakeaway.text
          : `Load the SSP pathways to compare ${shortPlace}'s local warming, heat-stress days, rainfall, and score in the same selected year.`,
        action: "pathways",
        actionLabel: scenarioContrastRows.length > 0 ? "Refresh pathways" : "Load pathways",
        receipt: "Uses the same coordinates and /api/climate-trajectory annual checkpoints across the supported SSP scenarios.",
      },
      {
        eyebrow: "Twin question",
        question: climateAnalog
          ? `Where does ${shortPlace}'s ${displayYear} climate stop resembling ${climateAnalog.candidate.name}?`
          : `Which current-day indexed city is closest to ${shortPlace}'s ${displayYear} climate?`,
        detail: climateAnalog
          ? `Start with the gaps: ${signedNumber(climateAnalog.annualTempDelta, 1)}°C average temperature, ${signedNumber(climateAnalog.annualPrecipDelta, 0)} mm rainfall, and ${signedNumber(climateAnalog.heatDaysDelta, 0)} heat-stress days versus the catalog city.`
          : `The bounded climate-twin catalog is ${analogCatalog ? "loaded; nearest match is still resolving" : "loading"}.`,
        action: "twin",
        actionLabel: climateAnalog ? "Open twin city" : "Twin loading",
        disabled: !climateAnalog,
        receipt: "Uses the bounded climate-twin catalog generated from the grounded grid engine; it is not a global analog search.",
      },
      {
        eyebrow: "Side-by-side question",
        question: `Would ${shortPlace}'s story look better or worse than another place you care about?`,
        detail: topDriver
          ? `Compare the trend driver "${topDriver.label}" against another location, then check whether heat, rainfall, or habitability is actually driving the difference.`
          : "Compare another location against this same year and scenario to see whether the main signal changes place by place.",
        action: "comparison",
        actionLabel: "Open comparison",
        receipt: "The comparison view uses the same grounded forecast endpoint and scenario selector; it is for learning, not ranking safe havens.",
      },
    ];
  }, [selectedLocation, d, scoreStory, displayYear, scenarioContrastTakeaway, scenarioContrastRows.length, climateAnalog, analogCatalog]);

  const openClimateTwinCity = () => {
    if (!climateAnalog) return;
    const c = climateAnalog.candidate;
    const loc: LocationOption = { name: `${c.name}, ${c.country}`, city: c.name, country: c.country, lat: c.lat, lng: c.lng };
    window.location.href = forecastUrl(loc, analogCatalog?.catalogYear ?? CURRENT_FORECAST_YEAR, analogCatalog?.scenario ?? DEFAULT_SCENARIO, true);
  };

  useEffect(() => {
    if (!trajectory || !selectedLocation) return;
    window.history.replaceState(null, "", forecastUrl(selectedLocation, displayYear, scenario, true));
  }, [trajectory, selectedLocation, displayYear, scenario]);

  const copyShareStory = async () => {
    if (!shareStory) return;
    await copyToClipboard(shareStory.clipboardText);
    setShareStoryCopied(true);
    window.setTimeout(() => setShareStoryCopied(false), 1800);
  };

  const downloadShareImage = async () => {
    if (!shareStory || !selectedLocation || !shareUrl) return;
    setShareImageBusy(true);
    const baseName = `fupit-share-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}`;
    const svg = buildShareImageSvg(shareStory, shareUrl);
    try {
      const png = await svgToPngBlob(svg);
      downloadBlob(png, `${baseName}.png`);
    } catch {
      downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${baseName}.svg`);
    } finally {
      setShareImageBusy(false);
      setShareImageSaved(true);
      window.setTimeout(() => setShareImageSaved(false), 1800);
    }
  };

  const shareForecast = async () => {
    if (!selectedLocation || !shareUrl) return;
    const title = shareStory?.headline ?? `${selectedLocation.name} climate forecast to ${displayYear}`;
    const text = shareStory?.text ?? (
      d
        ? `${selectedLocation.name} in ${displayYear} under ${shownScenario.label}: ${d.avgTemp.toFixed(1)}°C average, ${d.score}/100 habitability, grounded by fupit.`
        : `Explore ${selectedLocation.name}'s grounded climate forecast to 2100 on fupit.`
    );
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await copyToClipboard(shareStory?.clipboardText ?? shareUrl);
        if (shareStory) setShareStoryCopied(true);
        setShareCopied(true);
        if (shareStory) window.setTimeout(() => setShareStoryCopied(false), 1800);
        window.setTimeout(() => setShareCopied(false), 1800);
      }
    } catch {
      await copyToClipboard(shareStory?.clipboardText ?? shareUrl);
      if (shareStory) setShareStoryCopied(true);
      setShareCopied(true);
      if (shareStory) window.setTimeout(() => setShareStoryCopied(false), 1800);
      window.setTimeout(() => setShareCopied(false), 1800);
    }
  };

  const buildRawForecastJson = () => {
    if (!selectedLocation || !trajectory || !d) return "";
    return JSON.stringify({
      schema: "fupit.forecast.raw.v1",
      exported_at: new Date().toISOString(),
      location: {
        name: selectedLocation.name,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        country: selectedLocation.country,
      },
      selected_year: displayYear,
      scenario: shownScenario,
      share_url: shareUrl,
      model: {
        name: d.model,
        version: d.modelVersion,
        resolution: d.resolution,
        confidence: d.confidence,
      },
      selected_point: d.np,
      trajectory,
    }, null, 2);
  };

  const copyRawForecastJson = async () => {
    const rawJson = buildRawForecastJson();
    if (!rawJson) return;
    await copyToClipboard(rawJson);
    setRawJsonCopied(true);
    window.setTimeout(() => setRawJsonCopied(false), 1800);
  };

  const downloadRawForecastJson = () => {
    const rawJson = buildRawForecastJson();
    if (!rawJson || !selectedLocation) return;
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fupit-forecast-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildEducationalReportMarkdown = () => {
    if (!selectedLocation || !trajectory || !d || !scoreStory) return "";
    const reportScenario = shownScenario;
    const sourceLines = d.sourceTrail
      .map((entry) => `- ${entry.label}: ${entry.source}. Method: ${entry.method}. Citation: ${entry.citation}.`)
      .join("\n");
    const roadmapLines = roadmapItems
      .map((item) => {
        const delta = item.scenarioDelta ? ` ${item.scenarioDelta}` : "";
        return `- ${item.year}: ${signedNumber(item.tempChange, 1)} C raw warming, ${item.heatDays} heat-stress days/year, ${item.coldMonths} monthly-mean freeze months, precipitation ${signedNumber(item.precipChange, 1)}%, drought ${item.drought}/100, flood ${item.flood}/100, sea-level context ${item.seaLevel} cm, habitability ${item.score}/100 (${item.category}). Main signal: ${item.driver.text}.${delta}`;
      })
      .join("\n");
    const trendLines = scoreStory.trendRates.map((rate) => `- ${rate.label}: ${rate.value}`).join("\n");
    const driverLines = scoreStory.scoreDrivers.length
      ? scoreStory.scoreDrivers.map((driver) => `- ${driver.label}: ${driver.movement}; visible score effect ${signedNumber(driver.effect, 1)} points.`).join("\n")
      : "- No single score component moved enough to dominate this horizon.";
    const dailyLifeLines = dailyLifeSignals
      .map((signal) => `- ${signal.label} (${signal.value}): ${signal.text} Receipt: ${signal.receipt}`)
      .join("\n");
    const twinLine = climateAnalog
      ? `${climateAnalog.candidate.name}, ${climateAnalog.candidate.country}; distance ${climateAnalog.distance.toFixed(2)} standardized climate units across ${climateAnalog.comparedCount} bounded-catalog cities. Temperature gap ${signedNumber(climateAnalog.annualTempDelta, 1)} C, rainfall gap ${signedNumber(climateAnalog.annualPrecipDelta, 0)} mm, heat-stress gap ${signedNumber(climateAnalog.heatDaysDelta, 0)} days/year.`
      : "No climate twin is included in this export because the bounded analog catalog did not return a match.";
    const scenarioLine = scenarioContrastTakeaway
      ? scenarioContrastTakeaway.text
      : "Scenario contrast was not loaded when this report was exported.";

    return [
      "# fupit educational climate summary",
      "",
      `Exported: ${new Date().toISOString()}`,
      `Location: ${selectedLocation.name} (${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)})`,
      `Selected year: ${displayYear}`,
      `Scenario: ${reportScenario.label} (${reportScenario.id})`,
      `Default-policy note: ${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`,
      `Share URL: ${shareUrl}`,
      "",
      "## Selected-year snapshot",
      "",
      `- Raw CMIP6 model-consensus annual temperature: ${d.avgTemp.toFixed(1)} C; raw warming from ${BASELINE_YEAR}: ${signedNumber(d.tempChange, 1)} C.`,
      `- IPCC-assessed/calibrated annual temperature: ${d.ipccTemp.toFixed(1)} C; assessed anomaly ${signedNumber(d.ipccDelta, 1)} C; visible adjustment ${signedNumber(d.ipccAdjustment, 1)} C.`,
      `- Annual precipitation: ${d.annualPrecip} mm; change ${signedNumber(d.precipChange, 1)}%.`,
      `- Heat stress: ${d.heatDays} days/year.`,
      `- Cold-season context: ${d.coldMonthCount} monthly-mean freeze months; baseline ${d.baselineColdMonthCount}; coldest modeled month ${MONTHS[d.minIdx]} ${d.monthlyTemps[d.minIdx].toFixed(1)} C. This is not daily freeze days or a daily cold-stress count.`,
      `- Drought pressure: ${d.drought}/100; flood/heavy-rain pressure: ${d.flood}/100.`,
      `- Sea-level context: ${d.seaLevel} cm; range ${d.seaLow != null && d.seaHigh != null ? `${Math.round(d.seaLow)}-${Math.round(d.seaHigh)} cm` : "not exposed"}. Coastal relevance: ${coastalRelevance?.label ?? "not evaluated"}. ${coastalRelevance?.receipt ?? "No local coastal exposure inference is made."}`,
      `- Habitability presentation score: ${d.score}/100 (${d.category}); score movement from ${scoreStory.baselineYear}: ${signedNumber(scoreStory.scoreDelta, 0)} points.`,
      "",
      "## Trend rates",
      "",
      trendLines,
      "",
      "## Main score drivers",
      "",
      driverLines,
      "",
      "## Living-conditions interpretation",
      "",
      dailyLifeLines,
      "",
      "## Annual roadmap",
      "",
      roadmapLines,
      "",
      "## Scenario contrast",
      "",
      scenarioLine,
      "",
      "## Climate twin",
      "",
      twinLine,
      "",
      "## Sources and methods",
      "",
      sourceLines,
      "",
      "## What this does not mean",
      "",
      "This is educational and research context, not a property-risk certificate, safety forecast, relocation recommendation, insurance model, medical advice, engineering assessment, or guarantee that this exact point will be livable or unlivable. Local adaptation, governance, health systems, wealth, migration, conflict, infrastructure, elevation, and parcel-scale exposure are outside this score.",
      "",
      "Not yet included in the score: daily cold-stress days, crop yields, wildfire weather, biodiversity species ranges, local freshwater infrastructure, or parcel-level flood exposure.",
      "",
      "This Markdown report uses only fields already visible in the forecast page or projection receipt. It adds no unregistered enrichment layer and makes no safe-city or climate-haven claim.",
      "",
    ].join("\n");
  };

  const downloadEducationalReport = () => {
    const report = buildEducationalReportMarkdown();
    if (!report || !selectedLocation) return;
    downloadBlob(
      new Blob([report], { type: "text/markdown;charset=utf-8" }),
      `fupit-educational-summary-${jsonFileSlug(selectedLocation.city || selectedLocation.name)}-${displayYear}-${scenario}.md`,
    );
    setReportSaved(true);
    window.setTimeout(() => setReportSaved(false), 1800);
  };

  const sc = d ? scoreColor(d.score) : GREEN;
  const tPct = ((year - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR)) * 100;
  const maxBreakdown = d ? Math.max(...d.breakdown.map((b) => Math.abs(b.val)), 1) : 1;

  // ── Landing ────────────────────────────────────────────────────────────────
  if (!trajectory) {
    return (
      <div className="fupit-landing">
        <header style={{ background: "hsl(28,13%,9%)", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/favicon.svg" alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 7, display: "block" }} />
              <span style={{ fontWeight: 700, fontSize: 17 }}>fupit</span>
            </div>
            <button onClick={() => (window.location.href = "/comparison")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 13, cursor: "pointer" }}>
              <GitCompare style={{ width: 15, height: 15 }} />
              <span>Compare Locations</span>
            </button>
          </div>
        </header>

        <main className="fupit-landing-main">
          <div className="fupit-landing-content">
            <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD, fontSize: 11, color: ACCENT, marginBottom: 20, letterSpacing: "0.05em" }}>
              CMIP6 · IPCC AR6 · NASA Sea Level
            </div>
            <h1 className="fupit-landing-title">
              Everywhere's getting worse.<br />Just not equally.
            </h1>
            <p className="fupit-landing-copy" style={{ fontSize: 15, color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>
              Watch any place on Earth heat up, year by year from now to 2100 — and compare them side by side to find where stays livable long enough to matter. Where do you want to grow old? Where will your kids?
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
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "hsl(28,13%,13%)", border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden", zIndex: 20 }}>
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

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.035)" }}>
              <label htmlFor="scenario-select" style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Scenario</label>
              <select
                id="scenario-select"
                value={scenario}
                onChange={(e) => changeScenario(parseScenario(e.target.value))}
                disabled={isLoading}
                style={{ flex: "0 0 132px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "rgba(8,11,18,0.94)", color: "white", padding: "7px 9px", fontSize: 13, fontWeight: 700, outline: "none" }}
              >
                {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <span style={{ color: MUTED, fontSize: 12, lineHeight: 1.35 }}>
                {selectedScenario.caption}. The shared forecast URL keeps this scenario.
              </span>
              {scenario === DEFAULT_SCENARIO && (
                <ReceiptDetails label="why default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
              )}
            </div>

            <button
              onClick={() => generate()}
              disabled={isLoading}
              style={{
                marginTop: 16, width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
                cursor: isLoading ? "wait" : "pointer",
                background: "linear-gradient(135deg, hsl(192,91%,40%) 0%, hsl(215,91%,55%) 100%)",
                color: "white",
                opacity: isLoading ? 0.72 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {isLoading ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : null}
              {isLoading ? "Generating forecast" : "See climate forecast →"}
            </button>

            {isLoading && (
              <div style={{ marginTop: 18, fontSize: 13, color: MUTED }}>
                Sampling grounded CMIP6/IPCC grid — 5-year checkpoint {Math.min(loadingStep + 1, CHECKPOINTS.length)}/{CHECKPOINTS.length} ({CHECKPOINTS[loadingStep]})
                <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: ACCENT, borderRadius: 2, width: `${((loadingStep + 1) / CHECKPOINTS.length) * 100}%`, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Sampling {BASELINE_YEAR} as the comparison point, {CURRENT_FORECAST_YEAR} as the current start, then every 5 years to {MAX_YEAR}; packed scenario layers start at 2030.</div>
              </div>
            )}
            {error && <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: `${RED}14`, border: `1px solid ${RED}30`, color: "#fca5a5", fontSize: 13 }}>{error}</div>}
          </div>
        </main>
        <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
          <p style={{ color: MUTED, fontSize: 10 }}>
            © {new Date().getFullYear()}{" "}
            <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
              Mikko Parkkola
            </a>{" "}
            · fupit
          </p>
        </footer>
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
      <header style={{ background: "hsl(28,13%,9%)", borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/favicon.svg" alt="" width={28} height={28} style={{ width: 28, height: 28, borderRadius: 6, display: "block" }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>fupit</span>
            <div style={{ width: 1, height: 14, background: BORDER }} />
            <span style={{ fontSize: 13 }}>{selectedLocation?.name}</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{displayYear}</span>
            <span style={{ fontSize: 13, color: MUTED }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>{shownScenario.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={scenario}
              onChange={(e) => changeScenario(parseScenario(e.target.value))}
              disabled={isLoading}
              title="Climate scenario"
              aria-label="Climate scenario"
              style={{ height: 29, borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, fontWeight: 700, padding: "0 8px", cursor: isLoading ? "wait" : "pointer" }}
            >
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {scenario === DEFAULT_SCENARIO && (
              <ReceiptDetails label="default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
            )}
            <button onClick={newSearch} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: MUTED, fontSize: 12, cursor: "pointer" }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> New Search
            </button>
            <button onClick={() => (window.location.href = "/comparison")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: "pointer" }}>
              <GitCompare style={{ width: 13, height: 13 }} /> Compare
            </button>
            <button onClick={shareForecast} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${shareCopied ? GREEN : BORDER}`, background: shareCopied ? `${GREEN}18` : CARD, color: shareCopied ? GREEN : "white", fontSize: 12, cursor: "pointer" }}>
              {shareCopied ? <Check style={{ width: 13, height: 13 }} /> : <Share2 style={{ width: 13, height: 13 }} />} {shareCopied ? "Copied" : "Share"}
            </button>
            <button onClick={exportPDF} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, color: "white", fontSize: 12, cursor: exporting ? "wait" : "pointer" }}>
              {exporting ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 13, height: 13 }} />} Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Year Slider — sticky */}
      <div style={{ position: "sticky", top: 48, zIndex: 45, background: "hsl(28,13%,8.5%)", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={togglePlay} title={playing ? "Pause" : `Play ${CURRENT_FORECAST_YEAR} to ${MAX_YEAR}`} aria-label={playing ? "Pause timeline" : "Play timeline"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer", color: playing ? ACCENT : "white", border: `1px solid ${playing ? ACCENT : "rgba(255,255,255,0.18)"}`, background: playing ? `${ACCENT}22` : CARD, transition: "all 0.2s ease" }}>
              {playing ? <Pause style={{ width: 15, height: 15 }} /> : <Play style={{ width: 15, height: 15, marginLeft: 1 }} />}
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              {QUICK_YEAR_BUTTONS.map((y) => (
                <button key={y} onClick={() => setYearManual(y)}
                  style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${displayYear === y ? ACCENT : "rgba(255,255,255,0.12)"}`, background: displayYear === y ? `${ACCENT}18` : "transparent", color: displayYear === y ? ACCENT : MUTED, fontSize: 11, fontWeight: displayYear === y ? 700 : 400, cursor: "pointer" }}>
                  {y}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4, borderRadius: 2, pointerEvents: "none", background: `linear-gradient(to right, ${GREEN} 0%, ${AMBER} 40%, ${ORANGE} 65%, ${RED} 100%)`, opacity: 0.3 }} />
                <input type="range" min={BASELINE_YEAR} max={MAX_YEAR} step={0.1} value={year}
                  onChange={(e) => setYearManual(Number(e.target.value))}
                  style={{ width: "100%", cursor: "pointer", accentColor: ACCENT, position: "relative", zIndex: 1, margin: 0, display: "block" }} />
              </div>
              <div style={{ position: "relative", height: 16, marginTop: 1 }}>
                {YEAR_TICKS.map((y) => {
                  // Position each tick by its true year fraction so it lines up with the
                  // linear slider thumb. The +(0.5-frac)*THUMB term corrects for the native
                  // range thumb inset (its center travels ~half a thumb-width in from each edge).
                  const frac = (y - BASELINE_YEAR) / (MAX_YEAR - BASELINE_YEAR);
                  const THUMB = 16;
                  const major = y % 25 === 0;
                  return (
                    <div key={y} style={{ position: "absolute", top: 0, left: `calc(${frac * 100}% + ${(0.5 - frac) * THUMB}px)`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <div style={{ width: 1, height: major ? 6 : 3, background: major ? MUTED : "rgba(255,255,255,0.18)" }} />
                      {(y === CURRENT_FORECAST_YEAR || major) && <span style={{ fontSize: 8, color: MUTED, whiteSpace: "nowrap" }}>{y}</span>}
                    </div>
                  );
                })}
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
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 600, lineHeight: 1, marginBottom: 8, letterSpacing: "-0.015em" }}>{selectedLocation?.name}</h1>
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
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>Raw model consensus</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: RED }}>{shownScenario.label}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{shownScenario.caption}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 2 }}>+{d!.tempChange.toFixed(1)}°C</div>
              <div style={{ fontSize: 11, color: MUTED }}>vs baseline · IPCC assessed {d!.ipccDelta >= 0 ? "+" : ""}{d!.ipccDelta.toFixed(1)}°C</div>
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
            By <strong style={{ color: "white" }}>{displayYear}</strong>, {placeName}'s raw CMIP6 ensemble projection is{" "}
            <strong style={{ color: RED }}>+{d!.tempChange.toFixed(1)}°C warmer</strong> than its baseline; the IPCC-assessed calibrated anomaly is{" "}
            <strong style={{ color: AMBER }}>{d!.ipccDelta >= 0 ? "+" : ""}{d!.ipccDelta.toFixed(1)}°C</strong>. Heat-stress days{" "}
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

        {scoreStory && (
          <div style={{ marginBottom: 14 }}>
            <GuidedClimateExplainer
              placeName={placeName}
              year={displayYear}
              scenarioLabel={shownScenario.label}
              scenarioCaption={shownScenario.caption}
              tempChange={d!.tempChange}
              ipccDelta={d!.ipccDelta}
              heatDays={d!.heatDays}
              heatDelta={heatDelta}
              precipChange={d!.precipChange}
              score={d!.score}
              category={d!.category}
              topDriver={scoreStory.scoreDrivers[0] ? {
                label: scoreStory.scoreDrivers[0].label,
                movement: scoreStory.scoreDrivers[0].movement,
                effect: scoreStory.scoreDrivers[0].effect,
              } : undefined}
              dailyLifeSignals={dailyLifeSignals}
              roadmapItems={roadmapItems}
              climateTwin={climateAnalog ? {
                name: climateAnalog.candidate.name,
                country: climateAnalog.candidate.country,
                distance: climateAnalog.distance,
                comparedCount: climateAnalog.comparedCount,
                annualTempDelta: climateAnalog.annualTempDelta,
                annualPrecipDelta: climateAnalog.annualPrecipDelta,
                heatDaysDelta: climateAnalog.heatDaysDelta,
              } : null}
              scenarioContrastText={scenarioContrastTakeaway?.text ?? null}
              hasScenarioContrast={scenarioContrastRows.length > 0}
              sourceCount={d!.sourceTrail.length}
            />
          </div>
        )}

        {roadmapItems.length > 0 && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: "1 1 460px" }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Roadmap · current year to 2100</h2>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, margin: "6px 0 0" }}>
                  The slider gives a value for every year. This roadmap summarizes the current year and decade waypoints so the trend reads like a living-conditions timeline, not a single snapshot.
                </p>
              </div>
              <ReceiptDetails label="method" text="Roadmap values use the same /api/climate-trajectory points as the charts. The current build requests the current year plus 5-year checkpoints through 2100 and linearly interpolates intermediate years for display." />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {roadmapItems.map((item) => {
                const active = item.year === displayYear || (displayYear > item.year && displayYear < item.year + 10);
                return (
                  <div key={item.year} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap", padding: "9px 10px", borderRadius: 8, border: `1px solid ${active ? `${PURPLE}55` : BORDER}`, background: active ? `${PURPLE}10` : "rgba(255,255,255,0.032)" }}>
                    <div style={{ flex: "0 0 56px" }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: active ? PURPLE : "white" }}>{item.year}</div>
                      <div style={{ fontSize: 9, color: MUTED }}>{item.category}</div>
                    </div>
                    <div style={{ minWidth: 180, flex: "2 1 260px" }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                        <span style={{ color: item.driver.color, fontSize: 12, fontWeight: 850 }}>{item.driver.label}</span>
                        {item.scenarioDelta && <span style={{ color: BLUE, fontSize: 10, border: `1px solid ${BLUE}30`, borderRadius: 999, padding: "1px 6px" }}>scenario delta</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.76)", lineHeight: 1.45 }}>{item.driver.text}</div>
                      {item.scenarioDelta ? (
                        <div style={{ marginTop: 3, fontSize: 10.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.45 }}>{item.scenarioDelta}</div>
                      ) : (
                        <div style={{ marginTop: 3, fontSize: 10.5, color: MUTED }}>Load pathway contrast to add lower-vs-higher scenario deltas.</div>
                      )}
                    </div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Raw warming</div><div style={{ fontSize: 12.5, fontWeight: 800, color: RED }}>{signedNumber(item.tempChange, 1)}°C</div></div>
                    <div style={{ flex: "1 1 72px" }}><div style={{ fontSize: 9, color: MUTED }}>Heat days</div><div style={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>{item.heatDays}</div></div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Cold months</div><div style={{ fontSize: 12.5, fontWeight: 800, color: item.coldMonths > 0 ? CYAN : GREEN }}>{item.coldMonths}</div></div>
                    <div style={{ flex: "1 1 82px" }}><div style={{ fontSize: 9, color: MUTED }}>Water signal</div><div style={{ fontSize: 12.5, fontWeight: 800, color: BLUE }}>{signedNumber(item.precipChange, 1)}%</div></div>
                    <div style={{ flex: "1 1 90px" }}><div style={{ fontSize: 9, color: MUTED }}>Sea-level context</div><div style={{ fontSize: 12.5, fontWeight: 800, color: CYAN }}>{item.seaLevel} cm</div></div>
                    <div style={{ flex: "1 1 70px" }}><div style={{ fontSize: 9, color: MUTED }}>Score</div><div style={{ fontSize: 12.5, fontWeight: 800, color: scoreColor(item.score) }}>{item.score}/100</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 420px" }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Scenario contrast · same location</h2>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6, margin: "6px 0 0" }}>
                Compare lower-warming, current-policy-adjacent, and higher-warming pathways for {placeName} without changing the selected place. These are pathway references, not predictions.
              </p>
            </div>
            <button
              onClick={loadScenarioContrast}
              disabled={scenarioContrastLoading || isLoading}
              aria-describedby="scenario-contrast-receipt"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 7, border: `1px solid ${BLUE}55`, background: scenarioContrastRows.length > 0 ? `${BLUE}12` : `${BLUE}22`, color: "white", fontSize: 12, fontWeight: 800, cursor: scenarioContrastLoading || isLoading ? "wait" : "pointer", opacity: scenarioContrastLoading || isLoading ? 0.72 : 1 }}
            >
              {scenarioContrastLoading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <GitCompare style={{ width: 13, height: 13 }} />}
              {scenarioContrastLoading ? "Loading pathways" : scenarioContrastRows.length > 0 ? "Refresh pathways" : "Load pathway contrast"}
            </button>
          </div>
          <div id="scenario-contrast-receipt" style={{ marginBottom: 10 }}>
            <ReceiptDetails label="method" text="Fetches the same annual checkpoints for each supported SSP scenario using the grounded /api/climate-trajectory endpoint and the same coordinates." />
            <ReceiptDetails label="default" text={`${DEFAULT_SCENARIO_EXPLANATION} Version: ${DEFAULT_SCENARIO_POLICY_VERSION}.`} />
          </div>

          {scenarioContrastError && (
            <div style={{ padding: "9px 11px", borderRadius: 8, border: `1px solid ${RED}35`, background: `${RED}12`, color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>
              {scenarioContrastError}
            </div>
          )}

          {scenarioContrastTakeaway ? (
            <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,0.88)" }}>
              <strong style={{ color: BLUE }}>Local pathway gap:</strong>{" "}
              {scenarioContrastTakeaway.text} This is the concrete local difference between lower and higher warming, not a claim that one pathway is guaranteed.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: MUTED }}>
              Load the contrast to see how the same year changes under each supported SSP. The current forecast stays on {shownScenario.label}; the comparison only adds context.
            </p>
          )}

          {scenarioContrastRows.length > 0 && (
            <div>
              <ScenarioSmallMultiples
                metrics={scenarioSmallMultipleMetrics}
                selectedYear={displayYear}
                startYear={BASELINE_YEAR}
                endYear={MAX_YEAR}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 10 }}>
                {scenarioContrastRows.map((row) => {
                  const rowScoreColor = scoreColor(row.score);
                  const active = row.id === shownScenario.id;
                  return (
                    <div key={row.id} style={{ border: `1px solid ${active ? `${ACCENT}66` : BORDER}`, background: active ? `${ACCENT}10` : "rgba(255,255,255,0.035)", borderRadius: 8, padding: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "white" }}>{row.label}</div>
                          <div style={{ fontSize: 10, color: active ? ACCENT : MUTED, marginTop: 2 }}>{row.role}</div>
                        </div>
                        {active && <span style={{ fontSize: 9, color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 999, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>shown</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Raw warming</div><div style={{ fontSize: 13, fontWeight: 800, color: RED }}>{signedNumber(row.tempChange, 1)}°C</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>IPCC assessed</div><div style={{ fontSize: 13, fontWeight: 800, color: AMBER }}>{signedNumber(row.ipccDelta, 1)}°C</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Heat stress</div><div style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>{row.heatDays}/yr</div></div>
                        <div><div style={{ fontSize: 9, color: MUTED }}>Rainfall</div><div style={{ fontSize: 13, fontWeight: 800, color: BLUE }}>{signedNumber(row.precipChange, 1)}%</div></div>
                      </div>
                      <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 10, color: MUTED }}>{row.category}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: rowScoreColor }}>{row.score}/100</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <ReceiptDetails label="method" text="Same location and selected year; values interpolate from the annual trajectory returned by /api/climate-trajectory." />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {scoreStory && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
            <div style={{ ...card, padding: 18, borderLeft: `3px solid ${AMBER}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Why this changed</h2>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.55, margin: "6px 0 0" }}>
                    Ranked by score-component movement from {scoreStory.baselineYear} to {displayYear}; this is not a full causal attribution model.
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase" }}>Score movement</div>
                  <div style={{ color: scoreStory.scoreDelta < 0 ? RED : GREEN, fontSize: 18, fontWeight: 800 }}>{signedNumber(scoreStory.scoreDelta, 0)} pts</div>
                  <div style={{ fontSize: 10, color: MUTED }}>{scoreStory.baselineScore} → {d!.score}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(116px, 1fr))", gap: 8, marginBottom: 12 }}>
                {scoreStory.trendRates.map((rate) => (
                  <div key={rate.label} style={{ background: "rgba(255,255,255,0.045)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 9px" }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{rate.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: rate.color }}>{rate.value}</div>
                    <div style={{ marginTop: 6 }}>
                      <ReceiptDetails label="rate" text="Per-decade slope from the baseline point to the selected year." />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {scoreStory.scoreDrivers.length > 0 ? scoreStory.scoreDrivers.map((driver, index) => {
                  const helps = driver.effect >= 0;
                  return (
                    <div key={driver.key} style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) auto", gap: 9, alignItems: "center" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: helps ? `${GREEN}16` : `${RED}16`, color: helps ? GREEN : RED, fontSize: 11, fontWeight: 800 }}>{index + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{driver.label}</div>
                        <div style={{ fontSize: 10.5, color: MUTED }}>{driver.movement} · raw component {signedNumber(driver.delta, 1)}</div>
                        <div style={{ marginTop: 5 }}>
                          <ReceiptDetails label="method" text={`Baseline ${driver.baselineValue.toFixed(1)}; selected year ${driver.val.toFixed(1)}. Effect sign is adjusted so positive means helping the score.`} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: helps ? GREEN : RED }}>{signedNumber(driver.effect, 1)} pts</div>
                    </div>
                  );
                }) : (
                  <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>No score component moved enough to rank; the modeled score is broadly stable at this horizon.</p>
                )}
              </div>
            </div>

            <div style={{ ...card, padding: 18, borderLeft: `3px solid ${GREEN}` }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, marginBottom: 12 }}>What this means for daily life</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dailyLifeSignals.map((signal) => (
                  <div key={signal.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, paddingBottom: 11, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{signal.label}</span>
                        <ReceiptDetails label="source" text={signal.receipt} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.58 }}>{signal.text}</p>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: signal.color, whiteSpace: "nowrap" }}>{signal.value}</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 10.5, lineHeight: 1.55, color: MUTED }}>
                Not yet included in the score: daily cold-stress days, crop yields, wildfire weather, biodiversity species ranges, local freshwater infrastructure, or parcel-level flood exposure.
              </p>
            </div>

            {scoreSensitivityInputs.length > 0 && (
              <ScoreSensitivity modelScore={d!.score} category={d!.category} inputs={scoreSensitivityInputs} />
            )}
          </div>
        )}

        {/* Climate Twin — nearest present-day analog from the grounded catalog */}
        <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${PURPLE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin style={{ width: 15, height: 15, color: PURPLE }} />
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Climate Twin · current-day analog</h2>
            </div>
            {analogCatalog && (
              <span style={{ fontSize: 10, color: MUTED }}>
                {analogCatalog.candidateCount} indexed cities · {analogCatalog.catalogYear} catalog
              </span>
            )}
          </div>

          {climateAnalog ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 360px" }}>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.9)", margin: 0 }}>
                    In <strong style={{ color: "white" }}>{displayYear}</strong>, {placeName}'s climate most resembles{" "}
                    <strong style={{ color: PURPLE }}>{climateAnalog.candidate.name}, {climateAnalog.candidate.country}</strong>{" "}
                    in the current-day catalog. This is a nearest match across monthly temperature and precipitation, not a claim that every local impact is identical.
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, marginTop: 8, lineHeight: 1.55 }}>
                    Distance {climateAnalog.distance.toFixed(2)} standardized climate units; lower is closer. Compared {climateAnalog.comparedCount} cities from the grounded analog catalog.
                  </p>
                </div>
                <button
                  onClick={openClimateTwinCity}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${PURPLE}55`, background: `${PURPLE}16`, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <ExternalLink style={{ width: 13, height: 13 }} />
                  Open twin city
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 8, marginTop: 14 }}>
                {[
                  { label: "Avg temp gap", value: `${signedNumber(climateAnalog.annualTempDelta, 1)}°C`, color: RED },
                  { label: "Rainfall gap", value: `${signedNumber(climateAnalog.annualPrecipDelta, 0)} mm`, color: BLUE },
                  { label: "Heat nights gap", value: `${signedNumber(climateAnalog.heatDaysDelta, 0)} d/yr`, color: ORANGE },
                  { label: "Drought gap", value: `${signedNumber(climateAnalog.droughtDelta, 0)} pts`, color: AMBER },
                  { label: "Flood gap", value: `${signedNumber(climateAnalog.floodDelta, 0)} pts`, color: CYAN },
                ].map((item) => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.color, whiteSpace: "nowrap" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: analogError ? "#fca5a5" : MUTED, fontSize: 13 }}>
              {analogError ?? "Loading grounded current-day analog catalog..."}
            </p>
          )}
        </div>

        {shareStory && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${ACCENT}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <Share2 style={{ width: 15, height: 15, color: ACCENT }} />
                  <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Shareable climate story</h2>
                  <ReceiptDetails label="receipt" text={shareStory.caveat} />
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.45, color: "white" }}>{shareStory.headline}</p>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.76)" }}>
                  {shareStory.metricLine}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button onClick={shareForecast} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${ACCENT}55`, background: `${ACCENT}18`, color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  <Share2 style={{ width: 13, height: 13 }} />
                  Share story
                </button>
                <button onClick={copyShareStory} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${shareStoryCopied ? GREEN : BORDER}`, background: shareStoryCopied ? `${GREEN}18` : "rgba(255,255,255,0.035)", color: shareStoryCopied ? GREEN : "white", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {shareStoryCopied ? <Check style={{ width: 13, height: 13 }} /> : <Share2 style={{ width: 13, height: 13 }} />}
                  {shareStoryCopied ? "Copied story" : "Copy story"}
                </button>
                <button onClick={downloadShareImage} disabled={shareImageBusy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 7, border: `1px solid ${shareImageSaved ? GREEN : BORDER}`, background: shareImageSaved ? `${GREEN}18` : "rgba(255,255,255,0.035)", color: shareImageSaved ? GREEN : "white", fontSize: 12, fontWeight: 800, cursor: shareImageBusy ? "wait" : "pointer", opacity: shareImageBusy ? 0.72 : 1 }}>
                  {shareImageBusy ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : shareImageSaved ? <Check style={{ width: 13, height: 13 }} /> : <Download style={{ width: 13, height: 13 }} />}
                  {shareImageBusy ? "Rendering image" : shareImageSaved ? "Saved image" : "Download image"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 9 }}>
              {[
                { label: "Trend driver", text: shareStory.driverLine, color: AMBER },
                { label: "Climate twin", text: shareStory.analogLine, color: PURPLE },
              ].map((item) => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: item.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.82)" }}>{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {learningPrompts.length > 0 && (
          <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: `3px solid ${BLUE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: "1 1 440px" }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED }}>Questions to test next</h2>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.6 }}>
                  A useful forecast should change what you compare. These prompts reuse the same grounded fields and routes, so the next click stays inspectable.
                </p>
              </div>
              <ReceiptDetails label="scope" text="Prompts are generated from the visible forecast, scenario contrast, and bounded climate-twin catalog. They are learning prompts, not advice to move, invest, insure, or rank safe havens." />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {learningPrompts.map((prompt) => {
                const busy = prompt.action === "pathways" && scenarioContrastLoading;
                const disabled = prompt.disabled || busy;
                const accent = prompt.action === "twin" ? PURPLE : prompt.action === "comparison" ? ACCENT : BLUE;
                return (
                  <div key={prompt.eyebrow} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.032)" }}>
                    <div style={{ fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 850, marginBottom: 7 }}>{prompt.eyebrow}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 800, color: "white", marginBottom: 7 }}>{prompt.question}</div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.72)" }}>{prompt.detail}</p>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <ReceiptDetails label="receipt" text={prompt.receipt} />
                      <button
                        disabled={disabled}
                        onClick={() => {
                          if (prompt.action === "pathways") { void loadScenarioContrast(); return; }
                          if (prompt.action === "twin") { openClimateTwinCity(); return; }
                          window.location.href = "/comparison";
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 7, border: `1px solid ${accent}55`, background: `${accent}16`, color: "white", fontSize: 11.5, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                      >
                        {busy ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : prompt.action === "comparison" ? <GitCompare style={{ width: 12, height: 12 }} /> : <ExternalLink style={{ width: 12, height: 12 }} />}
                        {busy ? "Loading" : prompt.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Avg Temperature</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.avgTemp.toFixed(1)}°C</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: RED }}>+{d!.tempChange.toFixed(1)}°</span>
            </div>
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Raw CMIP6 model-consensus annual_mean and anomaly for the selected SSP scenario. Trend range uses temperature.uncertainty.annual_mean_low/high when exposed by the grounded API." />
            </div>
          </div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Annual Precip</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{d!.annualPrecip}mm</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>{d!.precipChange >= 0 ? "+" : ""}{d!.precipChange.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Annual precipitation total and anomaly_percent from the grounded precipitation projection. It does not include groundwater, reservoirs, demand, or local drainage capacity." />
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
            <div style={{ marginTop: 7 }}>
              <ReceiptDetails label="source" text="Heat-stress days come from the grounded extremes layer returned by /api/climate-trajectory. Treat as a climate screening indicator, not medical or occupational-safety advice." />
            </div>
          </div>
          <div style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 4 }}>Habitability</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{d!.score}<span style={{ fontSize: 14, color: MUTED }}>/100</span></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: sc, marginTop: 2 }}>{d!.category}</div>
              <div style={{ marginTop: 7 }}>
                <ReceiptDetails label="method" text="Habitability is the score returned by the grounded grid engine from its visible climate component breakdown. It is educational context, not a safety certificate or relocation recommendation." />
              </div>
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
              <span style={{ fontSize: 10, color: MUTED, marginLeft: 4 }}>{BASELINE_YEAR} baseline to {MAX_YEAR}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: MUTED }}>
              <div style={{ width: 14, height: 1.5, borderTop: `1.5px dashed ${ACCENT}`, opacity: 0.7 }} />
              <span>= selected year marker (synced with slider above)</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
            <TrendChart
              years={traj!.years}
              values={traj!.temp}
              lowValues={traj!.tempLow}
              highValues={traj!.tempHigh}
              year={year}
              label="Temperature"
              unit="°C"
              color={RED}
              decimals={1}
              thresholdY={18}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel="Shaded band uses temperature.uncertainty.annual_mean_low/high from the grounded API for this location, year range, and scenario."
            />
            <TrendChart
              years={traj!.years}
              values={traj!.precip}
              lowValues={traj!.precipLow}
              highValues={traj!.precipHigh}
              year={year}
              label="Precipitation"
              unit="mm"
              color={BLUE}
              decimals={0}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel="Shaded band uses precipitation.uncertainty.annual_total_low/high from the grounded API. Local precipitation trends can have larger model disagreement and direction changes."
            />
            <TrendChart years={traj!.years} values={traj!.heat} year={year} label="Heat Days" unit="d" color={ORANGE} decimals={0} thresholdY={15} scenarioLabel={shownScenario.label} />
            <TrendChart years={traj!.years} values={traj!.score} year={year} label="Habitability" unit="" color={sc} decimals={0}
              scenarioLabel={shownScenario.label}
              zones={[
                { from: 85, to: 100, color: GREEN }, { from: 70, to: 85, color: "#4ade80" },
                { from: 60, to: 70, color: AMBER }, { from: 40, to: 60, color: ORANGE }, { from: 0, to: 40, color: RED },
              ]} />
            <TrendChart
              years={traj!.years}
              values={traj!.sea}
              lowValues={traj!.seaLow}
              highValues={traj!.seaHigh}
              year={year}
              label="Sea-level context"
              unit="cm"
              color={CYAN}
              decimals={0}
              thresholdY={50}
              thresholdLabel={coastalRelevance?.thresholdLabel ?? "50 cm regional context"}
              scenarioLabel={shownScenario.label}
              uncertaintyLabel={`Shaded band uses AR6 regional sea-level low/high context returned by the API. ${coastalRelevance?.receipt ?? "Coastal relevance is not evaluated, so this is not a parcel-level coastal exposure assessment."}`}
            />
            <TrendChart
              years={traj!.years}
              values={traj!.drought}
              year={year}
              label="Drought Risk"
              unit="%"
              color={AMBER}
              decimals={0}
              thresholdY={50}
              thresholdLabel="50% elevated risk"
              scenarioLabel={shownScenario.label}
            />
            <TrendChart
              years={traj!.years}
              values={traj!.flood}
              year={year}
              label="Flood Risk"
              unit="%"
              color={BLUE}
              decimals={0}
              thresholdY={50}
              thresholdLabel="50% elevated risk"
              scenarioLabel={shownScenario.label}
            />
          </div>
          <div style={{ marginTop: 12, padding: "6px 10px", background: `${ACCENT}07`, border: `1px solid ${ACCENT}18`, borderRadius: 8, fontSize: 10, color: MUTED }}>
            💡 Drag the year slider to move the marker across all seven charts simultaneously and see how each metric evolves. Hover plotted years for values, or open values for keyboard/touch access. Translucent bands show grounded low-high ranges where the API exposes comparable uncertainty fields; labeled dashed horizontal lines mark documented risk/context thresholds.
          </div>
        </div>

        {/* Temperature */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Temperature Projection</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
                <span style={{ color: MUTED }}>{BASELINE_YEAR} baseline</span>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
          {[
            {
              label: "Heat Stress",
              value: d!.heatDays,
              unit: "days/yr",
              delta: `+${Math.max(0, d!.heatDays - d!.baseHeatDays)}d`,
              detail: `${roundedValue(d!.heatNightsRaw, " tropical nights/yr")} raw`,
              color: RED,
              receipt: `Heat stress uses the grounded ETCCDI tropical-nights layer for ${shownScenario.label}: nights per year with daily minimum temperature above ${d!.tropicalNightThreshold ?? 20}°C, linearly interpolated to the selected year. Ensemble spread: ${roundedValue(d!.heatNightsSpread, " days", 1)}. This is a climate screening indicator, not medical or occupational-safety advice.`,
            },
            {
              label: "Humid heat screen",
              value: d!.humidHeatWetBulb == null ? "n/a" : `${d!.humidHeatWetBulb.toFixed(1)}°C`,
              unit: "monthly mean wet-bulb",
              sub: d!.humidHeatMonth ?? "max month",
              detail: `${roundedValue(d!.humidHeatRh, "% RH", 1)} · ${signedNumber(d!.humidHeatRhDelta ?? 0, 1)} pp RH`,
              color: d!.humidHeatWetBulb != null && d!.humidHeatWetBulb >= 24 ? RED : ORANGE,
              receipt: `Humid heat screen uses monthly mean air temperature and CMIP6 near-surface relative humidity for ${shownScenario.label}, then applies the registered Stull 2011 empirical wet-bulb approximation. It reports max monthly mean wet-bulb, not WBGT, not daily humid-heat days, and not medical or occupational-safety advice. RH ensemble spread: ${roundedValue(d!.humidHeatRhSpread, " percentage points", 1)}; RH formula-domain clipped months: ${d!.humidHeatClippedMonths ?? 0}; temperature-domain warning months: ${d!.humidHeatTempDomainWarningMonths ?? 0}.`,
            },
            {
              label: "Cold-season context",
              value: d!.coldMonthCount,
              unit: "monthly mean freeze months",
              sub: `${MONTHS[d!.minIdx]} ${d!.monthlyTemps[d!.minIdx].toFixed(1)}°C`,
              detail: `${d!.baselineColdMonthCount} baseline months`,
              color: d!.coldMonthCount >= 3 ? BLUE : d!.coldMonthCount > 0 ? CYAN : GREEN,
              receipt: `Cold-season context uses monthly mean temperature from the grounded trajectory for ${shownScenario.label}. It counts months at or below ${FREEZING_MONTHLY_MEAN_C}°C, not daily freeze days, freeze-thaw events, heating demand, road conditions, crop damage, pests, or health risk.`,
            },
            {
              label: "Drought Risk",
              value: `${d!.drought}%`,
              sub: d!.drought < 25 ? "Low" : d!.drought < 40 ? "Elevated" : "High",
              detail: `${roundedValue(d!.drySpellDays, " dry-spell days")} raw`,
              bar: d!.drought / 100,
              color: AMBER,
              receipt: `Drought risk uses ETCCDI consecutive dry days for ${shownScenario.label}: the longest spell with under 1 mm of rain. The displayed score maps 0 days to 0 and ${roundedValue(d!.droughtMaxCdd, " days")} to 100. Selected raw value: ${roundedValue(d!.drySpellDays, " days", 1)}; ensemble spread: ${roundedValue(d!.drySpellSpread, " days", 1)}. It does not model reservoirs, groundwater, water rights, or demand.`,
            },
            {
              label: "Flood Risk",
              value: `${d!.flood}%`,
              sub: d!.flood < 30 ? "Low" : d!.flood < 60 ? "Elevated" : "High",
              detail: `${roundedValue(d!.maxFiveDayRain, " mm Rx5day")} raw`,
              bar: d!.flood / 100,
              color: BLUE,
              receipt: `Flood risk uses ETCCDI Rx5day for ${shownScenario.label}: maximum 5-day precipitation, a heavy-rain proxy used in IPCC AR6-style assessment. The displayed score maps 0 mm to 0 and ${roundedValue(d!.floodMaxRx5, " mm")} to 100. Selected raw value: ${roundedValue(d!.maxFiveDayRain, " mm", 1)}; ensemble spread: ${roundedValue(d!.maxFiveDayRainSpread, " mm", 1)}. It is not a parcel flood map or insurance loss estimate.`,
            },
            {
              label: "Sea-level context",
              value: `${d!.seaLevel}cm`,
              sub: coastalRelevance?.isLocallyRelevant ? "Coastal screen" : "Regional AR6",
              detail: d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)}-${Math.round(d!.seaHigh)} cm range` : "range not exposed",
              color: CYAN,
              receipt: `Sea-level context uses the registered NASA/IPCC AR6 regional sea-level layer for ${shownScenario.label}. Selected range: ${d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)} to ${Math.round(d!.seaHigh)} cm` : "not exposed"}. ${coastalRelevance?.receipt ?? "Coastal relevance is not evaluated, so this is regional context only."}`,
            },
          ].map(({ label, value, unit, delta, sub, detail, bar, color, receipt }) => (
            <div key={label} style={{ ...card, padding: 14, borderTop: `2px solid ${color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
                <ReceiptDetails label="source" text={receipt} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 }}>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 700, color }}>{value}</span>
                  {unit && <span style={{ fontSize: 10, color: MUTED, display: "block", marginTop: -2 }}>{unit}</span>}
                  {detail && <span style={{ fontSize: 9, color: MUTED, display: "block", marginTop: 4 }}>{detail}</span>}
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

        {/* Atmospheric Physics */}
        <details style={{ ...card, padding: 18, marginBottom: 14 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18 }}>⚛️</span>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Atmospheric Physics</h3>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>expand ▾</span>
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "2px 18px", marginTop: 12 }}>
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
        </details>

        {/* Projection Receipt */}
        <div style={{ ...card, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <ShieldCheck size={17} color={ACCENT} />
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Projection Receipt</h2>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED }}>
              {shownScenario.label} · {d!.resolution ?? "1.0 degree"} grid · {Math.round(year)}
            </span>
            <a href="/methodology" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: ACCENT, textDecoration: "none" }}>
              Methodology <ExternalLink size={11} />
            </a>
            <button onClick={copyRawForecastJson} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${rawJsonCopied ? GREEN : BORDER}`, background: rawJsonCopied ? `${GREEN}18` : "rgba(255,255,255,0.025)", color: rawJsonCopied ? GREEN : "white", fontSize: 10, cursor: "pointer" }}>
              {rawJsonCopied ? <Check size={11} /> : <ShieldCheck size={11} />} {rawJsonCopied ? "Copied JSON" : "Copy raw JSON"}
            </button>
            <button onClick={downloadRawForecastJson} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.025)", color: "white", fontSize: 10, cursor: "pointer" }}>
              <Download size={11} /> Download JSON
            </button>
            <button onClick={downloadEducationalReport} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: `1px solid ${reportSaved ? GREEN : BORDER}`, background: reportSaved ? `${GREEN}18` : "rgba(255,255,255,0.025)", color: reportSaved ? GREEN : "white", fontSize: 10, cursor: "pointer" }}>
              {reportSaved ? <Check size={11} /> : <Download size={11} />} {reportSaved ? "Saved report" : "Download report"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              {
                label: "Temperature range",
                value: d!.tempLow != null && d!.tempHigh != null ? `${d!.tempLow.toFixed(1)}–${d!.tempHigh.toFixed(1)}°C` : "—",
                sub: d!.tempSpread != null ? `raw CMIP6 ±${d!.tempSpread.toFixed(1)}°C ensemble spread` : "spread unavailable",
                color: RED,
              },
              {
                label: "IPCC assessed temp",
                value: `${d!.ipccTemp.toFixed(1)}°C`,
                sub: `anomaly ${d!.ipccDelta >= 0 ? "+" : ""}${d!.ipccDelta.toFixed(1)}°C; adjustment ${d!.ipccAdjustment >= 0 ? "+" : ""}${d!.ipccAdjustment.toFixed(1)}°C; k=${d!.calibrationFactor.toFixed(2)}`,
                color: AMBER,
              },
              {
                label: "Precipitation range",
                value: d!.precipLow != null && d!.precipHigh != null ? `${Math.round(d!.precipLow)}–${Math.round(d!.precipHigh)}mm` : "—",
                sub: d!.precipSpreadPct != null ? `±${d!.precipSpreadPct.toFixed(1)}% model spread` : "spread unavailable",
                color: BLUE,
              },
              {
                label: "Sea-level range",
                value: d!.seaLow != null && d!.seaHigh != null ? `${Math.round(d!.seaLow)}–${Math.round(d!.seaHigh)}cm` : "—",
                sub: coastalRelevance?.isLocallyRelevant
                  ? "IPCC AR6 low to high; coastal screen, not parcel exposure"
                  : "IPCC AR6 low to high; regional context, not parcel exposure",
                color: CYAN,
              },
              {
                label: "Baseline",
                value: d!.baselineSource?.observed_resolution ?? "1.0 degree",
                sub: d!.baselineSource?.temperature ?? d!.baseline ?? "CMIP6 historical monthly climatology",
                color: GREEN,
              },
              {
                label: "Year basis",
                value:
                  d!.projectionYearBasis?.source_year_low != null && d!.projectionYearBasis?.source_year_high != null
                    ? d!.projectionYearBasis.source_year_low === d!.projectionYearBasis.source_year_high
                      ? `${d!.projectionYearBasis.source_year_low}`
                      : `${d!.projectionYearBasis.source_year_low}-${d!.projectionYearBasis.source_year_high}`
                    : "—",
                sub: d!.projectionYearBasis?.note ?? "Source cadence unavailable",
                color: PURPLE,
              },
            ].map((item) => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 11px" }}>
                <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 5 }}>{item.value}</div>
                <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.35, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>
          {d!.baselineSource?.delta_reference_period && (
            <p style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.45, marginTop: 10 }}>
              Baseline note: {d!.baselineSource.delta_reference_period}.
            </p>
          )}
          <p style={{ color: MUTED, fontSize: 9.5, lineHeight: 1.45, marginTop: 8, marginBottom: 12 }}>
            Raw JSON export includes the selected-year projection, the full annual trajectory, scenario, model version, uncertainty fields, and source trail returned by the grounded API. The Markdown report is an educational summary built from the same visible fields, annual roadmap, climate twin, source trail, and missing-domain caveats.
          </p>
          <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${AMBER}38`, background: `${AMBER}10`, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: AMBER, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>What this does not mean</div>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,0.76)" }}>
              This is educational and research context, not a property-risk certificate, safety forecast, relocation recommendation, insurance model, medical advice, engineering assessment, or guarantee that this exact point will be livable or unlivable. Local adaptation, governance, health systems, wealth, migration, conflict, infrastructure, elevation, and parcel-scale exposure are outside this score.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            {d!.sourceTrail.slice(0, 4).map((entry) => (
              <div key={entry.label} style={{ padding: "9px 10px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.055)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{entry.label}</span>
                  <span style={{ fontSize: 9, color: ACCENT, textAlign: "right" }}>{entry.source}</span>
                </div>
                <div style={{ fontSize: 9.5, color: MUTED, lineHeight: 1.35 }}>{entry.method}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.42)", marginTop: 4 }}>{entry.citation}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tipping Points */}
        <details style={{ ...card, padding: 18, marginBottom: 14 }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer", listStyle: "none" }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, margin: 0 }}>Tipping Point Timeline</h2>
            <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>expand ▾</span>
          </summary>
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
                    <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>{reached ? `${tp.year} · ${tp.year! - BASELINE_YEAR} years from baseline` : "Not reached by 2100"}</div>
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
        </details>

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
              <div style={{ fontSize: 8, color: MUTED }}>{BASELINE_YEAR} baseline to {MAX_YEAR} trajectory</div>
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

      {/* Activism Section */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "56px 20px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.01em" }}>A forecast isn't a fate.</h2>
          <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 28 }}>
            Use the scenario contrast as a learning tool: lower-warming pathways change the local roadmap, and higher-warming pathways show what gets harder. The point is to make those differences visible, not to treat any one pathway as fate.
          </p>
          <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Don't just find a better spot. F*** up the forecast.
          </p>
          <p style={{ fontSize: 12, color: MUTED, letterSpacing: "0.03em" }}>→ fupit.com</p>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: MUTED, fontSize: 10 }}>
          fupit · {d!.model}{d!.modelVersion ? ` ${d!.modelVersion}` : ""} · {shownScenario.label} · Uncertainty shown from ensemble spread / AR6 ranges · For research &amp; planning
        </p>
        <p style={{ color: MUTED, fontSize: 10, marginTop: 6 }}>
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/MikkoParkkola" target="_blank" rel="noopener noreferrer" style={{ color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}>
            Mikko Parkkola
          </a>
        </p>
      </footer>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
