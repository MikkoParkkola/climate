import fs from "fs";
import path from "path";
import { z } from "zod";
import { MODEL_CACHE_VERSION, SOURCE_REGISTRY_VERSION } from "./model-cache-version";
import { assertSourceIdsRegistered } from "./source-registry";

const CLIMATE_TWIN_SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"] as const;
const CLIMATE_TWIN_SOURCE_IDS = [
  "worldclim-v2-1",
  "cmip6-scenariomip",
  "ipcc-ar6-temperature",
  "cmip6-etccdi",
  "curated-ranking-cities-v1",
] as const;

export const climateTwinQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  year: z.coerce.number().int().min(2024).max(2100),
  scenario: z.enum(CLIMATE_TWIN_SCENARIOS).default("ssp245"),
  catalog: z.string().min(1).max(40).default("current"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

type AnalogCandidate = {
  name: string;
  country: string;
  lat: number;
  lng: number;
  year: number;
  scenario: string;
  temperature: { annual_mean: number; monthly: number[] };
  precipitation: { annual_total: number; monthly: number[] };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number };
  metadata?: Record<string, unknown>;
};

type AnalogCatalog = {
  version: string;
  catalogYear: number;
  scenario: string;
  candidateCount: number;
  method: string;
  source: string;
  candidates: AnalogCandidate[];
};

type ProjectionSnapshot = {
  temperature: { annual_mean: number; monthly: number[] };
  precipitation: { annual_total: number; monthly: number[] };
  extremes: { heat_stress_days: number; drought_risk: number; flood_risk: number };
};

type ClimateTwinMatch = {
  candidate: AnalogCandidate;
  distance: number;
  distanceComponents: {
    monthlyTemperature: number;
    monthlyPrecipitation: number;
  };
  deltas: {
    annualTemperatureC: number;
    annualPrecipitationMm: number;
    heatStressDays: number;
    droughtRisk: number;
    floodRisk: number;
  };
};

type DistanceReference = {
  p50NearestNeighbor: number;
  p75NearestNeighbor: number;
  p90NearestNeighbor: number;
};

export type ClimateTwinResult = {
  target: {
    lat: number;
    lng: number;
    year: number;
    scenario: string;
  };
  catalog: {
    id: "current";
    version: string;
    year: number;
    scenario: string;
    candidateCount: number;
    comparedCount: number;
  };
  match: ClimateTwinMatch | null;
  alternatives: ClimateTwinMatch[];
  matchQuality: "close-catalog-match" | "moderate-catalog-match" | "distant-catalog-match" | "no-close-catalog-analog";
  noCloseAnalog: boolean;
  distanceReference: DistanceReference;
  sourceReceipt: {
    methodVersion: string;
    sourceRegistryVersion: string;
    sourceIds: string[];
    method: string;
    source: string;
    caveats: string[];
  };
};

let cachedCatalog: AnalogCatalog | undefined;

function catalogPath(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "public", "climate-analog-catalog.current.json"),
    path.resolve(import.meta.dirname, "..", "client", "public", "climate-analog-catalog.current.json"),
    path.resolve(process.cwd(), "dist", "public", "climate-analog-catalog.current.json"),
    path.resolve(process.cwd(), "client", "public", "climate-analog-catalog.current.json"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("climate analog catalog not found");
  }
  return found;
}

export function loadClimateAnalogCatalog(): AnalogCatalog {
  if (!cachedCatalog) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath(), "utf-8")) as AnalogCatalog;
    if (catalog.version !== "grounded-current-analogs-v1") {
      throw new Error(`analog catalog version mismatch: ${catalog.version}`);
    }
    if (!Array.isArray(catalog.candidates) || catalog.candidates.length !== catalog.candidateCount) {
      throw new Error("analog catalog candidate count mismatch");
    }
    assertSourceIdsRegistered([...CLIMATE_TWIN_SOURCE_IDS]);
    cachedCatalog = catalog;
  }
  return cachedCatalog;
}

function climateVector(monthlyTemps: number[], monthlyPrecip: number[]): number[] | null {
  if (monthlyTemps.length !== 12 || monthlyPrecip.length !== 12) return null;
  const values = [
    ...monthlyTemps,
    ...monthlyPrecip.map((value) => Math.log1p(Math.max(0, value))),
  ];
  return values.every(Number.isFinite) ? values : null;
}

function candidateClimateVector(candidate: AnalogCandidate): number[] | null {
  return climateVector(candidate.temperature.monthly, candidate.precipitation.monthly);
}

function sameCatalogPlace(candidate: AnalogCandidate, lat: number, lng: number): boolean {
  return Math.abs(candidate.lat - lat) < 0.15 && Math.abs(candidate.lng - lng) < 0.15;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next === undefined) return sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function rms(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function rounded(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function scoreVector(
  target: number[],
  candidate: number[],
  stds: number[],
): { distance: number; temperature: number; precipitation: number } {
  const zScores = candidate.map((value, i) => (target[i] - value) / stds[i]);
  return {
    distance: rms(zScores),
    temperature: rms(zScores.slice(0, 12)),
    precipitation: rms(zScores.slice(12)),
  };
}

function distanceReference(candidateRows: Array<{ vector: number[] }>, stds: number[]): DistanceReference {
  const nearestDistances: number[] = [];
  for (let i = 0; i < candidateRows.length; i++) {
    const target = candidateRows[i].vector;
    const nearest = candidateRows
      .filter((_, j) => j !== i)
      .map((row) => scoreVector(target, row.vector, stds).distance)
      .sort((a, b) => a - b)[0];
    if (Number.isFinite(nearest)) nearestDistances.push(nearest);
  }
  nearestDistances.sort((a, b) => a - b);
  return {
    p50NearestNeighbor: rounded(quantile(nearestDistances, 0.5)),
    p75NearestNeighbor: rounded(quantile(nearestDistances, 0.75)),
    p90NearestNeighbor: rounded(quantile(nearestDistances, 0.9)),
  };
}

function qualityFor(distance: number, reference: DistanceReference): ClimateTwinResult["matchQuality"] {
  if (!Number.isFinite(distance)) return "no-close-catalog-analog";
  if (distance <= reference.p50NearestNeighbor) return "close-catalog-match";
  if (distance <= reference.p75NearestNeighbor) return "moderate-catalog-match";
  if (distance <= reference.p90NearestNeighbor) return "distant-catalog-match";
  return "no-close-catalog-analog";
}

export function findClimateTwin(args: {
  catalog: AnalogCatalog;
  projection: ProjectionSnapshot;
  lat: number;
  lng: number;
  year: number;
  scenario: string;
  limit?: number;
}): ClimateTwinResult | null {
  const candidateRows = args.catalog.candidates
    .map((candidate) => ({ candidate, vector: candidateClimateVector(candidate) }))
    .filter((row): row is { candidate: AnalogCandidate; vector: number[] } => row.vector !== null);
  const target = climateVector(args.projection.temperature.monthly, args.projection.precipitation.monthly);
  if (!target || candidateRows.length === 0) return null;

  const dims = target.length;
  const means = Array.from({ length: dims }, (_, i) =>
    candidateRows.reduce((sum, row) => sum + row.vector[i], 0) / candidateRows.length,
  );
  const stds = means.map((mean, i) => {
    const variance = candidateRows.reduce((sum, row) => sum + (row.vector[i] - mean) ** 2, 0) / candidateRows.length;
    return Math.sqrt(variance) || 1;
  });

  const excludeSelf = args.year > args.catalog.catalogYear + 2;
  const matches = candidateRows
    .filter((row) => !(excludeSelf && sameCatalogPlace(row.candidate, args.lat, args.lng)))
    .map((row) => {
      const distance = scoreVector(target, row.vector, stds);
      return {
        candidate: row.candidate,
        distance: rounded(distance.distance),
        distanceComponents: {
          monthlyTemperature: rounded(distance.temperature),
          monthlyPrecipitation: rounded(distance.precipitation),
        },
        deltas: {
          annualTemperatureC: rounded(args.projection.temperature.annual_mean - row.candidate.temperature.annual_mean, 2),
          annualPrecipitationMm: rounded(args.projection.precipitation.annual_total - row.candidate.precipitation.annual_total, 1),
          heatStressDays: rounded(args.projection.extremes.heat_stress_days - row.candidate.extremes.heat_stress_days, 1),
          droughtRisk: rounded(args.projection.extremes.drought_risk - row.candidate.extremes.drought_risk, 1),
          floodRisk: rounded(args.projection.extremes.flood_risk - row.candidate.extremes.flood_risk, 1),
        },
      };
    })
    .sort((a, b) => a.distance - b.distance);

  const reference = distanceReference(candidateRows, stds);
  const limit = Math.max(1, Math.min(10, args.limit ?? 5));
  const alternatives = matches.slice(0, limit);
  const match = alternatives[0] ?? null;
  const matchQuality = match ? qualityFor(match.distance, reference) : "no-close-catalog-analog";

  return {
    target: {
      lat: args.lat,
      lng: args.lng,
      year: args.year,
      scenario: args.scenario,
    },
    catalog: {
      id: "current",
      version: args.catalog.version,
      year: args.catalog.catalogYear,
      scenario: args.catalog.scenario,
      candidateCount: args.catalog.candidateCount,
      comparedCount: matches.length,
    },
    match,
    alternatives,
    matchQuality,
    noCloseAnalog: matchQuality === "no-close-catalog-analog",
    distanceReference: reference,
    sourceReceipt: {
      methodVersion: MODEL_CACHE_VERSION,
      sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
      sourceIds: [...CLIMATE_TWIN_SOURCE_IDS],
      method: args.catalog.method,
      source: args.catalog.source,
      caveats: [
        "Catalog is bounded to curated indexed cities and is not a complete global analog search.",
        "Distance is a method-specific standardized monthly temperature plus log precipitation distance, not a probability.",
        "Candidate climates are current-day catalog projections; future target scenario controls only the queried location.",
      ],
    },
  };
}
