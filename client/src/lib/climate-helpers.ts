/**
 * Pure climate data & math helpers extracted from climate-app.tsx.
 * No React dependencies. Safe for unit testing and reuse.
 */

export type CoastCoord = [number, number];

export type ProjectionPoint = {
  year: number;
  temperature: { annual_mean: number; anomaly: number; monthly?: number[]; ipcc_calibrated?: { anomaly: number } };
  precipitation: { annual_total: number; anomaly_percent: number; monthly?: number[] };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number; sea_level_rise_cm?: number; sea_level_applicable?: boolean };
  habitability: { score: number; [key: string]: unknown };
};

export type AnalogCandidate = {
  lat: number;
  lng: number;
  temperature: { annual_mean: number; monthly: number[] };
  precipitation: { annual_total: number; monthly: number[] };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number };
};

export type AnalogCatalog = { candidates: AnalogCandidate[]; catalogYear: number };

export type ClimateAnalogMatch = {
  candidate: AnalogCandidate;
  distance: number;
  comparedCount: number;
  annualTempDelta: number;
  annualPrecipDelta: number;
  heatDaysDelta: number;
  droughtDelta: number;
  floodDelta: number;
};

export type CoastalRelevance = {
  status: "unavailable" | "coastal" | "near_coastal" | "regional" | "inland";
  label: string;
  shortLabel: string;
  summary: string;
  receipt: string;
  thresholdLabel: string;
  isLocallyRelevant: boolean;
  distanceKm?: number;
};

export type ScenarioContrastRow = {
  id: string;
  label: string;
  role: string;
  caption: string;
  tempChange: number;
  ipccDelta: number;
  heatDays: number;
  precipChange: number;
  score: number;
  category: string;
};

export type RoadmapItem = {
  year: number;
  tempChange: number;
  heatDays: number;
  coldMonths: number;
  precipChange: number;
  drought: number;
  flood: number;
  seaLevel: number;
  seaLevelApplicable: boolean;
  score: number;
  category: string;
  driver: { label: string; color: string; text: string };
};

const FREEZING_MONTHLY_MEAN_C = 0;
const BASELINE_YEAR = 2025;
const MAX_YEAR = 2100;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function interpScalar(points: ProjectionPoint[], year: number, get: (p: ProjectionPoint) => number): number {
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

export function interpOptionalScalar(points: ProjectionPoint[], year: number, get: (p: ProjectionPoint) => number | undefined): number | undefined {
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

export function riskScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function interpArr(years: number[], values: number[], year: number): number {
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

export function nearestPoint(points: ProjectionPoint[], year: number): ProjectionPoint {
  return points.reduce((best, p) => (Math.abs(p.year - year) < Math.abs(best.year - year) ? p : best), points[0]);
}

export function categoryFor(score: number): string {
  return score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
}

export function signedNumber(value: number, decimals = 1): string {
  const rounded = value.toFixed(decimals);
  return value >= 0 ? `+${rounded}` : rounded;
}

export function roundedValue(value: number | undefined | null, unit: string, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return "not exposed";
  return `${decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()}${unit}`;
}

export function normalizeLngDelta(candidateLng: number, originLng: number): number {
  let delta = candidateLng - originLng;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

export function distancePointToSegmentKm(lat: number, lng: number, a: CoastCoord, b: CoastCoord): number {
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

export function nearestCoastDistanceKm(lat: number, lng: number, lines: CoastCoord[][]): number | undefined {
  let best = Infinity;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const distance = distancePointToSegmentKm(lat, lng, line[i], line[i + 1]);
      if (distance < best) best = distance;
      if (best < 1) return best;
    }
  }
  return Number.isFinite(best) ? best : undefined;
}

export function formatDistanceKm(distanceKm: number | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "not evaluated";
  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
}

export function climateVector(monthlyTemps: number[], monthlyPrecip: number[]): number[] | null {
  if (monthlyTemps.length !== 12 || monthlyPrecip.length !== 12) return null;
  const vals = [...monthlyTemps, ...monthlyPrecip.map((v) => Math.log1p(Math.max(0, v)))];
  return vals.every(Number.isFinite) ? vals : null;
}

export function candidateClimateVector(candidate: AnalogCandidate): number[] | null {
  return climateVector(candidate.temperature.monthly, candidate.precipitation.monthly);
}

export function sameCatalogPlace(candidate: AnalogCandidate, lat: number, lng: number): boolean {
  return Math.abs(candidate.lat - lat) < 0.15 && Math.abs(candidate.lng - lng) < 0.15;
}

export function findClimateAnalog(
  catalog: AnalogCatalog,
  lat: number,
  lng: number,
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
    .filter((row) => !(excludeSelf && sameCatalogPlace(row.candidate, lat, lng)))
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

export function prettify(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function confidenceColor(c: string, colorMap: { RED: string; AMBER: string; GREEN: string }): string {
  const v = (c || "").toLowerCase();
  if (v.includes("low")) return colorMap.RED;
  if (v.includes("medium")) return colorMap.AMBER;
  return colorMap.GREEN;
}

export function feedbackTag(text: string, colorMap: { CYAN: string; PURPLE: string; BLUE: string; GREEN: string; AMBER: string }): { icon: string; label: string; color: string } {
  const v = text.toLowerCase();
  const short = text.split(":")[0].trim();
  if (v.includes("ice")) return { icon: "❄️", label: short, color: colorMap.CYAN };
  if (v.includes("water vapor") || v.includes("moisture")) return { icon: "💧", label: short, color: colorMap.PURPLE };
  if (v.includes("cloud")) return { icon: "☁️", label: short, color: colorMap.BLUE };
  if (v.includes("vegetation") || v.includes("carbon")) return { icon: "🌱", label: short, color: colorMap.GREEN };
  return { icon: "🔁", label: short, color: colorMap.AMBER };
}

export function componentScoreEffect(key: string, delta: number): number {
  return key.toLowerCase().includes("penalty") ? -delta : delta;
}

export function isDriverComponent(key: string): boolean {
  const normalized = key.toLowerCase();
  if (["base_score", "final_score", "comfort_optimum_c"].includes(normalized)) return false;
  return true;
}

export function perDecade(current: number, baseline: number, currentYear: number, baselineYear = BASELINE_YEAR): number {
  const years = Math.max(1, currentYear - baselineYear);
  return ((current - baseline) / years) * 10;
}

export function describeSignalLevel(score: number): string {
  if (score >= 70) return "high";
  if (score >= 40) return "moderate";
  if (score >= 15) return "emerging";
  return "low";
}

export function heatLifeText(days: number, delta: number): string {
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

export function countMonthlyFreezeContext(monthlyTemps: number[]): number {
  return monthlyTemps.filter((value) => Number.isFinite(value) && value <= FREEZING_MONTHLY_MEAN_C).length;
}

export function coldSeasonLifeText(coldMonths: number, baselineColdMonths: number, coldestMonth: string, coldestMeanC: number): string {
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

export function precipitationLifeText(percent: number): string {
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

export function circulationContextFor(lat?: number, lng?: number): { region: string } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const europeNorthAtlantic = lat >= 35 && lat <= 72 && lng >= -35 && lng <= 45;
  const arctic = lat >= 66;
  const westAfricanMonsoon = lat >= 0 && lat <= 25 && lng >= -20 && lng <= 25;
  if (arctic) return { region: "Arctic and North Atlantic" };
  if (europeNorthAtlantic) return { region: "Europe and the North Atlantic" };
  if (westAfricanMonsoon) return { region: "West African monsoon region" };
  return null;
}

export function contrastSnapshot(points: ProjectionPoint[], year: number, scenarioId: string, scenarios: any[], colors: { GREEN: string }): ScenarioContrastRow {
  const info = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
  const score = Math.max(0, Math.min(100, Math.round(interpScalar(points, year, (p) => p.habitability.score))));
  return {
    id: scenarioId,
    label: info.label,
    role: scenarioId === "ssp126" ? "Lower-warming comparison" : scenarioId === "ssp245" ? "Current-policy-adjacent reference" : scenarioId === "ssp370" ? "Higher-warming stress case" : "Very-high, lower-likelihood stress test",
    caption: info.caption,
    tempChange: interpScalar(points, year, (p) => p.temperature.anomaly),
    ipccDelta: interpScalar(points, year, (p) => p.temperature.ipcc_calibrated?.anomaly ?? p.temperature.anomaly),
    heatDays: Math.max(0, Math.round(interpScalar(points, year, (p) => p.extremes.heat_stress_days))),
    precipChange: interpScalar(points, year, (p) => p.precipitation.anomaly_percent),
    score,
    category: categoryFor(score),
  };
}

export function countMonthlyFreezeMonths(monthlyTemps: number[]): number {
  return monthlyTemps.filter((value) => Number.isFinite(value) && value <= FREEZING_MONTHLY_MEAN_C).length;
}

export function crossYear(points: ProjectionPoint[], threshold: number, dir: "above" | "below", get: (p: ProjectionPoint) => number): number | null {
  for (let y = BASELINE_YEAR; y <= MAX_YEAR; y++) {
    const v = interpScalar(points, y, get);
    if (dir === "above" ? v >= threshold : v <= threshold) return y;
  }
  return null;
}
