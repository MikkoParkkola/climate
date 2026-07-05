import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded AMOC-collapse impact profile over the NAHosMIP 0.3 Sv hosing ensemble
 * (see scripts/build_nahosmip_amoc.py). Given a point, returns the multi-model MEAN
 * and across-model SPREAD of the collapse-tail anomaly (temperature, precipitation,
 * regional dynamic sea level, sea-level pressure) versus the pre-collapse state.
 *
 * This is the LOW-PROBABILITY, HIGH-IMPACT tail scenario — NOT the central forecast,
 * NOT tied to any SSP or calendar year. Distinct from the qualitative likely-weakening
 * note in amoc.ts. Per the cardinal no-fabricated-science rule, every served number is a
 * real reduction of published NAHosMIP model output; null means "not available" (cells
 * with fewer than two models, or — for sea level — land), never a guess.
 */

interface AmocLayer {
  name: string;
  unit: string;
  scale: number;
  index: number;
}

interface AmocManifest {
  version: string;
  sourceId: string;
  provider: string;
  experiment: string;
  license: string;
  attribution: string;
  stableUrl: string;
  doi: string;
  models: string[];
  modelCount: number;
  baselineWindowYears: number;
  collapsedWindowYears: number;
  grid: {
    file: string;
    encoding: string;
    nodata: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
    order: string;
  };
  layers: AmocLayer[];
  method: string;
  caveats: string[];
}

export interface AmocDimension {
  mean: number;
  spread: number;
  unit: string;
}

export interface AmocPrecipDimension extends AmocDimension {
  /** Percentage change vs the pre-collapse baseline, when available. */
  pct: number | null;
}

export interface AmocCollapseProfile {
  sourceId: string;
  version: string;
  provider: string;
  license: string;
  attribution: string;
  stableUrl: string;
  doi: string;
  experiment: string;
  models: string[];
  modelCount: number;
  /** Always this fixed string — the profile is a tail scenario, never the central case. */
  scenarioApplicability: "low-probability-high-impact-collapse-tail";
  temperature: AmocDimension | null;
  precipitation: AmocPrecipDimension | null;
  /** Regional DYNAMIC sea-level change (global-ocean mean removed); null over land cells. */
  seaLevel: AmocDimension | null;
  pressure: AmocDimension | null;
  method: string;
  caveats: string[];
}

let cached: { manifest: AmocManifest; layers: Int16Array; cells: number } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function load(): { manifest: AmocManifest; layers: Int16Array; cells: number } | null {
  if (cached) return cached;
  const manifestPath = dataPath("data/amoc-collapse.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as AmocManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.grid.file}`));
  const buf = gunzipSync(gz);
  const cells = manifest.grid.nlat * manifest.grid.nlon;
  const expected = cells * manifest.layers.length * 2;
  if (buf.length !== expected) {
    throw new Error(`amoc-collapse raster size ${buf.length} != expected ${expected}`);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const layers = new Int16Array(ab);
  cached = { manifest, layers, cells };
  return cached;
}

function layerIndex(m: AmocManifest, name: string): AmocLayer | undefined {
  return m.layers.find((l) => l.name === name);
}

function read(
  layers: Int16Array,
  cells: number,
  m: AmocManifest,
  layer: AmocLayer | undefined,
  cell: number,
): number | null {
  if (!layer) return null;
  const raw = layers[layer.index * cells + cell];
  if (raw === m.grid.nodata) return null;
  return raw / layer.scale;
}

/** O(1) grid lookup of the collapse-tail profile for a point, or null when unavailable. */
export function lookupAmocCollapse(lat: number, lng: number): AmocCollapseProfile | null {
  const loaded = load();
  if (!loaded) return null;
  const { manifest, layers, cells } = loaded;
  const { nlat, nlon, dlat, dlon, lat0, lon0 } = manifest.grid;

  const row = Math.round((lat0 - lat) / dlat);
  // Wrap longitude into [-180, 180) before indexing.
  let lngNorm = ((lng + 180) % 360 + 360) % 360 - 180;
  const col = Math.round((lngNorm - lon0) / dlon);
  if (row < 0 || row >= nlat || col < 0 || col >= nlon) return null;
  const cell = row * nlon + col;

  const tasMean = read(layers, cells, manifest, layerIndex(manifest, "tas_mean"), cell);
  const tasSpread = read(layers, cells, manifest, layerIndex(manifest, "tas_spread"), cell);
  const prMean = read(layers, cells, manifest, layerIndex(manifest, "pr_mean"), cell);
  const prSpread = read(layers, cells, manifest, layerIndex(manifest, "pr_spread"), cell);
  const prPct = read(layers, cells, manifest, layerIndex(manifest, "pr_pct"), cell);
  const zosMean = read(layers, cells, manifest, layerIndex(manifest, "zos_mean"), cell);
  const zosSpread = read(layers, cells, manifest, layerIndex(manifest, "zos_spread"), cell);
  const pslMean = read(layers, cells, manifest, layerIndex(manifest, "psl_mean"), cell);
  const pslSpread = read(layers, cells, manifest, layerIndex(manifest, "psl_spread"), cell);

  const temperature: AmocDimension | null =
    tasMean === null ? null : { mean: tasMean, spread: tasSpread ?? 0, unit: "degC" };
  const precipitation: AmocPrecipDimension | null =
    prMean === null ? null : { mean: prMean, spread: prSpread ?? 0, unit: "mm/day", pct: prPct };
  const seaLevel: AmocDimension | null =
    zosMean === null ? null : { mean: zosMean, spread: zosSpread ?? 0, unit: "cm" };
  const pressure: AmocDimension | null =
    pslMean === null ? null : { mean: pslMean, spread: pslSpread ?? 0, unit: "hPa" };

  // No data of any kind for this cell -> null, never a fabricated profile.
  if (!temperature && !precipitation && !seaLevel && !pressure) return null;

  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    license: manifest.license,
    attribution: manifest.attribution,
    stableUrl: manifest.stableUrl,
    doi: manifest.doi,
    experiment: manifest.experiment,
    models: manifest.models,
    modelCount: manifest.modelCount,
    scenarioApplicability: "low-probability-high-impact-collapse-tail",
    temperature,
    precipitation,
    seaLevel,
    pressure,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}

/** Lightweight summary for the data-quality report (no per-cell grid). */
export function amocCollapseArtifactSummary() {
  const loaded = load();
  if (!loaded) return null;
  const { manifest } = loaded;
  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    experiment: manifest.experiment,
    license: manifest.license,
    attribution: manifest.attribution,
    models: manifest.models,
    modelCount: manifest.modelCount,
    variables: manifest.layers.map((l) => l.name),
    resolutionDegrees: manifest.grid.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
