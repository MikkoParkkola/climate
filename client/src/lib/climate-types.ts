// ── Shared types for the climate app (extracted from climate-app.tsx) ──

export type ScenarioId = "ssp126" | "ssp245" | "ssp370" | "ssp585";

export type CoastCoord = [number, number];

export interface LocationOption {
  name: string;
  lat: number;
  lng: number;
  country: string;
  city: string;
  state?: string;
}

export interface ProjectionPoint {
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

export interface AnalogCandidate {
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

export interface AnalogCatalog {
  version: string;
  catalogYear: number;
  scenario: ScenarioId;
  candidateCount: number;
  method: string;
  source: string;
  candidates: AnalogCandidate[];
}

export interface CoastalProximityArtifact {
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

export interface CoastalRelevance {
  status: "loading" | "unavailable" | "coastal" | "near_coastal" | "regional" | "inland";
  label: string;
  shortLabel: string;
  summary: string;
  receipt: string;
  thresholdLabel: string;
  isLocallyRelevant: boolean;
  distanceKm?: number;
}

// ── Coverage status (why an enrichment is shown, substituted, or withheld) ──
// Backend contract: each enrichment may carry a coverageStatus; when the
// enrichment object itself is null, the same shape may arrive on a top-level
// coverage map keyed by enrichment. All fields optional so the UI degrades
// gracefully when the backend has not yet populated them.
export type CoverageStatusKind =
  | "available"
  | "unavailable_scenario"
  | "unavailable_location"
  | "withheld";

export interface CoverageNearestScenario {
  scenario: string;
  value?: number | string | null;
  note?: string;
}

export interface CoverageStatus {
  status: CoverageStatusKind;
  reason?: string;
  servedScenario?: string;
  nearestScenario?: CoverageNearestScenario | null;
}

// Top-level coverage map (used when the enrichment object is null but the
// backend still wants to explain the gap). Keys mirror the response fields.
export interface EnrichmentCoverage {
  freshwater?: CoverageStatus | null;
  crops?: CoverageStatus | null;
  floods?: CoverageStatus | null;
  fireWeather?: CoverageStatus | null;
  humidHeat?: CoverageStatus | null;
  coldSeason?: CoverageStatus | null;
  degreeDays?: CoverageStatus | null;
}

// AMOC / Gulf Stream qualitative risk assessment (IPCC AR6 + literature).
// Deliberately not a local number — bounded, citation-backed regional context.
export interface AmocCitation {
  label?: string;
  source?: string;
  citation?: string;
  url?: string;
}

export interface AmocAssessment {
  regionRelevant: boolean;
  status?: string;
  weakeningAssessment?: string;
  collapseRisk?: string;
  europeImpact?: string;
  citations?: Array<AmocCitation | string>;
}

export interface FreshwaterHorizon {
  year: number;
  category: number | null;
  label: string | null;
  score: number | null;
  rawRatio: number | null;
}

export interface FreshwaterStress {
  sourceId: string;
  version: string;
  indicator: string;
  indicatorLabel: string;
  attribution: string;
  license: string;
  stableUrl: string;
  scenario: string;
  aqueductScenario: string;
  aqueductScenarioLabel: string;
  pfafId: number | null;
  fallbackRings: number;
  horizons: FreshwaterHorizon[];
  method: string;
  caveats: string[];
  coverageStatus?: CoverageStatus | null;
}

export interface FireWeatherHorizon {
  year: number;
  window: string | null;
  extremeFireWeatherDays: number | null;
  fireSeasonLengthDays: number | null;
}

export interface FireWeather {
  sourceId: string;
  version: string;
  indicator: string;
  indicatorLabel: string;
  attribution: string;
  license: string;
  stableUrl: string;
  scenario: string;
  scenarioLabel: string;
  modelCount: number;
  fallbackRings: number;
  horizons: FireWeatherHorizon[];
  method: string;
  caveats: string[];
  coverageStatus?: CoverageStatus | null;
}

export interface FloodHorizon {
  year: number;
  floodedFraction: number;
  meanFloodDepth: number | null;
}

export interface FloodExposure {
  sourceId: string;
  version: string;
  indicator: string;
  indicatorLabel: string;
  attribution: string;
  license: string;
  stableUrl: string;
  returnPeriod: string;
  scenario: string;
  aqueductScenario: string;
  aqueductScenarioLabel: string;
  modelCount: number;
  horizons: FloodHorizon[];
  method: string;
  caveats: string[];
  coverageStatus?: CoverageStatus | null;
}

export interface CropHorizon {
  year: number;
  yieldChangePercent: number | null;
}

export interface CropSeries {
  crop: string;
  label: string;
  horizons: CropHorizon[];
}

export interface CropYield {
  sourceId: string;
  version: string;
  indicator: string;
  indicatorLabel: string;
  attribution: string;
  license: string;
  stableUrl: string;
  scenario: string;
  scenarioLabel: string;
  modelCount: number;
  baselinePeriod: string;
  crops: CropSeries[];
  method: string;
  caveats: string[];
  coverageStatus?: CoverageStatus | null;
}

export interface ClimateAnalogMatch {
  candidate: AnalogCandidate;
  distance: number;
  comparedCount: number;
  annualTempDelta: number;
  annualPrecipDelta: number;
  heatDaysDelta: number;
  droughtDelta: number;
  floodDelta: number;
}

export interface ScenarioContrastRow {
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

export interface RoadmapItem {
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

export interface ShareStory {
  headline: string;
  metricLine: string;
  driverLine: string;
  analogLine: string;
  caveat: string;
  text: string;
  clipboardText: string;
}

export type LearningPromptAction = "pathways" | "twin" | "comparison";

export interface LearningPrompt {
  eyebrow: string;
  question: string;
  detail: string;
  action: LearningPromptAction;
  actionLabel: string;
  receipt: string;
  disabled?: boolean;
}

export interface TrendZone {
  from: number;
  to: number;
  color: string;
}
