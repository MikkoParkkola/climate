#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionsSource = readFileSync(path.join(repoRoot, "server", "model-cache-version.ts"), "utf8");
const modelVersion = versionsSource.match(/MODEL_CACHE_VERSION\s*=\s*"([^"]+)"/)?.[1];
const sourceRegistryVersion = versionsSource.match(/SOURCE_REGISTRY_VERSION\s*=\s*"([^"]+)"/)?.[1];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(path.join(repoRoot, relativePath))).digest("hex");
}

for (const relativePath of [
  "data/grid.i16.gz",
  "data/worldclim10m.i16.gz",
  "data/manifest.json",
  "data/worldclim10m.manifest.json",
  "data/source-registry.json",
  "data/population-centers.natural-earth-110m.json",
  "data/rankings.curated-cities.json",
  "data/rankings.natural-earth-populated-places.json",
  "data/rankings.natural-earth-country-population-weighted.json",
  "data/trajectory-audit-summary.json",
  "data/observed-baseline-audit.json",
  "data/observed-climatology-validation.nasa-power.json",
  "data/freshwater-stress.aqueduct40.json",
  "data/freshwater-stress.aqueduct40.u16.gz",
  "data/amoc-collapse.json",
  "data/amoc-collapse.i16.gz",
  "data/fire-weather.quilcaille2023.json",
  "data/fire-weather.quilcaille2023.u16.gz",
  "data/flood-river.aqueduct.json",
  "data/flood-river.aqueduct.u16.gz",
  "data/crop-yield.isimip-ggcmi.json",
  "data/crop-yield.isimip-ggcmi.u16.gz",
  "data/nex-gddp.json",
  "data/nex-gddp.u16.gz",
  "docs/VALIDATION_REPORT.md",
  "client/public/climate-analog-catalog.current.json",
  "client/public/coastal-proximity.natural-earth-110m.json",
]) {
  assert(existsSync(path.join(repoRoot, relativePath)), `${relativePath} missing`);
  assert(statSync(path.join(repoRoot, relativePath)).size > 0, `${relativePath} is empty`);
}

const registry = readJson("data/source-registry.json");
assert(registry.version === sourceRegistryVersion, "source registry version mismatch");
assert(Array.isArray(registry.rows) && registry.rows.length >= 10, "source registry rows incomplete");
const sourceIds = new Set(registry.rows.map((row) => row.sourceId));
assert(sourceIds.has("stull-2011-wetbulb-approximation"), "Stull wet-bulb method source row missing");
assert(sourceIds.has("ipcc-ar6-amoc"), "AMOC/Gulf Stream context source row missing");
assert(sourceIds.has("natural-earth-coastline-110m-v5"), "Natural Earth coastline source row missing");
assert(sourceIds.has("natural-earth-populated-places-110m-v5"), "Natural Earth population-place source row missing");
assert(sourceIds.has("natural-earth-country-population-weighted-v1"), "Natural Earth country aggregate source row missing");
assert(sourceIds.has("wri-aqueduct-40-water-stress-v1"), "WRI Aqueduct freshwater source row missing");
assert(sourceIds.has("nahosmip-amoc-collapse-v1"), "NAHosMIP AMOC-collapse source row missing");
assert(sourceIds.has("nasa-power-meteorology-monthly-v10"), "NASA POWER observed-climatology validation source row missing");
const requireRegisteredSources = (ids, context) => {
  assert(Array.isArray(ids) && ids.length > 0, `${context} source ids missing`);
  for (const sourceId of ids) {
    assert(sourceIds.has(sourceId), `${context} uses unregistered source id ${sourceId}`);
  }
};
const getSourceRow = (sourceId) => registry.rows.find((row) => row.sourceId === sourceId);
assert(
  getSourceRow("stull-2011-wetbulb-approximation")?.displayPolicy === "show-as-derived-screening-context-not-advice",
  "Stull wet-bulb method row must be displayed as screening context, not advice",
);

const manifest = readJson("data/manifest.json");
assert(manifest.methodVersion === modelVersion, "grid manifest method version mismatch");
assert(manifest.cacheVersion === modelVersion, "grid manifest cache version mismatch");
assert(manifest.sourceRegistryVersion === sourceRegistryVersion, "grid manifest source registry version mismatch");
assert(manifest.defaultScenario === "ssp245", "grid manifest default scenario mismatch");
assert(manifest.defaultScenarioPolicyVersion === "current-policy-reference-2025", "grid manifest default scenario policy version missing");
assert(
  typeof manifest.defaultScenarioPolicyBasis === "string" &&
    manifest.defaultScenarioPolicyBasis.includes("UNEP current-policy") &&
    manifest.defaultScenarioPolicyBasis.includes("Climate Action Tracker") &&
    manifest.defaultScenarioPolicyBasis.includes("not a prediction or hidden scenario average"),
  "grid manifest default scenario policy basis incomplete",
);
assert(
  JSON.stringify(manifest.defaultScenarioPolicySourceIds) ===
    JSON.stringify(["unep-egr-2025-current-policies", "cat-2025-warming-projections"]),
  "grid manifest default scenario policy source ids mismatch",
);
requireRegisteredSources(manifest.defaultScenarioPolicySourceIds, "default scenario policy");
for (const sourceId of manifest.defaultScenarioPolicySourceIds) {
  assert(
    getSourceRow(sourceId)?.displayPolicy === "show-as-policy-context-no-local-correction",
    `default scenario policy source ${sourceId} must be policy context only`,
  );
}
assert(
  JSON.stringify(manifest.supportedFullForecastScenarios) === JSON.stringify(["ssp126", "ssp245", "ssp370", "ssp585"]),
  "grid manifest supported full-forecast scenarios mismatch",
);
assert(
  manifest.artifactHashes?.["grid.i16.gz"] === `sha256:${sha256("data/grid.i16.gz")}`,
  "grid artifact hash mismatch",
);

const populatedPlaces = readJson("data/population-centers.natural-earth-110m.json");
assert(populatedPlaces.catalog === "natural_earth_populated_places_110m", "Natural Earth catalog id mismatch");
assert(populatedPlaces.sourceId === "natural-earth-populated-places-110m-v5", "Natural Earth catalog source id mismatch");
assert(populatedPlaces.populationThreshold === 3000000, "Natural Earth population threshold mismatch");
assert(Array.isArray(populatedPlaces.places) && populatedPlaces.places.length >= 50, "Natural Earth places missing");
for (const place of populatedPlaces.places) {
  assert(Number.isFinite(place.lat) && Number.isFinite(place.lng), "Natural Earth place coordinates invalid");
  assert(Number.isFinite(place.population) && place.population >= populatedPlaces.populationThreshold, "Natural Earth place population invalid");
}

const coastline = readJson("client/public/coastal-proximity.natural-earth-110m.json");
assert(coastline.catalog === "natural_earth_coastline_110m", "Natural Earth coastline catalog id mismatch");
assert(coastline.sourceId === "natural-earth-coastline-110m-v5", "Natural Earth coastline source id mismatch");
assert(coastline.version === "natural-earth-vector-117488dc884b", "Natural Earth coastline version mismatch");
assert(coastline.coastalThresholdKm === 50, "Natural Earth coastline coastal threshold mismatch");
assert(coastline.nearCoastalThresholdKm === 100, "Natural Earth coastline near-coastal threshold mismatch");
assert(coastline.regionalThresholdKm === 250, "Natural Earth coastline regional threshold mismatch");
assert(coastline.lineCount >= 100, "Natural Earth coastline line count too small");
assert(coastline.pointCount >= 3000, "Natural Earth coastline point count too small");
assert(Array.isArray(coastline.lines) && coastline.lines.length === coastline.lineCount, "Natural Earth coastline lines missing");
assert(
  coastline.lines.every((line) =>
    Array.isArray(line) &&
    line.length >= 2 &&
    line.every((coord) => Array.isArray(coord) && coord.length === 2 && coord.every(Number.isFinite))
  ),
  "Natural Earth coastline coordinate geometry invalid",
);
requireRegisteredSources([coastline.sourceId], "coastal proximity artifact");
assert(
  getSourceRow(coastline.sourceId)?.displayPolicy === "show-with-coastal-proximity-caveat",
  "Natural Earth coastline display policy mismatch",
);

const freshwater = readJson("data/freshwater-stress.aqueduct40.json");
assert(freshwater.sourceId === "wri-aqueduct-40-water-stress-v1", "freshwater artifact source id mismatch");
assert(freshwater.indicator === "water_stress", "freshwater artifact indicator mismatch");
assert(freshwater.license === "attribution", "freshwater artifact license must be attribution");
assert(typeof freshwater.attribution === "string" && freshwater.attribution.includes("Aqueduct"), "freshwater attribution missing");
assert(JSON.stringify(freshwater.years) === JSON.stringify([2030, 2050, 2080]), "freshwater horizons mismatch");
assert(freshwater.scenarioMap?.ssp126 === "opt" && freshwater.scenarioMap?.ssp370 === "bau" && freshwater.scenarioMap?.ssp585 === "pes", "freshwater scenario map mismatch");
assert(freshwater.scenarioMap?.ssp245 === null, "freshwater must leave ssp245 unmapped");
assert(Array.isArray(freshwater.basins) && freshwater.basins.length === freshwater.basinCount && freshwater.basinCount > 10000, "freshwater basin table incomplete");
assert(freshwater.caveats?.some((c) => c.toLowerCase().includes("prioritization")), "freshwater WRI prioritization caveat missing");
const fwRaster = freshwater.raster;
assert(fwRaster?.file === "freshwater-stress.aqueduct40.u16.gz" && fwRaster?.encoding === "gzip+uint16le", "freshwater raster manifest mismatch");
const fwBytes = gunzipSync(readFileSync(path.join(repoRoot, "data", fwRaster.file)));
assert(fwBytes.length === fwRaster.nlat * fwRaster.nlon * 2, "freshwater raster size mismatch vs manifest grid");
requireRegisteredSources([freshwater.sourceId], "freshwater artifact");
assert(
  getSourceRow(freshwater.sourceId)?.displayPolicy === "show-with-subbasin-prioritization-caveat",
  "freshwater display policy mismatch",
);
assert(getSourceRow(freshwater.sourceId)?.license === "attribution", "freshwater registry license must be attribution");

const amoc = readJson("data/amoc-collapse.json");
assert(amoc.sourceId === "nahosmip-amoc-collapse-v1", "amoc-collapse artifact source id mismatch");
assert(amoc.license === "CC-BY-SA-4.0", "amoc-collapse artifact license must be CC-BY-SA-4.0");
assert(typeof amoc.attribution === "string" && amoc.attribution.includes("NAHosMIP"), "amoc-collapse attribution missing");
assert(amoc.doi === "10.5194/gmd-16-1975-2023", "amoc-collapse design DOI mismatch");
assert(Array.isArray(amoc.models) && amoc.models.length === amoc.modelCount && amoc.modelCount >= 2, "amoc-collapse model list incomplete");
assert(
  amoc.caveats?.some((c) => c.toLowerCase().includes("low-probability") || c.toLowerCase().includes("not the central")),
  "amoc-collapse tail-scenario caveat missing",
);
const amocLayerNames = (amoc.layers ?? []).map((l) => l.name);
for (const need of ["tas_mean", "tas_spread", "pr_mean", "pr_spread", "zos_mean", "zos_spread", "psl_mean", "psl_spread"]) {
  assert(amocLayerNames.includes(need), `amoc-collapse layer ${need} missing`);
}
const amocGrid = amoc.grid;
assert(amocGrid?.file === "amoc-collapse.i16.gz" && amocGrid?.encoding === "gzip+int16le", "amoc-collapse raster manifest mismatch");
const amocBytes = gunzipSync(readFileSync(path.join(repoRoot, "data", amocGrid.file)));
assert(amocBytes.length === amocGrid.nlat * amocGrid.nlon * amoc.layers.length * 2, "amoc-collapse raster size mismatch vs manifest grid");
requireRegisteredSources([amoc.sourceId], "amoc-collapse artifact");
assert(
  getSourceRow(amoc.sourceId)?.displayPolicy === "show-as-collapse-tail-scenario-not-central-forecast",
  "amoc-collapse display policy mismatch",
);

const fireWeather = readJson("data/fire-weather.quilcaille2023.json");
assert(fireWeather.sourceId === "quilcaille-2023-fire-weather-v1", "fire-weather artifact source id mismatch");
assert(fireWeather.indicator === "fire_weather", "fire-weather artifact indicator mismatch");
assert(fireWeather.license === "cc-by-4.0", "fire-weather artifact license must be cc-by-4.0");
assert(typeof fireWeather.attribution === "string" && fireWeather.attribution.includes("Quilcaille"), "fire-weather attribution missing");
assert(JSON.stringify(fireWeather.years) === JSON.stringify([2030, 2050, 2080]), "fire-weather horizons mismatch");
assert(
  fireWeather.scenarioMap?.ssp126 === "ssp126" &&
    fireWeather.scenarioMap?.ssp245 === "ssp245" &&
    fireWeather.scenarioMap?.ssp370 === "ssp370" &&
    fireWeather.scenarioMap?.ssp585 === "ssp585",
  "fire-weather scenario map must serve all four SSPs directly",
);
assert(fireWeather.modelCount >= 20, "fire-weather model count too small");
assert(fireWeather.indicators?.fwixd && fireWeather.indicators?.fwils, "fire-weather indicators missing");
assert(Array.isArray(fireWeather.layers) && fireWeather.layers.length === 24, "fire-weather expects 24 layers (2 indicators x 4 scenarios x 3 horizons)");
assert(fireWeather.caveats?.some((c) => c.toLowerCase().includes("ocean")), "fire-weather ocean-masking caveat missing");
const fireRaster = fireWeather.raster;
assert(fireRaster?.file === "fire-weather.quilcaille2023.u16.gz" && fireRaster?.encoding === "gzip+uint16le", "fire-weather raster manifest mismatch");
const fireBytes = gunzipSync(readFileSync(path.join(repoRoot, "data", fireRaster.file)));
assert(fireBytes.length === fireWeather.layers.length * fireRaster.layerCells * 2, "fire-weather raster size mismatch vs manifest layers");
requireRegisteredSources([fireWeather.sourceId], "fire-weather artifact");
assert(
  getSourceRow(fireWeather.sourceId)?.displayPolicy === "show-with-fire-weather-screening-caveat",
  "fire-weather display policy mismatch",
);
assert(getSourceRow(fireWeather.sourceId)?.license === "cc-by-4.0", "fire-weather registry license must be cc-by-4.0");

const floodRiver = readJson("data/flood-river.aqueduct.json");
assert(floodRiver.sourceId === "wri-aqueduct-floods-riverine-v1", "flood artifact source id mismatch");
assert(floodRiver.indicator === "flood_river", "flood artifact indicator mismatch");
assert(floodRiver.license === "attribution", "flood artifact license must be attribution");
assert(typeof floodRiver.attribution === "string" && floodRiver.attribution.includes("Aqueduct"), "flood attribution missing");
assert(JSON.stringify(floodRiver.years) === JSON.stringify([2030, 2050, 2080]), "flood horizons mismatch");
assert(
  floodRiver.scenarioMap?.ssp245 === "rcp4p5" && floodRiver.scenarioMap?.ssp585 === "rcp8p5",
  "flood scenario map must serve RCP4.5->ssp245 and RCP8.5->ssp585",
);
assert(floodRiver.scenarioMap?.ssp126 === null && floodRiver.scenarioMap?.ssp370 === null, "flood must leave ssp126/ssp370 unmapped");
assert(floodRiver.modelCount === 5, "flood model count must be 5");
assert(floodRiver.indicators?.floodedFraction && floodRiver.indicators?.meanFloodDepth, "flood indicators missing");
assert(Array.isArray(floodRiver.layers) && floodRiver.layers.length === 12, "flood expects 12 layers (2 indicators x 2 scenarios x 3 horizons)");
assert(floodRiver.caveats?.some((c) => c.toLowerCase().includes("riverine")), "flood riverine-only caveat missing");
const floodRaster = floodRiver.raster;
assert(floodRaster?.file === "flood-river.aqueduct.u16.gz" && floodRaster?.encoding === "gzip+uint16le", "flood raster manifest mismatch");
const floodBytes = gunzipSync(readFileSync(path.join(repoRoot, "data", floodRaster.file)));
assert(floodBytes.length === floodRiver.layers.length * floodRaster.layerCells * 2, "flood raster size mismatch vs manifest layers");
requireRegisteredSources([floodRiver.sourceId], "flood artifact");
assert(
  getSourceRow(floodRiver.sourceId)?.displayPolicy === "show-with-regional-flood-screening-caveat",
  "flood display policy mismatch",
);
assert(getSourceRow(floodRiver.sourceId)?.license === "attribution", "flood registry license must be attribution");

const cropYield = readJson("data/crop-yield.isimip-ggcmi.json");
assert(cropYield.sourceId === "isimip-ggcmi-phase3-yield-v1", "crop artifact source id mismatch");
assert(cropYield.indicator === "crop_yield", "crop artifact indicator mismatch");
assert(cropYield.license === "cc0-1.0", "crop artifact license must be cc0-1.0");
assert(typeof cropYield.attribution === "string" && cropYield.attribution.includes("ISIMIP"), "crop attribution missing");
assert(JSON.stringify(cropYield.years) === JSON.stringify([2030, 2050, 2080]), "crop horizons mismatch");
assert(
  cropYield.scenarioMap?.ssp126 === "ssp126" && cropYield.scenarioMap?.ssp370 === "ssp370" && cropYield.scenarioMap?.ssp585 === "ssp585",
  "crop scenario map must serve ssp126/ssp370/ssp585 directly",
);
assert(cropYield.scenarioMap?.ssp245 === null, "crop must leave ssp245 unmapped");
assert(cropYield.crops?.mai && cropYield.crops?.soy && cropYield.crops?.ri1 && cropYield.crops?.wwh, "crop list incomplete");
assert(Array.isArray(cropYield.layers) && cropYield.layers.length === 36, "crop expects 36 layers (4 crops x 3 scenarios x 3 horizons)");
assert(cropYield.caveats?.some((c) => c.toLowerCase().includes("not a field-level")), "crop field-level caveat missing");
const cropRaster = cropYield.raster;
assert(cropRaster?.file === "crop-yield.isimip-ggcmi.u16.gz" && cropRaster?.encoding === "gzip+uint16le", "crop raster manifest mismatch");
const cropBytes = gunzipSync(readFileSync(path.join(repoRoot, "data", cropRaster.file)));
assert(cropBytes.length === cropYield.layers.length * cropRaster.layerCells * 2, "crop raster size mismatch vs manifest layers");
requireRegisteredSources([cropYield.sourceId], "crop artifact");
assert(
  getSourceRow(cropYield.sourceId)?.displayPolicy === "show-with-crop-ensemble-caveat",
  "crop display policy mismatch",
);
assert(getSourceRow(cropYield.sourceId)?.license === "cc0-1.0", "crop registry license must be cc0-1.0");

const rankingArtifacts = [
  readJson("data/rankings.curated-cities.json"),
  readJson("data/rankings.natural-earth-populated-places.json"),
  readJson("data/rankings.natural-earth-country-population-weighted.json"),
];
const rankingCatalogs = new Set(rankingArtifacts.map((artifact) => artifact.catalog));
assert(rankingCatalogs.has("curated_cities"), "curated ranking catalog missing");
assert(rankingCatalogs.has("natural_earth_populated_places_110m"), "Natural Earth ranking catalog missing");
assert(rankingCatalogs.has("natural_earth_country_population_place_weighted"), "Natural Earth country aggregate ranking catalog missing");

let rankingEntryCount = 0;
for (const rankings of rankingArtifacts) {
  assert(rankings.methodVersion === modelVersion, "ranking method version mismatch");
  assert(rankings.sourceRegistryVersion === sourceRegistryVersion, "ranking source registry version mismatch");
  assert(Array.isArray(rankings.entries) && rankings.entries.length > 0, "ranking entries missing");
  rankingEntryCount += rankings.entries.length;

  for (const entry of rankings.entries) {
    assert(entry.methodVersion === modelVersion, "ranking entry method version mismatch");
    assert(entry.sourceRegistryVersion === sourceRegistryVersion, "ranking entry source registry mismatch");
    assert(entry.catalog === rankings.catalog, "ranking catalog mismatch");
    assert(["highest", "lowest"].includes(entry.direction), "ranking direction invalid");
    assert(Array.isArray(entry.rows) && entry.rows.length > 0, "ranking rows missing");
    requireRegisteredSources(entry.sourceIds, "ranking");
    if (entry.catalog === "natural_earth_country_population_place_weighted") {
      assert(entry.placeSampleSize >= 50, "country aggregate place sample size missing");
      assert(entry.caveats.some((caveat) => caveat.includes("not a complete national exposure")), "country aggregate caveat missing");
      assert(entry.rows.every((row) => row.country === "country aggregate"), "country aggregate rows must be labelled");
      assert(entry.rows.every((row) => Number.isFinite(row.placeCount) && row.placeCount >= 1), "country aggregate place counts missing");
      assert(entry.rows.every((row) => Array.isArray(row.includedPlaces) && row.includedPlaces.length === row.placeCount), "country aggregate included place lists missing");
    }
  }
}

const analog = readJson("client/public/climate-analog-catalog.current.json");
const analogSourceIds = [
  "worldclim-v2-1",
  "cmip6-scenariomip",
  "ipcc-ar6-temperature",
  "cmip6-etccdi",
  "natural-earth-populated-places-110m-v5",
];
assert(analog.version === "grounded-current-analogs-v1", "analog catalog version mismatch");
assert(analog.catalogYear === new Date().getFullYear(), "analog catalog is not generated for the current year");
assert(analog.scenario === "ssp245", "analog catalog scenario mismatch");
assert(Array.isArray(analog.candidates) && analog.candidates.length === analog.candidateCount, "analog catalog candidate count mismatch");
assert(analog.candidateCount >= 1000, "analog catalog too small — expected the enriched Natural Earth catalog (>= 1000 cities)");
requireRegisteredSources(analogSourceIds, "climate analog catalog");
for (const candidate of analog.candidates) {
  assert(candidate.year === analog.catalogYear, "analog candidate year mismatch");
  assert(candidate.scenario === analog.scenario, "analog candidate scenario mismatch");
  assert(Array.isArray(candidate.temperature?.monthly) && candidate.temperature.monthly.length === 12, "analog monthly temperatures invalid");
  assert(Array.isArray(candidate.precipitation?.monthly) && candidate.precipitation.monthly.length === 12, "analog monthly precipitation invalid");
  assert(Number.isFinite(candidate.temperature.annual_mean), "analog annual temperature invalid");
  assert(Number.isFinite(candidate.precipitation.annual_total), "analog annual precipitation invalid");
  assert(Number.isFinite(candidate.extremes?.heat_stress_days), "analog heat-stress days invalid");
  assert(Number.isFinite(candidate.extremes?.drought_risk), "analog drought risk invalid");
  assert(Number.isFinite(candidate.extremes?.flood_risk), "analog flood risk invalid");
}

const audit = readJson("data/trajectory-audit-summary.json");
assert(audit.version === "trajectory-audit-summary-v1", "trajectory audit summary version mismatch");
assert(audit.cityCount === 13, "trajectory audit city count mismatch");
assert(audit.resultCount === 52, "trajectory audit result count mismatch");
assert(Array.isArray(audit.trendReview), "trajectory audit trend review missing");
const observedBaselineAudit = readJson("data/observed-baseline-audit.json");
assert(observedBaselineAudit.version === "observed-baseline-audit-v1", "observed baseline audit version mismatch");
assert(observedBaselineAudit.cityCount === 13, "observed baseline audit city count mismatch");
assert(observedBaselineAudit.maxTemperatureDifferenceC <= 0.02, "observed baseline audit temperature mismatch too large");
assert(observedBaselineAudit.maxPrecipitationDifferenceMm <= 0.05, "observed baseline audit precipitation mismatch too large");
assert(
  observedBaselineAudit.results.every((result) => result.projectionYearBasis?.source_year_low === 2030 && result.projectionYearBasis?.mode === "clamped-earliest-source-year"),
  "observed baseline audit does not disclose pre-2030 source-year basis",
);
const observedClimatologyValidation = readJson("data/observed-climatology-validation.nasa-power.json");
assert(
  observedClimatologyValidation.version === "nasa-power-observed-climatology-validation-v1",
  "NASA POWER observed-climatology validation version mismatch",
);
assert(observedClimatologyValidation.status === "passed-with-caveats", "NASA POWER observed-climatology validation status mismatch");
assert(observedClimatologyValidation.cityCount === 13, "NASA POWER observed-climatology validation city count mismatch");
assert(observedClimatologyValidation.period?.start === 1981 && observedClimatologyValidation.period?.end === 2000, "NASA POWER validation period mismatch");
requireRegisteredSources(observedClimatologyValidation.sourceIds, "NASA POWER observed-climatology validation");
assert(
  observedClimatologyValidation.sourceIds.includes("nasa-power-meteorology-monthly-v10") &&
    observedClimatologyValidation.sourceIds.includes("worldclim-v2-1"),
  "NASA POWER validation source ids incomplete",
);
assert(
  String(observedClimatologyValidation.units?.precipitation).includes("converted to annual mm"),
  "NASA POWER precipitation unit conversion missing",
);
assert(
  observedClimatologyValidation.summary?.maxAbsTemperatureDifferenceC <= 2,
  "NASA POWER observed-climatology validation temperature difference too large",
);
assert(
  observedClimatologyValidation.summary?.reviewFlagCount <= 2,
  "NASA POWER observed-climatology validation has too many review flags",
);
assert(
  observedClimatologyValidation.caveats?.some((caveat) => caveat.includes("not validate future CMIP6 scenario trends")),
  "NASA POWER validation non-hindcast caveat missing",
);
const validationReport = readFileSync(path.join(repoRoot, "docs/VALIDATION_REPORT.md"), "utf8");
const scientificGrounding = readFileSync(path.join(repoRoot, "docs/architecture/SCIENTIFIC_GROUNDING.md"), "utf8");
assert(validationReport.includes(audit.generatedAt), "validation report is not synced to trajectory audit artifact");
assert(validationReport.includes("Not a Historical Hindcast"), "validation report must disclose missing historical hindcast");
assert(validationReport.includes(observedBaselineAudit.generatedAt), "validation report is not synced to observed baseline audit artifact");
assert(validationReport.includes(observedClimatologyValidation.generatedAt), "validation report is not synced to NASA POWER validation artifact");
assert(validationReport.includes("NASA POWER / MERRA-2 observed climatology"), "validation report must include NASA POWER validation section");
assert(validationReport.includes("Trend review flags are unresolved scientific-review evidence"), "validation report must keep trend flags visible");
assert(scientificGrounding.includes("packed 2030 scenario layer"), "scientific grounding must disclose near-current source-year basis");
assert(scientificGrounding.includes("NASA POWER / MERRA-2 monthly"), "scientific grounding must disclose NASA POWER validation source");

console.log(`artifact validation passed: ${rankingEntryCount} ranking slices, ${analog.candidateCount} analog candidates, ${registry.rows.length} source rows, ${audit.resultCount} audit results, ${observedBaselineAudit.cityCount} baseline checks, ${observedClimatologyValidation.cityCount} NASA POWER checks, ${coastline.lineCount} coastline lines`);
