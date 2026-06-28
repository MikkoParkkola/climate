import {
  describePrimaryLayerAxis,
  loadObservedGrid,
  loadPrimaryGrid,
  sampleObservedBaseline,
  samplePrimaryLayer,
} from "./grid-reader";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_SCENARIO = "ssp245";
const DROUGHT_MAX_CDD = 180.0;
const FLOOD_MAX_RX5 = 300.0;
const TROPICAL_NIGHT_T = 20;
const WET_BULB_RH_MIN = 5.0;
const WET_BULB_RH_MAX = 99.0;
const WET_BULB_TEMP_MIN = -20.0;
const WET_BULB_TEMP_MAX = 50.0;

const SOURCE_TRAIL = [
  {
    label: "Temperature",
    source: "CMIP6 ScenarioMIP ensemble, with IPCC AR6 assessed calibration reported alongside",
    method:
      "headline value is observed monthly baseline where available plus raw ensemble anomaly; IPCC assessed anomaly is returned separately",
    citation: "IPCC AR6 WGI SPM Table SPM.1; CMIP6 / Eyring et al. 2016",
  },
  {
    label: "Precipitation",
    source: "CMIP6 ScenarioMIP ensemble",
    method: "observed monthly baseline where available multiplied by ensemble percent change",
    citation: "CMIP6 / Eyring et al. 2016",
  },
  {
    label: "Observed baseline",
    source: "WorldClim v2.1 current conditions",
    method:
      "10 arc-minute monthly climatology for 1970-2000; CMIP6 model baseline fallback where observed land baseline is unavailable",
    citation: "Fick & Hijmans 2017",
  },
  {
    label: "Sea level",
    source: "IPCC AR6 regional sea-level projections",
    method: "regional median plus low/high range sampled at this grid cell",
    citation: "IPCC AR6 sea-level projections; NASA AR6 archive",
  },
  {
    label: "Heat, drought, flood",
    source: "CMIP6 ETCCDI extreme-climate indices",
    method: "absolute future index scored against documented thresholds",
    citation: "Sillmann et al. 2013; IPCC AR6 WGI Ch.11",
  },
  {
    label: "Humid heat screen",
    source: "CMIP6 near-surface relative humidity plus Stull wet-bulb approximation",
    method:
      "monthly mean air temperature and relative humidity produce a max monthly mean wet-bulb screen; no daily exceedance count or WBGT is inferred",
    citation: "Stull 2011; CMIP6 / Eyring et al. 2016",
  },
];

type HabitabilityBreakdown = Record<string, number>;

function clip(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteValues(values: number[]): number[] {
  return values.filter(Number.isFinite);
}

function num(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function climateZone(lat: number): string {
  const absolute = Math.abs(lat);
  if (absolute < 23.5) return "Tropical";
  if (absolute < 35) return "Subtropical";
  if (absolute < 55) return "Temperate";
  if (absolute < 66.5) return "Subpolar";
  return "Polar";
}

function category(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Severe";
}

function habitability(
  meanTemp: number | null,
  annualPrecip: number | null,
  heatNights: number | null,
  droughtRisk: number | null,
  floodRisk: number | null,
): [number, HabitabilityBreakdown] {
  if (meanTemp === null) return [50.0, {}];

  let tempScore: number;
  if (meanTemp >= 15 && meanTemp <= 25) {
    tempScore = 100 - Math.abs(meanTemp - 20) * 1.5;
  } else if (meanTemp < 15) {
    tempScore = Math.max(0, 92 - (15 - meanTemp) * 2.2);
  } else {
    tempScore = Math.max(0, 92 - (meanTemp - 25) * 3.5);
  }
  tempScore = clip(tempScore, 0, 100);

  let precipScore: number;
  if (annualPrecip === null) {
    precipScore = 50.0;
  } else if (annualPrecip >= 600 && annualPrecip <= 1200) {
    precipScore = 100 - Math.abs(annualPrecip - 900) / 25;
  } else if (annualPrecip < 600) {
    precipScore = Math.max(20, 88 - (600 - annualPrecip) / 12);
  } else {
    precipScore = Math.max(20, 88 - (annualPrecip - 1200) / 40);
  }
  precipScore = clip(precipScore, 0, 100);

  const tempComponent = tempScore * 0.45;
  const precipComponent = precipScore * 0.35;
  const adaptation = 20.0;
  const base = tempComponent + precipComponent + adaptation;
  const heatPenalty = Math.min(30, (heatNights ?? 0) * 0.4);
  const droughtPenalty = Math.min(25, (droughtRisk ?? 0) * 0.25);
  const floodPenalty = Math.min(25, (floodRisk ?? 0) * 0.25);
  const final = clip(base - heatPenalty - droughtPenalty - floodPenalty, 10, 100);

  return [
    final,
    {
      temperature_comfort: roundOne(tempComponent),
      precipitation_adequacy: roundOne(precipComponent),
      infrastructure_adaptation: roundOne(adaptation),
      heat_stress_penalty: roundOne(heatPenalty),
      drought_penalty: roundOne(droughtPenalty),
      flood_penalty: roundOne(floodPenalty),
      drought_risk_penalty: roundOne(droughtPenalty),
      flood_risk_penalty: roundOne(floodPenalty),
      base_score: roundOne(base),
      final_score: roundOne(final),
    },
  ];
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function sum(values: number[]): number | null {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
}

function calibrationFactor(scenario: string, year: number): number {
  const scenarioKey =
    {
      ssp119: "ssp1_1_9",
      ssp126: "ssp1_2_6",
      ssp245: "ssp2_4_5",
      ssp370: "ssp3_7_0",
      ssp585: "ssp5_8_5",
    }[scenario] ?? scenario;
  const factors = loadPrimaryGrid().calibration?.factors?.[scenarioKey];
  if (!factors) return 1.0;
  const decades = Object.keys(factors).map(Number).sort((a, b) => a - b);
  const y = clip(year, decades[0], decades[decades.length - 1]);
  const hi = decades.find((decade) => decade >= y) ?? decades[decades.length - 1];
  const lo = [...decades].reverse().find((decade) => decade <= y) ?? decades[0];
  const loFactor = Number(factors[String(lo)].k);
  const hiFactor = Number(factors[String(hi)].k);
  if (lo === hi) return loFactor;
  const t = (y - lo) / (hi - lo);
  return loFactor + t * (hiFactor - loFactor);
}

function primary(layer: string, scenario: string, variable: string, lat: number, lng: number, axisValue: number): number {
  return samplePrimaryLayer({ layer, scenario, variable }, lat, lng, axisValue);
}

function annualExtreme(index: "tr" | "cdd" | "rx5day", scenario: string, lat: number, lng: number, year: number): number {
  const baseline = primary("baseline-extreme", index, "clim", lat, lng, 0);
  const delta = primary(`extreme-${index}`, scenario, "mean", lat, lng, year);
  return Number.isNaN(baseline) || Number.isNaN(delta) ? Number.NaN : baseline + delta;
}

function wetBulbStullC(tempC: number, relativeHumidityPct: number): { wetBulb: number; formulaRh: number } {
  if (Number.isNaN(tempC) || Number.isNaN(relativeHumidityPct)) {
    return { wetBulb: Number.NaN, formulaRh: Number.NaN };
  }
  const physicalRh = clip(relativeHumidityPct, 0, 100);
  const formulaRh = clip(physicalRh, WET_BULB_RH_MIN, WET_BULB_RH_MAX);
  const wetBulb =
    tempC * Math.atan(0.151977 * Math.sqrt(formulaRh + 8.313659)) +
    Math.atan(tempC + formulaRh) -
    Math.atan(formulaRh - 1.676331) +
    0.00391838 * formulaRh ** 1.5 * Math.atan(0.023101 * formulaRh) -
    4.686035;
  return { wetBulb, formulaRh };
}

function monthName(values: number[], comparator: (a: number, b: number) => boolean): string | null {
  const finite = values.map((value, index) => ({ value, index })).filter((item) => Number.isFinite(item.value));
  if (finite.length === 0) return null;
  return MONTHS[finite.reduce((best, item) => (comparator(item.value, best.value) ? item : best), finite[0]).index];
}

export function projectClimate(lat: number, lng: number, year: number, scenario = DEFAULT_SCENARIO): Record<string, unknown> {
  const k = calibrationFactor(scenario, year);
  const temperatureDeltaRaw = primary("temperature", scenario, "mean", lat, lng, year);
  const temperatureStdRaw = primary("temperature", scenario, "std", lat, lng, year);
  const temperatureDeltaIpcc = temperatureDeltaRaw * k;
  const temperatureStdIpcc = temperatureStdRaw * k;
  const precipitationDelta = primary("precipitation", scenario, "mean", lat, lng, year);
  const precipitationStd = primary("precipitation", scenario, "std", lat, lng, year);
  const humidityDelta = primary("humidity", scenario, "mean", lat, lng, year);
  const humidityStd = primary("humidity", scenario, "std", lat, lng, year);
  const monthlyTemperature: number[] = [];
  const monthlyTemperatureIpcc: number[] = [];
  const monthlyPrecipitation: number[] = [];
  const monthlyRelativeHumidity: number[] = [];
  const monthlyWetBulb: number[] = [];
  const wetBulbFormulaRh: number[] = [];
  const observedTemperatureValues: number[] = [];
  const observedPrecipitationValues: number[] = [];
  let observedTemperatureMonths = 0;
  let observedPrecipitationMonths = 0;

  for (let month = 1; month <= 12; month++) {
    const modelTempBaseline = primary("baseline", "temperature", "clim", lat, lng, month);
    const modelPrecipBaseline = primary("baseline", "precipitation", "clim", lat, lng, month);
    const modelHumidityBaseline = primary("baseline", "humidity", "clim", lat, lng, month);
    const observedTempBaseline = sampleObservedBaseline("temperature", lat, lng, month);
    const observedPrecipBaseline = sampleObservedBaseline("precipitation", lat, lng, month);
    const tempBaseline = Number.isNaN(observedTempBaseline) ? modelTempBaseline : observedTempBaseline;
    const precipBaseline = Number.isNaN(observedPrecipBaseline) ? modelPrecipBaseline : observedPrecipBaseline;
    observedTemperatureMonths += Number.isNaN(observedTempBaseline) ? 0 : 1;
    observedPrecipitationMonths += Number.isNaN(observedPrecipBaseline) ? 0 : 1;
    if (!Number.isNaN(observedTempBaseline)) observedTemperatureValues.push(observedTempBaseline);
    if (!Number.isNaN(observedPrecipBaseline)) observedPrecipitationValues.push(observedPrecipBaseline);

    const monthlyTemp =
      Number.isNaN(tempBaseline) || Number.isNaN(temperatureDeltaRaw) ? Number.NaN : tempBaseline + temperatureDeltaRaw;
    const monthlyRh =
      Number.isNaN(modelHumidityBaseline) || Number.isNaN(humidityDelta)
        ? Number.NaN
        : clip(modelHumidityBaseline + humidityDelta, 0, 100);
    const { wetBulb, formulaRh } = wetBulbStullC(monthlyTemp, monthlyRh);

    monthlyTemperature.push(monthlyTemp);
    monthlyTemperatureIpcc.push(
      Number.isNaN(tempBaseline) || Number.isNaN(temperatureDeltaIpcc) ? Number.NaN : tempBaseline + temperatureDeltaIpcc,
    );
    monthlyPrecipitation.push(
      Number.isNaN(precipBaseline) || Number.isNaN(precipitationDelta)
        ? Number.NaN
        : precipBaseline * (1 + precipitationDelta / 100.0),
    );
    monthlyRelativeHumidity.push(monthlyRh);
    monthlyWetBulb.push(wetBulb);
    wetBulbFormulaRh.push(formulaRh);
  }

  const finiteTemperature = finiteValues(monthlyTemperature);
  const finiteTemperatureIpcc = finiteValues(monthlyTemperatureIpcc);
  const finitePrecipitation = finiteValues(monthlyPrecipitation);
  const finiteWetBulb = finiteValues(monthlyWetBulb);
  const annualMean = mean(finiteTemperature);
  const annualMeanIpcc = mean(finiteTemperatureIpcc);
  const annualTotal = sum(finitePrecipitation);
  const wetBulbMaxIndex =
    finiteWetBulb.length > 0
      ? monthlyWetBulb.reduce(
          (bestIndex, value, index) =>
            Number.isFinite(value) && (!Number.isFinite(monthlyWetBulb[bestIndex]) || value > monthlyWetBulb[bestIndex])
              ? index
              : bestIndex,
          0,
        )
      : null;
  const rhDomainClipped = monthlyRelativeHumidity.reduce((count, value, index) => {
    const formulaRh = wetBulbFormulaRh[index];
    return Number.isFinite(value) && Number.isFinite(formulaRh) && Math.abs(value - formulaRh) > 0.001 ? count + 1 : count;
  }, 0);
  const tempDomainWarningMonths = monthlyTemperature.reduce(
    (count, value) => (Number.isFinite(value) && (value < WET_BULB_TEMP_MIN || value > WET_BULB_TEMP_MAX) ? count + 1 : count),
    0,
  );

  const tropicalNights = annualExtreme("tr", scenario, lat, lng, year);
  const dryDays = annualExtreme("cdd", scenario, lat, lng, year);
  const fiveDayPrecip = annualExtreme("rx5day", scenario, lat, lng, year);
  const tropicalNightStd = primary("extreme-tr", scenario, "std", lat, lng, year);
  const dryDayStd = primary("extreme-cdd", scenario, "std", lat, lng, year);
  const fiveDayPrecipStd = primary("extreme-rx5day", scenario, "std", lat, lng, year);
  const heatNights = Number.isNaN(tropicalNights) ? null : Math.max(0, tropicalNights);
  const droughtRisk = Number.isNaN(dryDays) ? null : clip((100 * Math.max(0, dryDays)) / DROUGHT_MAX_CDD, 0, 100);
  const floodRisk = Number.isNaN(fiveDayPrecip) ? null : clip((100 * Math.max(0, fiveDayPrecip)) / FLOOD_MAX_RX5, 0, 100);

  const seaLevel = primary("sealevel", scenario, "median", lat, lng, year);
  const seaLevelLow = primary("sealevel", scenario, "low", lat, lng, year);
  const seaLevelHigh = primary("sealevel", scenario, "high", lat, lng, year);
  const seaLevelCm = Number.isNaN(seaLevel) ? null : seaLevel * 100.0;
  const seaLevelLowCm = Number.isNaN(seaLevelLow) ? null : seaLevelLow * 100.0;
  const seaLevelHighCm = Number.isNaN(seaLevelHigh) ? null : seaLevelHigh * 100.0;

  const temperatureSpread = Number.isNaN(temperatureStdRaw) ? null : Math.abs(temperatureStdRaw);
  const temperatureSpreadIpcc = Number.isNaN(temperatureStdIpcc) ? null : Math.abs(temperatureStdIpcc);
  const precipitationSpreadPct = Number.isNaN(precipitationStd) ? null : Math.abs(precipitationStd);
  const precipitationSpreadMm =
    annualTotal === null || precipitationSpreadPct === null ? null : annualTotal * precipitationSpreadPct / 100.0;

  const [score, breakdown] = habitability(annualMean, annualTotal, heatNights, droughtRisk, floodRisk);
  const observedSource = loadObservedGrid().source ?? {};
  let baselineTemperature =
    observedTemperatureMonths === 12 ? "WorldClim v2.1 observed 1970-2000" : "CMIP6 historical model baseline 1995-2014";
  let baselinePrecipitation =
    observedPrecipitationMonths === 12 ? "WorldClim v2.1 observed 1970-2000" : "CMIP6 historical model baseline 1995-2014";
  if (observedTemperatureMonths > 0 && observedTemperatureMonths < 12) {
    baselineTemperature = `mixed WorldClim observed (${observedTemperatureMonths}/12 months) + CMIP6 model fallback`;
  }
  if (observedPrecipitationMonths > 0 && observedPrecipitationMonths < 12) {
    baselinePrecipitation = `mixed WorldClim observed (${observedPrecipitationMonths}/12 months) + CMIP6 model fallback`;
  }

  return {
    location: {
      latitude: lat,
      longitude: lng,
      name: `Location ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      climate_zone: climateZone(lat),
    },
    year,
    scenario,
    temperature: {
      annual_mean: num(annualMean),
      monthly: monthlyTemperature.map(num),
      monthly_labels: MONTHS,
      anomaly: num(temperatureDeltaRaw),
      min: finiteTemperature.length > 0 ? num(Math.min(...finiteTemperature)) : null,
      max: finiteTemperature.length > 0 ? num(Math.max(...finiteTemperature)) : null,
      seasonal_amplitude:
        finiteTemperature.length > 0 ? num(Math.max(...finiteTemperature) - Math.min(...finiteTemperature)) : null,
      model_consensus: {
        annual_mean: num(annualMean),
        monthly: monthlyTemperature.map(num),
        anomaly: num(temperatureDeltaRaw),
        source: "raw CMIP6 ScenarioMIP ensemble mean",
        method: "observed or model monthly baseline plus raw CMIP6 ensemble anomaly",
      },
      ipcc_calibrated: {
        annual_mean: num(annualMeanIpcc),
        monthly: monthlyTemperatureIpcc.map(num),
        anomaly: num(temperatureDeltaIpcc),
        adjustment_c:
          Number.isNaN(temperatureDeltaIpcc) || Number.isNaN(temperatureDeltaRaw)
            ? null
            : num(temperatureDeltaIpcc - temperatureDeltaRaw),
        calibration_factor: num(k),
        uncertainty: {
          annual_mean_low:
            annualMeanIpcc !== null && temperatureSpreadIpcc !== null ? num(annualMeanIpcc - temperatureSpreadIpcc) : null,
          annual_mean_high:
            annualMeanIpcc !== null && temperatureSpreadIpcc !== null ? num(annualMeanIpcc + temperatureSpreadIpcc) : null,
          anomaly_spread: num(temperatureSpreadIpcc),
        },
        method: "same baseline plus CMIP6 ensemble anomaly scaled to IPCC AR6 assessed global warming ranges",
      },
      uncertainty: {
        annual_mean_low: annualMean !== null && temperatureSpread !== null ? num(annualMean - temperatureSpread) : null,
        annual_mean_high: annualMean !== null && temperatureSpread !== null ? num(annualMean + temperatureSpread) : null,
        anomaly_spread: num(temperatureSpread),
        method: "raw CMIP6 ensemble standard deviation around the uncalibrated ensemble anomaly",
      },
    },
    precipitation: {
      annual_total: num(annualTotal),
      monthly: monthlyPrecipitation.map(num),
      monthly_labels: MONTHS,
      anomaly_percent: num(precipitationDelta),
      wettest_month: finitePrecipitation.length > 0 ? num(Math.max(...finitePrecipitation)) : null,
      driest_month: finitePrecipitation.length > 0 ? num(Math.min(...finitePrecipitation)) : null,
      wettest_month_name: monthName(monthlyPrecipitation, (value, best) => value > best),
      driest_month_name: monthName(monthlyPrecipitation, (value, best) => value < best),
      uncertainty: {
        annual_total_low:
          annualTotal !== null && precipitationSpreadMm !== null ? num(Math.max(0, annualTotal - precipitationSpreadMm)) : null,
        annual_total_high: annualTotal !== null && precipitationSpreadMm !== null ? num(annualTotal + precipitationSpreadMm) : null,
        anomaly_percent_spread: num(precipitationSpreadPct),
        method: "CMIP6 ensemble standard deviation of precipitation percent change, converted to annual-total millimetres at this location",
      },
    },
    extremes: {
      heat_stress_days: heatNights === null ? null : Math.round(heatNights),
      drought_risk: num(droughtRisk),
      flood_risk: num(floodRisk),
      sea_level_rise_cm: num(seaLevelCm),
      detail: {
        tropical_nights_per_year: num(heatNights),
        consecutive_dry_days: num(Number.isNaN(dryDays) ? null : dryDays),
        max_5day_precip_mm: num(Number.isNaN(fiveDayPrecip) ? null : fiveDayPrecip),
        humid_heat: {
          max_monthly_mean_wet_bulb_c: wetBulbMaxIndex === null ? null : num(monthlyWetBulb[wetBulbMaxIndex]),
          max_month: wetBulbMaxIndex === null ? null : MONTHS[wetBulbMaxIndex],
          monthly_mean_wet_bulb_c: monthlyWetBulb.map(num),
          monthly_relative_humidity_percent: monthlyRelativeHumidity.map(num),
          relative_humidity_anomaly_percent_points: num(humidityDelta),
          relative_humidity_spread_percent_points: num(Number.isNaN(humidityStd) ? null : Math.abs(humidityStd)),
          relative_humidity_baseline_source: "CMIP6 historical model baseline 1995-2014",
          domain_clipped_months: rhDomainClipped,
          temperature_domain_warning_months: tempDomainWarningMonths,
          source_id: "stull-2011-wetbulb-approximation",
          method:
            "Stull 2011 empirical wet-bulb approximation from monthly mean air temperature and CMIP6 near-surface relative humidity; RH is physically clipped to 0-100% and formula-clipped to 5-99% if needed.",
          caveat:
            "Monthly mean wet-bulb is a humid-heat screening context only. It is not WBGT, a daily exceedance count, personal medical advice, or occupational-safety guidance.",
        },
        uncertainty: {
          tropical_nights_spread_days: num(Number.isNaN(tropicalNightStd) ? null : Math.abs(tropicalNightStd)),
          consecutive_dry_days_spread: num(Number.isNaN(dryDayStd) ? null : Math.abs(dryDayStd)),
          max_5day_precip_spread_mm: num(Number.isNaN(fiveDayPrecipStd) ? null : Math.abs(fiveDayPrecipStd)),
          sea_level_low_cm: num(seaLevelLowCm),
          sea_level_high_cm: num(seaLevelHighCm),
          method: "CMIP6 ETCCDI ensemble standard deviation for extremes; IPCC AR6 low/high range for sea level",
        },
        thresholds: {
          tropical_night_C: TROPICAL_NIGHT_T,
          drought_max_cdd: DROUGHT_MAX_CDD,
          flood_max_rx5_mm: FLOOD_MAX_RX5,
        },
      },
    },
    habitability: { score: roundOne(score), category: category(score), breakdown },
    metadata: {
      model: "fupit grounded engine (raw CMIP6 + IPCC AR6 context)",
      model_version: "grounded-v2",
      resolution: "1.0 degree",
      confidence: "raw CMIP6 ensemble spread with IPCC AR6 assessed ranges reported separately",
      data_source:
        "WorldClim v2.1 observed baseline where available + raw CMIP6 ScenarioMIP + IPCC AR6 temperature context + AR6 sea level + CMIP6 ETCCDI extremes",
      baseline:
        "WorldClim v2.1 10 arc-minute observed climatology (1970-2000) where available; CMIP6 1995-2014 model baseline fallback",
      baseline_source: {
        temperature: baselineTemperature,
        precipitation: baselinePrecipitation,
        humidity: "CMIP6 historical model monthly relative-humidity baseline 1995-2014",
        observed_period: observedSource.period,
        observed_resolution: observedSource.resolution,
        observed_citation: observedSource.citation,
        observed_temperature_months: observedTemperatureMonths,
        observed_precipitation_months: observedPrecipitationMonths,
        observed_annual_temperature_c: num(mean(observedTemperatureValues)),
        observed_annual_precipitation_mm: num(sum(observedPrecipitationValues)),
        delta_reference_period: "CMIP6 deltas are relative to 1995-2014; baseline-period difference is disclosed, not hidden",
      },
      projection_year_basis: describePrimaryLayerAxis({ layer: "temperature", scenario, variable: "mean" }, year),
      projection_method:
        "delta/change-factor; observed or model baseline + raw CMIP6 ensemble delta; IPCC assessed temperature calibration is contextual, not the hidden headline; serve-time risk thresholds",
      scenario,
      uncertainty: {
        temperature_anomaly_spread_c: num(temperatureSpread),
        temperature_ipcc_calibrated_anomaly_c: num(temperatureDeltaIpcc),
        temperature_ipcc_adjustment_c:
          Number.isNaN(temperatureDeltaIpcc) || Number.isNaN(temperatureDeltaRaw)
            ? null
            : num(temperatureDeltaIpcc - temperatureDeltaRaw),
        temperature_ipcc_calibration_factor: num(k),
        precipitation_anomaly_spread_pct: num(precipitationSpreadPct),
        relative_humidity_anomaly_spread_percent_points: num(Number.isNaN(humidityStd) ? null : Math.abs(humidityStd)),
        sea_level_low_cm: num(seaLevelLowCm),
        sea_level_high_cm: num(seaLevelHighCm),
        extreme_index_spread_source: "CMIP6 ETCCDI ensemble standard deviation",
      },
      source_trail: SOURCE_TRAIL,
    },
  };
}

export function climateTrajectory(lat: number, lng: number, years: number[], scenario = DEFAULT_SCENARIO): Record<string, unknown> {
  return {
    coordinates: { lat, lng },
    scenario,
    points: years.map((pointYear) => ({ year: pointYear, ...projectClimate(lat, lng, pointYear, scenario) })),
  };
}
