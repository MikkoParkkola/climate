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
  catalogLabel?: string;
  entries: Array<{
    catalog: string;
    catalogSize: number;
    placeSampleSize?: number;
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

type CoastalProximityArtifact = {
  catalog: string;
  label: string;
  version: string;
  sourceId: string;
  generatedAt: string;
  coastalThresholdKm: number;
  nearCoastalThresholdKm: number;
  regionalThresholdKm: number;
  method: string;
  caveats: string[];
  lineCount: number;
  pointCount: number;
};

const ENRICHMENT_READINESS = [
  {
    key: "humid_heat",
    label: "Humid heat",
    status: "partial",
    publicBehavior: "Shown as max monthly mean wet-bulb screen in the result page and API detail.",
    groundedBasis: "CMIP6 monthly relative humidity baseline plus scenario delta, projected monthly temperature, Stull 2011 wet-bulb approximation.",
    missingForFullUse: "No daily/hourly humid-heat exceedance days, no WBGT, no wind, sun/radiation, exposure, or occupational-safety model.",
  },
  {
    key: "sea_level_local_relevance",
    label: "Sea-level local relevance",
    status: "partial",
    publicBehavior: "Shown as AR6 regional sea-level context with Natural Earth nearest-coast wording gate.",
    groundedBasis: "IPCC/NASA AR6 sea-level layer plus Natural Earth 1:110m coastline proximity artifact.",
    missingForFullUse: "No elevation, tides, storm surge, subsidence, defenses, rivers, drainage, or parcel exposure.",
  },
  {
    key: "amoc_context",
    label: "AMOC/Gulf Stream",
    status: "context-only",
    publicBehavior: "Shown only as regional IPCC AR6 context where relevant.",
    groundedBasis: "IPCC AR6 WGI assessment language.",
    missingForFullUse: "No deterministic local cooling/warming correction, collapse timing, or local impact layer.",
  },
  {
    key: "freshwater",
    label: "Freshwater availability",
    status: "withheld",
    publicBehavior: "Not shown as a quantified metric.",
    groundedBasis: "No registered freshwater risk artifact in this build.",
    missingForFullUse: "Needs legally compatible basin/aquifer/runoff/storage/demand indicator with source-registry approval.",
  },
  {
    key: "cold_stress",
    label: "Cold stress",
    status: "withheld",
    publicBehavior: "Not shown as cold-stress days.",
    groundedBasis: "Monthly temperature is shown, but no daily Tmin/frost/ice-day source is packaged.",
    missingForFullUse: "Needs grounded daily cold extreme indices or observed/future cold-stress layer.",
  },
  {
    key: "fire_weather",
    label: "Fire weather",
    status: "withheld",
    publicBehavior: "Not shown as a quantified fire-weather metric.",
    groundedBasis: "No registered fire-weather artifact in this build.",
    missingForFullUse: "Needs humidity, wind, precipitation/drought, fuel/aridity method and source-registry approval.",
  },
  {
    key: "food_agriculture",
    label: "Food and agriculture",
    status: "withheld",
    publicBehavior: "Not shown as crop yield or food-supply impact.",
    groundedBasis: "No registered crop, growing-degree, soil, irrigation, or yield artifact in this build.",
    missingForFullUse: "Needs crop/soil/water datasets and explicit non-advisory interpretation.",
  },
  {
    key: "infrastructure",
    label: "Infrastructure pressure",
    status: "withheld",
    publicBehavior: "Not shown as engineering exposure or asset-risk score.",
    groundedBasis: "The current score has only a fixed adaptation allowance, not local infrastructure data.",
    missingForFullUse: "Needs local infrastructure, design thresholds, drainage, grid, transport, or asset datasets.",
  },
  {
    key: "biodiversity",
    label: "Biodiversity pressure",
    status: "withheld",
    publicBehavior: "Mentioned only as educational context, not quantified.",
    groundedBasis: "No registered species/habitat/ecoregion transition artifact in this build.",
    missingForFullUse: "Needs legally compatible biodiversity or habitat-pressure dataset with transparent proxy limits.",
  },
] as const;

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

function loadRankingArtifacts(): RankingArtifact[] {
  return [
    "data/rankings.curated-cities.json",
    "data/rankings.natural-earth-populated-places.json",
    "data/rankings.natural-earth-country-population-weighted.json",
  ].map((relativePath) => readJson<RankingArtifact>(relativePath));
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
    defaultScenarioPolicySourceIds: string[];
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
  const rankingArtifacts = loadRankingArtifacts();
  const audit = readJson<TrajectoryAuditSummary>("data/trajectory-audit-summary.json");
  const observedBaselineAudit = readJson<ObservedBaselineAudit>("data/observed-baseline-audit.json");
  const coastalProximity = readJson<CoastalProximityArtifact>("client/public/coastal-proximity.natural-earth-110m.json");
  const rankingEntries = rankingArtifacts.flatMap((artifact) => artifact.entries);
  const rankingYears = uniqueSorted(rankingEntries.map((entry) => entry.year));
  const rankingSourceIds = uniqueSorted(rankingEntries.flatMap((entry) => entry.sourceIds));
  const rankingCatalogs = rankingArtifacts.map((artifact) => {
    const first = artifact.entries[0];
    const years = uniqueSorted(artifact.entries.map((entry) => entry.year));
    return {
      catalog: artifact.catalog,
      label: artifact.catalogLabel ?? artifact.catalog,
      artifactGeneratedAt: artifact.generatedAt,
      catalogSize: first?.catalogSize ?? 0,
      entryCount: artifact.entries.length,
      yearRange: [years[0], years[years.length - 1]],
      metrics: uniqueSorted(artifact.entries.map((entry) => entry.metric)),
      sourceIds: uniqueSorted(artifact.entries.flatMap((entry) => entry.sourceIds)),
      caveats: uniqueSorted(artifact.entries.flatMap((entry) => entry.caveats)),
    };
  });

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
      artifactInfo("data/population-centers.natural-earth-110m.json"),
      artifactInfo("data/rankings.curated-cities.json"),
      artifactInfo("data/rankings.natural-earth-populated-places.json"),
      artifactInfo("data/rankings.natural-earth-country-population-weighted.json"),
      artifactInfo("data/trajectory-audit-summary.json"),
      artifactInfo("data/observed-baseline-audit.json"),
      artifactInfo("client/public/coastal-proximity.natural-earth-110m.json"),
    ],
    sourceRegistry: {
      version: registry.version,
      generatedAt: registry.generatedAt,
      rowCount: registry.rows.length,
      policy: registry.policy,
      rows: registry.rows.map((row) => ({
        sourceId: row.sourceId,
        provider: row.provider,
        version: row.version,
        stableUrl: row.stableUrl,
        citation: row.citation,
        license: row.license,
        commercialReuse: row.commercialReuse,
        redistribution: row.redistribution,
        displayPolicy: row.displayPolicy,
        variables: row.variables,
        spatialResolution: row.spatialResolution,
        temporalResolution: row.temporalResolution,
        scenarioCoverage: row.scenarioCoverage,
        method: row.method,
        reviewedAt: row.reviewedAt,
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
      sourceIds: primaryManifest.defaultScenarioPolicySourceIds,
      supportedFullForecastScenarios: primaryManifest.supportedFullForecastScenarios,
      gridHash: primaryManifest.artifactHashes?.[primaryManifest.binary],
    },
    rankings: {
      catalog: "multiple_bounded_catalogs",
      catalogSize: rankingCatalogs.reduce((total, catalog) => total + catalog.catalogSize, 0),
      catalogCount: rankingCatalogs.length,
      catalogs: rankingCatalogs,
      entryCount: rankingEntries.length,
      scenarios: uniqueSorted(rankingEntries.map((entry) => entry.scenario)),
      yearRange: [rankingYears[0], rankingYears[rankingYears.length - 1]],
      metrics: uniqueSorted(rankingEntries.map((entry) => entry.metric)),
      directions: uniqueSorted(rankingEntries.map((entry) => entry.direction)),
      sourceIds: rankingSourceIds,
      caveats: uniqueSorted(rankingEntries.flatMap((entry) => entry.caveats)),
    },
    coastalProximity: {
      catalog: coastalProximity.catalog,
      label: coastalProximity.label,
      version: coastalProximity.version,
      sourceId: coastalProximity.sourceId,
      artifactGeneratedAt: coastalProximity.generatedAt,
      lineCount: coastalProximity.lineCount,
      pointCount: coastalProximity.pointCount,
      thresholdsKm: {
        coastal: coastalProximity.coastalThresholdKm,
        nearCoastal: coastalProximity.nearCoastalThresholdKm,
        regional: coastalProximity.regionalThresholdKm,
      },
      method: coastalProximity.method,
      caveats: coastalProximity.caveats,
    },
    enrichmentReadiness: ENRICHMENT_READINESS,
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
      "Ranking catalogs are bounded examples: curated cities, Natural Earth populated places, and Natural Earth-derived country aggregates; they are not complete GHSL urban-center, full national exposure, rural exposure, or population-weighted exposure rankings.",
      "Sea-level context now uses a Natural Earth 1:110m nearest-coast screen for coarse relevance copy, but still has no elevation, tides, storm surge, subsidence, defenses, rivers, drainage, or parcel-exposure model.",
      "Trend review flags are intentionally visible for scientific review and are not automatically hidden by green CI.",
      "Freshwater, biodiversity, agriculture, infrastructure, and quantified AMOC local-impact layers remain withheld until source-registry approval and implementation.",
    ],
  };

  return cachedDataQuality;
}
