// ── Pure derivation functions extracted from climate-app.tsx useMemo bodies ──
import {
  interpScalar, interpOptionalScalar, riskScore, categoryFor,
  countMonthlyFreezeContext, prettify, nearestPoint,
} from "./climate-helpers";
import { MONTHS, ORANGE, AMBER, GREEN } from "./climate-constants";
import type { ProjectionPoint } from "./climate-types";

// Derived trend arrays (stable per trajectory)
export function deriveTraj(trajectory: ProjectionPoint[] | null) {
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
}

// Snapshot at current slider year
export function deriveSnapshot(trajectory: ProjectionPoint[] | null, year: number) {
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
}

import {
  isDriverComponent, componentScoreEffect, perDecade, signedNumber, scenarioRole,
  contrastSnapshot, roadmapSnapshot, crossYear, coastalRelevanceFor,
} from "./climate-helpers";
import { RED, BLUE, CYAN, PURPLE, SCENARIOS, SCENARIO_LINE_COLORS, BASELINE_YEAR } from "./climate-constants";
import type {
  ScenarioId, ScenarioContrastRow, RoadmapItem, CoastalRelevance,
  LocationOption, CoastalProximityArtifact,
} from "./climate-types";
import type { ScoreSensitivityInput } from "@/components/score-sensitivity";

type ScenarioContrastMap = Partial<Record<ScenarioId, ProjectionPoint[]>>;
export type Snapshot = NonNullable<ReturnType<typeof deriveSnapshot>>;
export type ScoreStory = NonNullable<ReturnType<typeof deriveScoreStory>>;

export function deriveScoreStory(trajectory: ProjectionPoint[] | null, d: Snapshot | null, displayYear: number) {
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
}

export function deriveScoreSensitivityInputs(d: Snapshot | null): ScoreSensitivityInput[] {
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
}

export function deriveScenarioContrastRows(scenarioContrast: ScenarioContrastMap | null, displayYear: number): ScenarioContrastRow[] {
  if (!scenarioContrast) return [];
  return SCENARIOS
    .map((row) => {
      const points = scenarioContrast[row.id];
      return points ? contrastSnapshot(points, displayYear, row.id) : null;
    })
    .filter((row): row is ScenarioContrastRow => row !== null);
}

export function deriveScenarioContrastTakeaway(scenarioContrastRows: ScenarioContrastRow[], displayYear: number) {
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
}

export function deriveRoadmapItems(trajectory: ProjectionPoint[] | null, scenarioContrast: ScenarioContrastMap | null, roadmapYears: number[]): RoadmapItem[] {
  if (!trajectory) return [];
  let previous: RoadmapItem | undefined;
  return roadmapYears.map((roadmapYear) => {
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
}

export function deriveCoastalRelevance(
  selectedLocation: LocationOption | null,
  coastalArtifact: CoastalProximityArtifact | null,
  coastalArtifactError: string | null,
): CoastalRelevance | null {
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
}

export function deriveTipping(trajectory: ProjectionPoint[] | null, coastalRelevance: CoastalRelevance | null) {
  if (!trajectory) return [];
  const items = [
    { icon: "🌡️", label: "Heat stress exceeds 15 days/yr", year: crossYear(trajectory, 15, "above", (p) => p.extremes.heat_stress_days) },
    { icon: "⚠️", label: "Habitability drops below 70 (Fair territory)", year: crossYear(trajectory, 70, "below", (p) => p.habitability.score) },
    { icon: "🌊", label: `${coastalRelevance?.isLocallyRelevant ? "Coastal" : "Regional"} sea-level context exceeds 50 cm`, year: crossYear(trajectory, 50, "above", (p) => p.extremes.sea_level_rise_cm ?? 0) },
    { icon: "💧", label: "Drought risk exceeds 50%", year: crossYear(trajectory, 50, "above", (p) => riskScore(p.extremes.drought_risk)) },
  ];
  return items.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
}

import {
  heatLifeText, coldSeasonLifeText, precipitationLifeText, describeSignalLevel,
  circulationContextFor, scenarioInfo,
} from "./climate-helpers";
import { GREEN as GREEN2, FREEZING_MONTHLY_MEAN_C, MONTHS as MONTHS2 } from "./climate-constants";
import type { AnalogCatalog, ClimateAnalogMatch, LearningPrompt } from "./climate-types";
import type { ScenarioSmallMultipleMetric } from "@/components/scenario-small-multiples";

export function deriveScenarioSmallMultipleMetrics(
  scenarioContrast: ScenarioContrastMap | null,
  scenario: ScenarioId,
  coastalRelevance: CoastalRelevance | null,
): ScenarioSmallMultipleMetric[] {
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
    makeMetric("habitability", "Habitability score", "", GREEN2, 0, (point) => Math.max(0, Math.min(100, point.habitability.score)), "Habitability is the app's registered composite score for the same scenario trajectory; use component receipts and the methodology page to inspect inputs."),
  ];
}

export function deriveDailyLifeSignals(
  d: Snapshot | null,
  scoreStory: ScoreStory | null,
  scenario: ScenarioId,
  selectedLocation: LocationOption | null,
  coastalRelevance: CoastalRelevance | null,
) {
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
      color: d.coldMonthCount >= 3 ? BLUE : d.coldMonthCount > 0 ? CYAN : GREEN2,
      text: coldSeasonLifeText(d.coldMonthCount, d.baselineColdMonthCount, MONTHS2[d.minIdx], d.monthlyTemps[d.minIdx]),
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
      color: Math.max(d.drought, d.flood) >= 70 ? RED : Math.max(d.drought, d.flood) >= 40 ? AMBER : GREEN2,
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
}

export function deriveShareStory(
  selectedLocation: LocationOption | null,
  d: Snapshot | null,
  scoreStory: ScoreStory | null,
  shareUrl: string,
  climateAnalog: ClimateAnalogMatch | null,
  analogCatalog: AnalogCatalog | null,
  shownScenarioLabel: string,
  displayYear: number,
) {
  if (!selectedLocation || !d || !scoreStory || !shareUrl) return null;
  const shortPlace = selectedLocation.city || selectedLocation.name.split(",")[0] || selectedLocation.name;
  const topDriver = scoreStory.scoreDrivers[0];
  const headline = climateAnalog
    ? `${shortPlace} in ${displayYear} looks most like ${climateAnalog.candidate.name}, ${climateAnalog.candidate.country} today`
    : `${shortPlace} in ${displayYear}: grounded fupit climate story`;
  const metricLine = `${shownScenarioLabel}: raw warming ${signedNumber(d.tempChange, 1)}°C from ${BASELINE_YEAR}, ${d.heatDays} heat-stress days/yr, habitability ${d.score}/100 (${d.category}).`;
  const driverLine = topDriver
    ? `Top visible score driver: ${topDriver.label} ${topDriver.movement}, ${signedNumber(topDriver.effect, 1)} score points.`
    : "Top visible score driver: no single score component moved enough to dominate this horizon.";
  const analogLine = climateAnalog
    ? (climateAnalog.noAnalog
        ? `Current-day climate twin: none — this location's projected climate has no present-day equivalent in the ${climateAnalog.comparedCount}-city catalog (novel climate, >4σ dissimilarity).`
        : `Current-day climate twin: ${climateAnalog.candidate.name}, ${climateAnalog.candidate.country} (${climateAnalog.matchLabel} match, ${climateAnalog.sigma.toFixed(1)}σ); distance ${climateAnalog.distance.toFixed(2)} standardized climate units across ${climateAnalog.comparedCount} bounded-catalog cities.`)
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
}

export function deriveLearningPrompts(
  selectedLocation: LocationOption | null,
  d: Snapshot | null,
  scoreStory: ScoreStory | null,
  displayYear: number,
  scenarioContrastTakeaway: ReturnType<typeof deriveScenarioContrastTakeaway>,
  scenarioContrastRowsLength: number,
  climateAnalog: ClimateAnalogMatch | null,
  analogCatalog: AnalogCatalog | null,
): LearningPrompt[] {
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
      actionLabel: scenarioContrastRowsLength > 0 ? "Refresh pathways" : "Load pathways",
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
}
