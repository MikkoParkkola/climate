import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded riverine flood-exposure lookup over the WRI Aqueduct Floods v2 artifact
 * (see scripts/build_aqueduct_floods.py). Given a point + fupit SSP id, returns the
 * 1-in-100-year riverine flood exposure for the containing 0.1-degree (~10 km) cell at
 * the 2030/2050/2080 horizons: the fraction of the cell in the modeled floodplain and the
 * mean modeled flood depth over the flooded part. RCP4.5 is served as ssp245 and RCP8.5 as
 * ssp585; ssp126 and ssp370 have no Aqueduct match and return null. No value is invented.
 *
 * Note on the fill sentinel: a flooded-area fraction of 0 (dry land, the common case) is a
 * legitimate answer, so the fraction layer's fill sentinel is read as 0.0. The depth layer's
 * fill means "no flooded pixels in this cell", which is returned as null (depth is undefined
 * where nothing floods).
 */

interface FloodLayer {
  indicator: string;
  scenario: string;
  year: number;
  offset: number;
}

interface FloodManifest {
  version: string;
  sourceId: string;
  provider: string;
  indicator: string;
  indicatorLabel: string;
  license: string;
  attribution: string;
  stableUrl: string;
  returnPeriod: string;
  raster: {
    file: string;
    fill: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
    layerCells: number;
  };
  indicators: Record<string, { label: string; units: string; scale: number }>;
  scenarioMap: Record<string, string | null>;
  scenarioLabels: Record<string, string>;
  years: number[];
  modelCount: number;
  layers: FloodLayer[];
  method: string;
  caveats: string[];
}

export interface FloodHorizon {
  year: number;
  floodedFraction: number;
  meanFloodDepth: number | null;
}

export interface FloodLookup {
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
}

let cached: { manifest: FloodManifest; raster: Uint16Array; index: Map<string, number> } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function layerKey(indicator: string, scenario: string, year: number): string {
  return `${indicator}|${scenario}|${year}`;
}

function load(): { manifest: FloodManifest; raster: Uint16Array; index: Map<string, number> } {
  if (cached) return cached;
  const manifest = JSON.parse(
    fs.readFileSync(dataPath("data/flood-river.aqueduct.json"), "utf-8"),
  ) as FloodManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.raster.file}`));
  const buf = gunzipSync(gz);
  const expected = manifest.layers.length * manifest.raster.layerCells * 2;
  if (buf.length !== expected) {
    throw new Error(`flood raster size ${buf.length} != expected ${expected}`);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const raster = new Uint16Array(ab);
  const index = new Map<string, number>();
  for (const layer of manifest.layers) {
    index.set(layerKey(layer.indicator, layer.scenario, layer.year), layer.offset);
  }
  cached = { manifest, raster, index };
  return cached;
}

function cellIndex(m: FloodManifest, lat: number, lng: number): number | null {
  const { dlat, dlon, lat0, lon0, nlat, nlon } = m.raster;
  const row = Math.round((lat0 - lat) / dlat);
  let col = Math.round((lng - lon0) / dlon);
  col = ((col % nlon) + nlon) % nlon;
  if (row < 0 || row >= nlat) return null;
  return row * nlon + col;
}

export function lookupRiverFlood(lat: number, lng: number, scenario: string): FloodLookup | null {
  const { manifest, raster, index } = load();
  const mapped = manifest.scenarioMap[scenario];
  if (!mapped) return null; // ssp126 / ssp370 (or any unmapped scenario) -> no Aqueduct match
  const idx = cellIndex(manifest, lat, lng);
  if (idx === null) return null;
  const { fill } = manifest.raster;
  const fracScale = manifest.indicators.floodedFraction.scale;
  const depthScale = manifest.indicators.meanFloodDepth.scale;

  const horizons: FloodHorizon[] = manifest.years.map((year) => {
    // Layers are keyed by the fupit scenario id (the build stores e.g. "ssp585"),
    // while scenarioMap only records the Aqueduct RCP it was sourced from.
    const fracOffset = index.get(layerKey("floodedFraction", scenario, year));
    const depthOffset = index.get(layerKey("meanFloodDepth", scenario, year));
    const fracRaw = fracOffset === undefined ? fill : raster[fracOffset + idx];
    const depthRaw = depthOffset === undefined ? fill : raster[depthOffset + idx];
    return {
      year,
      // A dry cell (fill) is genuinely 0% flooded, not missing data.
      floodedFraction: fracRaw === fill ? 0 : Math.round(fracRaw * fracScale * 1000) / 1000,
      // Depth is undefined where nothing floods.
      meanFloodDepth: depthRaw === fill ? null : Math.round(depthRaw * depthScale * 100) / 100,
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
    returnPeriod: manifest.returnPeriod,
    scenario,
    aqueductScenario: mapped,
    aqueductScenarioLabel: manifest.scenarioLabels[mapped] ?? mapped,
    modelCount: manifest.modelCount,
    horizons,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}

/** Lightweight summary for the data-quality report (no per-cell raster). */
export function floodRiverArtifactSummary() {
  const { manifest } = load();
  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    indicator: manifest.indicator,
    indicatorLabel: manifest.indicatorLabel,
    license: manifest.license,
    attribution: manifest.attribution,
    returnPeriod: manifest.returnPeriod,
    modelCount: manifest.modelCount,
    years: manifest.years,
    scenarioMap: manifest.scenarioMap,
    resolutionDegrees: manifest.raster.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
