import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MODEL_CACHE_VERSION, SOURCE_REGISTRY_VERSION } from "./model-cache-version";
import { loadSourceRegistry } from "./source-registry";

type RankingArtifact = {
  methodVersion: string;
  sourceRegistryVersion: string;
  generatedAt: string;
  catalog: string;
  entries: Array<{
    catalog: string;
    catalogSize: number;
    scenario: string;
    year: number;
    metric: string;
    direction: string;
    caveats: string[];
    sourceIds: string[];
  }>;
};

type TrajectoryAuditSummary = {
  version: string;
  generatedAt: string;
  baselineYear: number;
  maxYear: number;
  yearCount: number;
  scenarios: string[];
  cityCount: number;
  resultCount: number;
  trendReview: Array<{ scenario: string; name: string; flags: string[] }>;
  note: string;
};

type ObservedBaselineAudit = {
  version: string;
  generatedAt: string;
  source: string;
  checkedYear: number;
  scenario: string;
  cityCount: number;
  maxTemperatureDifferenceC: number;
  maxPrecipitationDifferenceMm: number;
  note: string;
};

let cachedDataQuality: Record<string, unknown> | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(dataPath(relativePath), "utf-8")) as T;
}

function artifactInfo(relativePath: string) {
  const filePath = dataPath(relativePath);
  const bytes = fs.readFileSync(filePath);
  return {
    path: relativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function uniqueSorted<T>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => String(a).localeCompare(String(b)));
}

function trendFlagKind(flag: string): string {
  return flag.split("=")[0];
}

function countTrendFlags(trendReview: Array<{ flags: string[] }>): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of trendReview) {
    for (const flag of item.flags) {
      const kind = trendFlagKind(flag);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => ({ kind, count }));
}

export function loadDataQuality(): Record<string, unknown> {
  if (cachedDataQuality) return cachedDataQuality;

  const registry = loadSourceRegistry() as ReturnType<typeof loadSourceRegistry> & { policy?: string };
  const primaryManifest = readJson<{
    format: string;
    encoding: string;
    methodVersion: string;
    cacheVersion: string;
    sourceRegistryVersion: string;
    defaultScenario: string;
    defaultScenarioPolicyVersion: string;
    defaultScenarioPolicyBasis: string;
    supportedFullForecastScenarios: string[];
    artifactHashes?: Record<string, string>;
    grid: { nlat: number; nlon: number; dlat: number; dlon: number };
    layers: unknown[];
    binary: string;
    decoded_bytes: number;
  }>("data/manifest.json");
  const observedManifest = readJson<{
    format: string;
    grid: { nlat: number; nlon: number; dlat: number; dlon: number };
    layers: unknown[];
    binary: string;
    decoded_bytes: number;
    source?: { name?: string; period?: string; resolution?: string; citation?: string };
  }>("data/worldclim10m.manifest.json");
  const rankingCities = readJson<Array<unknown>>("data/ranking_cities.json");
  const rankings = readJson<RankingArtifact>("data/rankings.curated-cities.json");
  const audit = readJson<TrajectoryAuditSummary>("data/trajectory-audit-summary.json");
  const observedBaselineAudit = readJson<ObservedBaselineAudit>("data/observed-baseline-audit.json");
  const rankingYears = uniqueSorted(rankings.entries.map((entry) => entry.year));
  const rankingSourceIds = uniqueSorted(rankings.entries.flatMap((entry) => entry.sourceIds));

  cachedDataQuality = {
    version: "data-quality-v1",
    generatedAt: new Date().toISOString(),
    methodVersion: MODEL_CACHE_VERSION,
    sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
    artifacts: [
      artifactInfo("data/grid.i16.gz"),
      artifactInfo("data/manifest.json"),
      artifactInfo("data/worldclim10m.i16.gz"),
      artifactInfo("data/worldclim10m.manifest.json"),
      artifactInfo("data/source-registry.json"),
      artifactInfo("data/rankings.curated-cities.json"),
      artifactInfo("data/trajectory-audit-summary.json"),
      artifactInfo("data/observed-baseline-audit.json"),
    ],
    sourceRegistry: {
      version: registry.version,
      generatedAt: registry.generatedAt,
      rowCount: registry.rows.length,
      policy: registry.policy,
      rows: registry.rows.map((row) => ({
        sourceId: row.sourceId,
        provider: row.provider,
        displayPolicy: row.displayPolicy,
        variables: row.variables,
      })),
    },
    grids: {
      primary: {
        format: primaryManifest.format,
        encoding: primaryManifest.encoding,
        methodVersion: primaryManifest.methodVersion,
        cacheVersion: primaryManifest.cacheVersion,
        sourceRegistryVersion: primaryManifest.sourceRegistryVersion,
        binary: primaryManifest.binary,
        layerCount: primaryManifest.layers.length,
        decodedBytes: primaryManifest.decoded_bytes,
        resolution: `${Math.abs(primaryManifest.grid.dlat)} degree`,
        cells: primaryManifest.grid.nlat * primaryManifest.grid.nlon,
        artifactHash: primaryManifest.artifactHashes?.[primaryManifest.binary],
      },
      observedBaseline: {
        format: observedManifest.format,
        binary: observedManifest.binary,
        layerCount: observedManifest.layers.length,
        decodedBytes: observedManifest.decoded_bytes,
        resolution: observedManifest.source?.resolution ?? `${Math.abs(observedManifest.grid.dlat)} degree`,
        period: observedManifest.source?.period,
        citation: observedManifest.source?.citation,
        cells: observedManifest.grid.nlat * observedManifest.grid.nlon,
      },
    },
    defaultScenarioPolicy: {
      scenario: primaryManifest.defaultScenario,
      policyVersion: primaryManifest.defaultScenarioPolicyVersion,
      basis: primaryManifest.defaultScenarioPolicyBasis,
      supportedFullForecastScenarios: primaryManifest.supportedFullForecastScenarios,
      gridHash: primaryManifest.artifactHashes?.[primaryManifest.binary],
    },
    rankings: {
      artifactGeneratedAt: rankings.generatedAt,
      catalog: rankings.catalog,
      catalogSize: rankingCities.length,
      entryCount: rankings.entries.length,
      scenarios: uniqueSorted(rankings.entries.map((entry) => entry.scenario)),
      yearRange: [rankingYears[0], rankingYears[rankingYears.length - 1]],
      metrics: uniqueSorted(rankings.entries.map((entry) => entry.metric)),
      directions: uniqueSorted(rankings.entries.map((entry) => entry.direction)),
      sourceIds: rankingSourceIds,
      caveats: uniqueSorted(rankings.entries.flatMap((entry) => entry.caveats)),
    },
    trajectoryAudit: {
      artifactGeneratedAt: audit.generatedAt,
      version: audit.version,
      cityCount: audit.cityCount,
      scenarioCount: audit.scenarios.length,
      scenarios: audit.scenarios,
      yearRange: [audit.baselineYear, audit.maxYear],
      yearCount: audit.yearCount,
      resultCount: audit.resultCount,
      trendReviewCount: audit.trendReview.length,
      trendReview: audit.trendReview,
      note: audit.note,
    },
    observedBaselineAudit: {
      artifactGeneratedAt: observedBaselineAudit.generatedAt,
      version: observedBaselineAudit.version,
      source: observedBaselineAudit.source,
      checkedYear: observedBaselineAudit.checkedYear,
      scenario: observedBaselineAudit.scenario,
      cityCount: observedBaselineAudit.cityCount,
      maxTemperatureDifferenceC: observedBaselineAudit.maxTemperatureDifferenceC,
      maxPrecipitationDifferenceMm: observedBaselineAudit.maxPrecipitationDifferenceMm,
      note: observedBaselineAudit.note,
    },
    validationReport: {
      repoPath: "docs/VALIDATION_REPORT.md",
      status: "trajectory-audit and WorldClim baseline cross-check published; observation-backed historical hindcast pending",
      artifactGeneratedAt: audit.generatedAt,
      historicalObservationHindcast: "pending",
      observedBaselineCrossCheck: "passed",
      trendReviewCount: audit.trendReview.length,
      trendReviewSummary: countTrendFlags(audit.trendReview),
      blockers: [
        "No NOAA/ERA5/station historical projection-vs-observation hindcast matrix is packaged yet.",
        "Trend-review flags require explanation or science review before they can be treated as resolved.",
      ],
    },
    executableChecks: [
      "npm run validate:artifacts",
      "npm run smoke:grid-reader",
      "npm run smoke:node-model",
      "npm run smoke:node-performance",
      "npm run smoke:observed-baseline",
      "npm run smoke:model",
      "npm run smoke:validation-report",
      "npm run audit:observed-baseline",
      "npm run audit:trajectories",
      "npm run ci",
    ],
    limitations: [
      "This dashboard describes the packaged artifact bundle. It does not prove the public Replit deployment is current.",
      "Production climate_model_cache still requires purge or live version-guard proof after deployment.",
      "Curated-city rankings are bounded examples, not complete global or country rankings.",
      "Trend review flags are intentionally visible for scientific review and are not automatically hidden by green CI.",
      "Freshwater, biodiversity, agriculture, infrastructure, and quantified AMOC local-impact layers remain withheld until source-registry approval and implementation.",
    ],
  };

  return cachedDataQuality;
}
