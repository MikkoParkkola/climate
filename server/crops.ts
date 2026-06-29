import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded crop-yield lookup over the ISIMIP3b GGCMI phase 3 artifact
 * (see scripts/build_isimip_crops.py). Given a point + fupit SSP id, returns the
 * multi-member ensemble-mean percentage change in rainfed yield for four staple crops
 * (maize, soybean, rice, winter wheat) at the 2030/2050/2080 horizons relative to a
 * 2015-2034 baseline, for the containing 0.5-degree cell. ssp126/ssp370/ssp585 are served
 * directly; ssp245 is not in the GGCMI3b core protocol and returns null. A crop that is not
 * grown in the cell returns null for that crop; if no crop is grown, the whole lookup is
 * null. No value is invented.
 */

interface CropLayer {
  crop: string;
  scenario: string;
  year: number;
  offset: number;
}

interface CropManifest {
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
    pctOffset: number;
    pctScale: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
    layerCells: number;
  };
  crops: Record<string, string>;
  scenarioMap: Record<string, string | null>;
  scenarioLabels: Record<string, string>;
  years: number[];
  baselinePeriod: string;
  modelCount: number;
  memberCount: number;
  layers: CropLayer[];
  method: string;
  caveats: string[];
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

export interface CropYieldLookup {
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
}

let cached: { manifest: CropManifest; raster: Uint16Array; index: Map<string, number> } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function layerKey(crop: string, scenario: string, year: number): string {
  return `${crop}|${scenario}|${year}`;
}

function load(): { manifest: CropManifest; raster: Uint16Array; index: Map<string, number> } {
  if (cached) return cached;
  const manifest = JSON.parse(
    fs.readFileSync(dataPath("data/crop-yield.isimip-ggcmi.json"), "utf-8"),
  ) as CropManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.raster.file}`));
  const buf = gunzipSync(gz);
  const expected = manifest.layers.length * manifest.raster.layerCells * 2;
  if (buf.length !== expected) {
    throw new Error(`crop raster size ${buf.length} != expected ${expected}`);
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const raster = new Uint16Array(ab);
  const index = new Map<string, number>();
  for (const layer of manifest.layers) {
    index.set(layerKey(layer.crop, layer.scenario, layer.year), layer.offset);
  }
  cached = { manifest, raster, index };
  return cached;
}

function cellIndex(m: CropManifest, lat: number, lng: number): number | null {
  const { dlat, dlon, lat0, lon0, nlat, nlon } = m.raster;
  const row = Math.round((lat0 - lat) / dlat);
  let col = Math.round((lng - lon0) / dlon);
  col = ((col % nlon) + nlon) % nlon;
  if (row < 0 || row >= nlat) return null;
  return row * nlon + col;
}

export function lookupCropYield(lat: number, lng: number, scenario: string): CropYieldLookup | null {
  const { manifest, raster, index } = load();
  const mapped = manifest.scenarioMap[scenario];
  if (!mapped) return null; // ssp245 (or any unmapped scenario) -> not in GGCMI3b core protocol
  const idx = cellIndex(manifest, lat, lng);
  if (idx === null) return null;
  const { fill, pctOffset, pctScale } = manifest.raster;

  const crops: CropSeries[] = [];
  for (const crop of Object.keys(manifest.crops)) {
    const horizons: CropHorizon[] = manifest.years.map((year) => {
      const offset = index.get(layerKey(crop, mapped, year));
      const raw = offset === undefined ? fill : raster[offset + idx];
      return {
        year,
        yieldChangePercent: raw === fill ? null : Math.round((raw / pctScale - pctOffset) * 10) / 10,
      };
    });
    if (horizons.some((h) => h.yieldChangePercent !== null)) {
      crops.push({ crop, label: manifest.crops[crop], horizons });
    }
  }
  if (crops.length === 0) return null; // no staple crop grown in this cell

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
    baselinePeriod: manifest.baselinePeriod,
    crops,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}

/** Lightweight summary for the data-quality report (no per-cell raster). */
export function cropYieldArtifactSummary() {
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
    memberCount: manifest.memberCount,
    crops: manifest.crops,
    baselinePeriod: manifest.baselinePeriod,
    years: manifest.years,
    scenarioMap: manifest.scenarioMap,
    resolutionDegrees: manifest.raster.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
