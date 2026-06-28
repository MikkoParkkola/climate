// ── Pure helpers extracted from climate-app.tsx (no JSX, no React) ──
import {
  ACCENT,
  AMBER,
  BASELINE_YEAR,
  BLUE,
  CYAN,
  DEFAULT_SCENARIO,
  FREEZING_MONTHLY_MEAN_C,
  GREEN,
  MAX_YEAR,
  MUTED,
  ORANGE,
  PURPLE,
  RED,
  SCENARIOS,
} from "./climate-constants";
import type {
  AnalogCandidate,
  AnalogCatalog,
  ClimateAnalogMatch,
  CoastCoord,
  CoastalProximityArtifact,
  CoastalRelevance,
  LocationOption,
  ProjectionPoint,
  RoadmapItem,
  ScenarioContrastRow,
  ScenarioId,
} from "./climate-types";

// ── Math helpers ─────────────────────────────────────────────────────────────
export function lerp(a: number, b: number, t: number) {
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

// Interpolate parallel year/value arrays at an arbitrary year.
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

export function categoryFor(score: number) {
  return score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Severe";
}

export function scoreColor(s: number) {
  return s >= 85 ? GREEN : s >= 70 ? "#4ade80" : s >= 60 ? AMBER : s >= 40 ? ORANGE : RED;
}

export function signedNumber(value: number, decimals = 1) {
  const rounded = value.toFixed(decimals);
  return value >= 0 ? `+${rounded}` : rounded;
}

export function roundedValue(value: number | undefined | null, unit: string, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return "not exposed";
  return `${decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString()}${unit}`;
}

// ── Coastal proximity ────────────────────────────────────────────────────────
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

export function nearestCoastDistanceKm(lat: number, lng: number, artifact: CoastalProximityArtifact): number | undefined {
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

export function formatDistanceKm(distanceKm: number | undefined): string {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return "not evaluated";
  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
}

export function coastalRelevanceFor(location: LocationOption, artifact: CoastalProximityArtifact): CoastalRelevance {
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

// ── Climate analog matching ──────────────────────────────────────────────────
export function climateVector(monthlyTemps: number[], monthlyPrecip: number[]): number[] | null {
  if (monthlyTemps.length !== 12 || monthlyPrecip.length !== 12) return null;
  const vals = [
    ...monthlyTemps,
    ...monthlyPrecip.map((v) => Math.log1p(Math.max(0, v))),
  ];
  return vals.every(Number.isFinite) ? vals : null;
}

export function candidateClimateVector(candidate: AnalogCandidate): number[] | null {
  return climateVector(candidate.temperature.monthly, candidate.precipitation.monthly);
}

export function sameCatalogPlace(candidate: AnalogCandidate, location: LocationOption): boolean {
  return Math.abs(candidate.lat - location.lat) < 0.15 && Math.abs(candidate.lng - location.lng) < 0.15;
}

export function findClimateAnalog(
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

// ── Labels & narrative text ──────────────────────────────────────────────────
export function prettify(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function confidenceColor(c: string) {
  const v = (c || "").toLowerCase();
  if (v.includes("low")) return RED;
  if (v.includes("medium")) return AMBER;
  return GREEN;
}

export function feedbackTag(text: string): { icon: string; label: string; color: string } {
  const v = text.toLowerCase();
  const short = text.split(":")[0].trim();
  if (v.includes("ice")) return { icon: "❄️", label: short, color: CYAN };
  if (v.includes("water vapor") || v.includes("moisture")) return { icon: "💧", label: short, color: PURPLE };
  if (v.includes("cloud")) return { icon: "☁️", label: short, color: BLUE };
  if (v.includes("vegetation") || v.includes("carbon")) return { icon: "🌱", label: short, color: GREEN };
  return { icon: "🔁", label: short, color: AMBER };
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

// ── Scenario helpers ─────────────────────────────────────────────────────────
export function scenarioInfo(id?: string): { id: ScenarioId; label: string; caption: string } {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS.find((s) => s.id === DEFAULT_SCENARIO)!;
}

export function scenarioRole(id: ScenarioId): string {
  if (id === "ssp126") return "Lower-warming comparison";
  if (id === "ssp245") return "Current-policy-adjacent reference";
  if (id === "ssp370") return "Higher-warming stress case";
  return "Very-high, lower-likelihood stress test";
}

export function contrastSnapshot(points: ProjectionPoint[], year: number, scenarioId: ScenarioId): ScenarioContrastRow {
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

// ── Roadmap helpers ──────────────────────────────────────────────────────────
export function roadmapDriver(current: Omit<RoadmapItem, "driver">, previous: Omit<RoadmapItem, "driver">): RoadmapItem["driver"] {
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

export function roadmapSnapshot(points: ProjectionPoint[], year: number, previous?: Omit<RoadmapItem, "driver">): RoadmapItem {
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

// ── URL & slug helpers ───────────────────────────────────────────────────────
export function jsonFileSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "location";
}

export function parseScenario(id: string | null): ScenarioId {
  return (SCENARIOS.some((s) => s.id === id) ? id : DEFAULT_SCENARIO) as ScenarioId;
}

export function forecastUrl(location: LocationOption, year: number, scenario: ScenarioId, autoRun = true): string {
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

export function linkLocationFromParams(): { location: LocationOption; year?: number; scenario: ScenarioId; autoRun: boolean } | null {
  const params = new URLSearchParams(window.location.search);
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
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

export function crossYear(points: ProjectionPoint[], threshold: number, dir: "above" | "below", get: (p: ProjectionPoint) => number): number | null {
  for (let y = BASELINE_YEAR; y <= MAX_YEAR; y++) {
    const v = interpScalar(points, y, get);
    if (dir === "above" ? v >= threshold : v <= threshold) return y;
  }
  return null;
}
