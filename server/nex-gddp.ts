import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded NASA NEX-GDDP-CMIP6 lookup (see scripts/build_nex_gddp.py). One artifact, one
 * representative downscaled model (ACCESS-CM2, ~25 km), grounds three habitability signals at a
 * point + fupit SSP id, for 20-year windows (baseline 1995-2014 plus 2030/2050/2080):
 *
 *  - humid_heat: days/yr with daily-mean wet-bulb above 28/31/35 degC (Stull 2011 approximation).
 *  - cold_season: ETCCDI frost days, ice days, window-minimum tasmin (TNn), plus a fixed-threshold
 *    cold-spell screen.
 *  - infrastructure (degree-days): base-18 degC cooling / heating degree-days per yr.
 *
 * All four SSPs are served (NEX-GDDP has them all). Ocean / no-data cells, and any window not
 * present in the artifact, return null per field. No value is invented. Windows whose reduction
 * has not been built are absent from `builtWindows` and resolve to null rather than a guess.
 */

interface NexLayer {
  indicator: string;
  scenario: string;
  window: string;
  offset: number;
}

interface NexManifest {
  version: string;
  sourceId: string;
  provider: string;
  model: string;
  variant: string;
  license: string;
  attribution: string;
  stableUrl: string;
  raster: {
    file: string;
    fill: number;
    tnnOffset: number;
    tnnScale: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
    lon360: boolean;
    layerCells: number;
  };
  indicators: string[];
  scenarios: string[];
  windows: string[];
  windowYears: Record<string, string>;
  builtWindows: string[];
  baselinePeriod: string;
  wetBulbThresholds: number[];
  degreeDayBaseC: number;
  layers: NexLayer[];
  method: string;
  caveats: string[];
}

// Windows that carry a numeric horizon year for the result page (baseline is reference context).
const WINDOW_YEAR: Record<string, number | null> = { baseline: null, "2030": 2030, "2050": 2050, "2080": 2080 };

export interface HumidHeatHorizon {
  window: string;
  year: number | null;
  period: string;
  daysAbove28: number | null;
  daysAbove31: number | null;
  daysAbove35: number | null;
}
export interface ColdSeasonHorizon {
  window: string;
  year: number | null;
  period: string;
  frostDays: number | null;
  iceDays: number | null;
  minTasminC: number | null;
  coldSpellDays: number | null;
}
export interface DegreeDayHorizon {
  window: string;
  year: number | null;
  period: string;
  coolingDegreeDays: number | null;
  heatingDegreeDays: number | null;
}

interface NexBase {
  sourceId: string;
  version: string;
  model: string;
  attribution: string;
  license: string;
  stableUrl: string;
  scenario: string;
  baselinePeriod: string;
  resolutionDegrees: number;
  method: string;
  caveats: string[];
}
export interface HumidHeatLookup extends NexBase {
  thresholds: number[];
  horizons: HumidHeatHorizon[];
}
export interface ColdSeasonLookup extends NexBase {
  horizons: ColdSeasonHorizon[];
}
export interface DegreeDayLookup extends NexBase {
  degreeDayBaseC: number;
  horizons: DegreeDayHorizon[];
}

let cached: { manifest: NexManifest; raster: Uint16Array; index: Map<string, number> } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function layerKey(indicator: string, scenario: string, window: string): string {
  return `${indicator}|${scenario}|${window}`;
}

function load(): { manifest: NexManifest; raster: Uint16Array; index: Map<string, number> } {
  if (cached) return cached;
  const manifest = JSON.parse(fs.readFileSync(dataPath("data/nex-gddp.json"), "utf-8")) as NexManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.raster.file}`));
  const buf = gunzipSync(gz);
  const expected = manifest.layers.length * manifest.raster.layerCells * 2;
  if (buf.length !== expected) {
    throw new Error(`nex-gddp raster size ${buf.length} != expected ${expected}`);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const raster = new Uint16Array(ab);
  const index = new Map<string, number>();
  for (const layer of manifest.layers) {
    index.set(layerKey(layer.indicator, layer.scenario, layer.window), layer.offset);
  }
  cached = { manifest, raster, index };
  return cached;
}

function cellIndex(m: NexManifest, lat: number, lng: number): number | null {
  const { dlat, dlon, lat0, lon0, nlat, nlon, lon360 } = m.raster;
  const row = Math.round((lat0 - lat) / dlat);
  if (row < 0 || row >= nlat) return null;
  const lngGrid = lon360 ? ((lng % 360) + 360) % 360 : lng;
  let col = Math.round((lngGrid - lon0) / dlon);
  col = ((col % nlon) + nlon) % nlon;
  return row * nlon + col;
}

/** Read one indicator at one window/scenario for a cell; null on fill / missing layer. */
function read(
  m: NexManifest,
  raster: Uint16Array,
  index: Map<string, number>,
  indicator: string,
  scenario: string,
  window: string,
  cell: number,
): number | null {
  const offset = index.get(layerKey(indicator, scenario, window));
  if (offset === undefined) return null;
  const raw = raster[offset + cell];
  if (raw === m.raster.fill) return null;
  if (indicator === "tnn") return Math.round((raw / m.raster.tnnScale - m.raster.tnnOffset) * 10) / 10;
  return raw;
}

function baseFields(m: NexManifest, scenario: string): NexBase {
  return {
    sourceId: m.sourceId,
    version: m.version,
    model: m.model,
    attribution: m.attribution,
    license: m.license,
    stableUrl: m.stableUrl,
    scenario,
    baselinePeriod: m.baselinePeriod,
    resolutionDegrees: m.raster.dlat,
    method: m.method,
    caveats: m.caveats,
  };
}

// Future windows only on the result page; baseline stays internal reference context.
function futureWindows(m: NexManifest): string[] {
  return m.windows.filter((w) => w !== "baseline" && m.builtWindows.includes(w));
}

export function lookupHumidHeat(lat: number, lng: number, scenario: string): HumidHeatLookup | null {
  const { manifest, raster, index } = load();
  if (!manifest.scenarios.includes(scenario)) return null;
  const cell = cellIndex(manifest, lat, lng);
  if (cell === null) return null;
  const horizons: HumidHeatHorizon[] = futureWindows(manifest).map((window) => ({
    window,
    year: WINDOW_YEAR[window] ?? null,
    period: manifest.windowYears[window],
    daysAbove28: read(manifest, raster, index, "tw_gt28", scenario, window, cell),
    daysAbove31: read(manifest, raster, index, "tw_gt31", scenario, window, cell),
    daysAbove35: read(manifest, raster, index, "tw_gt35", scenario, window, cell),
  }));
  if (!horizons.some((h) => h.daysAbove28 !== null)) return null; // ocean / no-data
  return { ...baseFields(manifest, scenario), thresholds: manifest.wetBulbThresholds, horizons };
}

export function lookupColdSeason(lat: number, lng: number, scenario: string): ColdSeasonLookup | null {
  const { manifest, raster, index } = load();
  if (!manifest.scenarios.includes(scenario)) return null;
  const cell = cellIndex(manifest, lat, lng);
  if (cell === null) return null;
  const horizons: ColdSeasonHorizon[] = futureWindows(manifest).map((window) => ({
    window,
    year: WINDOW_YEAR[window] ?? null,
    period: manifest.windowYears[window],
    frostDays: read(manifest, raster, index, "frost_days", scenario, window, cell),
    iceDays: read(manifest, raster, index, "ice_days", scenario, window, cell),
    minTasminC: read(manifest, raster, index, "tnn", scenario, window, cell),
    coldSpellDays: read(manifest, raster, index, "cold_spell_days", scenario, window, cell),
  }));
  if (!horizons.some((h) => h.frostDays !== null || h.minTasminC !== null)) return null;
  return { ...baseFields(manifest, scenario), horizons };
}

export function lookupDegreeDays(lat: number, lng: number, scenario: string): DegreeDayLookup | null {
  const { manifest, raster, index } = load();
  if (!manifest.scenarios.includes(scenario)) return null;
  const cell = cellIndex(manifest, lat, lng);
  if (cell === null) return null;
  const horizons: DegreeDayHorizon[] = futureWindows(manifest).map((window) => ({
    window,
    year: WINDOW_YEAR[window] ?? null,
    period: manifest.windowYears[window],
    coolingDegreeDays: read(manifest, raster, index, "cdd18", scenario, window, cell),
    heatingDegreeDays: read(manifest, raster, index, "hdd18", scenario, window, cell),
  }));
  if (!horizons.some((h) => h.coolingDegreeDays !== null)) return null;
  return { ...baseFields(manifest, scenario), degreeDayBaseC: manifest.degreeDayBaseC, horizons };
}

/** Lightweight summary for the data-quality report (no per-cell raster). */
export function nexGddpArtifactSummary() {
  const { manifest } = load();
  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    model: manifest.model,
    license: manifest.license,
    attribution: manifest.attribution,
    indicators: manifest.indicators,
    scenarios: manifest.scenarios,
    windows: manifest.windows,
    builtWindows: manifest.builtWindows,
    windowYears: manifest.windowYears,
    baselinePeriod: manifest.baselinePeriod,
    wetBulbThresholds: manifest.wetBulbThresholds,
    degreeDayBaseC: manifest.degreeDayBaseC,
    resolutionDegrees: manifest.raster.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
