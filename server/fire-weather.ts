import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded fire-weather lookup over the Quilcaille et al. (2023) CMIP6 Canadian Fire
 * Weather Index artifact (see scripts/build_fire_weather.py). Given a point + fupit SSP id,
 * returns the multi-model ensemble-mean extreme-fire-weather days and fire-season length
 * for the containing 2.5-degree cell at the 2030/2050/2080 horizons, or null when the
 * scenario is unsupported (only ssp126/245/370/585 are served) or no land cell covers the
 * point (open ocean / unclassified). No value is ever invented: null means "not available",
 * in line with the cardinal no-fabricated-science rule.
 */

interface FireWeatherLayer {
  indicator: string;
  scenario: string;
  year: number;
  offset: number;
}

interface FireWeatherManifest {
  version: string;
  sourceId: string;
  provider: string;
  indicator: string;
  indicatorLabel: string;
  license: string;
  attribution: string;
  stableUrl: string;
  raster: {
    file: string;
    fill: number;
    scale: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
    layerCells: number;
  };
  indicators: Record<string, { label: string; units: string }>;
  scenarioMap: Record<string, string | null>;
  scenarioLabels: Record<string, string>;
  years: number[];
  windows: Record<string, string>;
  modelCount: number;
  realizationCount: number;
  layers: FireWeatherLayer[];
  method: string;
  caveats: string[];
}

export interface FireWeatherHorizon {
  year: number;
  window: string | null;
  extremeFireWeatherDays: number | null;
  fireSeasonLengthDays: number | null;
}

export interface FireWeatherLookup {
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
  /** 0 when the point itself had data; >0 when the nearest cell within ~3 cells was used. */
  fallbackRings: number;
  horizons: FireWeatherHorizon[];
  method: string;
  caveats: string[];
}

// Nearest-cell search radius (in 2.5-degree cells) used only when the exact cell is
// fill (e.g. a coastal city whose 2.5-degree centre lands just offshore).
const MAX_FALLBACK_RINGS = 3;

let cached: { manifest: FireWeatherManifest; raster: Uint16Array; index: Map<string, number> } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function layerKey(indicator: string, scenario: string, year: number): string {
  return `${indicator}|${scenario}|${year}`;
}

function load(): { manifest: FireWeatherManifest; raster: Uint16Array; index: Map<string, number> } {
  if (cached) return cached;
  const manifest = JSON.parse(
    fs.readFileSync(dataPath("data/fire-weather.quilcaille2023.json"), "utf-8"),
  ) as FireWeatherManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.raster.file}`));
  const buf = gunzipSync(gz);
  const expected = manifest.layers.length * manifest.raster.layerCells * 2;
  if (buf.length !== expected) {
    throw new Error(`fire-weather raster size ${buf.length} != expected ${expected}`);
  }
  // Copy to a fresh, 2-byte-aligned ArrayBuffer before viewing as Uint16.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const raster = new Uint16Array(ab);
  const index = new Map<string, number>();
  for (const layer of manifest.layers) {
    index.set(layerKey(layer.indicator, layer.scenario, layer.year), layer.offset);
  }
  cached = { manifest, raster, index };
  return cached;
}

/** Decode a single cell value for a layer, with the fill sentinel mapped to null. */
function cellValue(
  raster: Uint16Array,
  m: FireWeatherManifest,
  offset: number,
  row: number,
  col: number,
): number | null {
  const { nlat, nlon, fill, scale } = m.raster;
  if (row < 0 || row >= nlat || col < 0 || col >= nlon) return null;
  const v = raster[offset + row * nlon + col];
  if (v === fill) return null;
  return Math.round(v * scale * 10) / 10;
}

/** Whether any served layer has data at this cell (used to anchor the nearest-cell fallback). */
function cellHasData(
  raster: Uint16Array,
  m: FireWeatherManifest,
  scenario: string,
  row: number,
  col: number,
  index: Map<string, number>,
): boolean {
  if (row < 0 || row >= m.raster.nlat || col < 0 || col >= m.raster.nlon) return false;
  for (const indicator of Object.keys(m.indicators)) {
    for (const year of m.years) {
      const offset = index.get(layerKey(indicator, scenario, year));
      if (offset === undefined) continue;
      if (raster[offset + row * m.raster.nlon + col] !== m.raster.fill) return true;
    }
  }
  return false;
}

function resolveCell(
  raster: Uint16Array,
  m: FireWeatherManifest,
  scenario: string,
  lat: number,
  lng: number,
  index: Map<string, number>,
): { row: number; col: number; rings: number } | null {
  const { dlat, dlon, lat0, lon0, nlon } = m.raster;
  // Grid rows increase north from lat0; columns are 0..360 increasing east from lon0.
  const lon360 = ((lng % 360) + 360) % 360;
  const row = Math.round((lat - lat0) / dlat);
  let col = Math.round((lon360 - lon0) / dlon);
  col = ((col % nlon) + nlon) % nlon;
  if (cellHasData(raster, m, scenario, row, col, index)) return { row, col, rings: 0 };
  for (let ring = 1; ring <= MAX_FALLBACK_RINGS; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const c = ((col + dc) % nlon + nlon) % nlon;
        if (cellHasData(raster, m, scenario, row + dr, c, index)) {
          return { row: row + dr, col: c, rings: ring };
        }
      }
    }
  }
  return null;
}

export function lookupFireWeather(lat: number, lng: number, scenario: string): FireWeatherLookup | null {
  const { manifest, raster, index } = load();
  const mapped = manifest.scenarioMap[scenario];
  if (!mapped) return null; // only ssp126/245/370/585 are served; others -> null by design
  const resolved = resolveCell(raster, manifest, mapped, lat, lng, index);
  if (!resolved) return null;

  const horizons: FireWeatherHorizon[] = manifest.years.map((year) => {
    const xdOffset = index.get(layerKey("fwixd", mapped, year));
    const lsOffset = index.get(layerKey("fwils", mapped, year));
    return {
      year,
      window: manifest.windows[String(year)] ?? null,
      extremeFireWeatherDays:
        xdOffset === undefined ? null : cellValue(raster, manifest, xdOffset, resolved.row, resolved.col),
      fireSeasonLengthDays:
        lsOffset === undefined ? null : cellValue(raster, manifest, lsOffset, resolved.row, resolved.col),
    };
  });

  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    indicator: manifest.indicator,
    indicatorLabel: manifest.indicatorLabel,
    attribution: manifest.attribution,
    license: manifest.license,
    stableUrl: manifest.stableUrl,
    scenario,
    scenarioLabel: manifest.scenarioLabels[mapped] ?? mapped,
    modelCount: manifest.modelCount,
    fallbackRings: resolved.rings,
    horizons,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}

/** Lightweight summary for the data-quality report (no per-cell raster). */
export function fireWeatherArtifactSummary() {
  const { manifest } = load();
  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    indicator: manifest.indicator,
    indicatorLabel: manifest.indicatorLabel,
    license: manifest.license,
    attribution: manifest.attribution,
    modelCount: manifest.modelCount,
    realizationCount: manifest.realizationCount,
    years: manifest.years,
    scenarioMap: manifest.scenarioMap,
    resolutionDegrees: manifest.raster.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
