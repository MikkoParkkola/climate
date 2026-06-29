import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Grounded Freshwater (water-stress) lookup over the WRI Aqueduct 4.0 future-annual
 * artifact (see scripts/build_aqueduct_freshwater.py). Given a point + fupit SSP id,
 * returns the Aqueduct water-stress category for the containing HydroBASINS sub-basin
 * at the 2030/2050/2080 horizons, or null when the scenario has no Aqueduct match
 * (ssp245) or no basin covers the point (open ocean / unclassified). No value is ever
 * invented: null means "not available", in line with the cardinal no-fabricated-science rule.
 */

type ScenarioCode = "opt" | "bau" | "pes";

interface FreshwaterManifest {
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
    noBasin: number;
    nlat: number;
    nlon: number;
    dlat: number;
    dlon: number;
    lat0: number;
    lon0: number;
  };
  legend: Record<string, string>;
  scenarioMap: Record<string, ScenarioCode | null>;
  scenarioLabels: Record<ScenarioCode, string>;
  years: number[];
  method: string;
  caveats: string[];
  basinCount: number;
  basins: Array<{
    pfaf_id: number | null;
    c: Record<ScenarioCode, Array<number | null>>;
    s: Record<ScenarioCode, Array<number | null>>;
    r: Record<ScenarioCode, Array<number | null>>;
  }>;
}

export interface FreshwaterHorizon {
  year: number;
  category: number | null;
  label: string | null;
  score: number | null;
  rawRatio: number | null;
}

export interface FreshwaterLookup {
  sourceId: string;
  version: string;
  indicator: string;
  indicatorLabel: string;
  attribution: string;
  license: string;
  stableUrl: string;
  scenario: string;
  aqueductScenario: ScenarioCode;
  aqueductScenarioLabel: string;
  pfafId: number | null;
  /** 0 when the point itself classified; >0 when the nearest basin within ~0.3° was used. */
  fallbackRings: number;
  horizons: FreshwaterHorizon[];
  method: string;
  caveats: string[];
}

// Nearest-basin search radius (in 0.1° cells) used only when the exact cell is
// unclassified, e.g. a coastal city whose 0.1° centre lands just offshore.
const MAX_FALLBACK_RINGS = 3;

let cached: { manifest: FreshwaterManifest; raster: Uint16Array } | undefined;

function dataPath(relativePath: string): string {
  return path.resolve(import.meta.dirname, "..", relativePath);
}

function load(): { manifest: FreshwaterManifest; raster: Uint16Array } {
  if (cached) return cached;
  const manifest = JSON.parse(
    fs.readFileSync(dataPath("data/freshwater-stress.aqueduct40.json"), "utf-8"),
  ) as FreshwaterManifest;
  const gz = fs.readFileSync(dataPath(`data/${manifest.raster.file}`));
  const buf = gunzipSync(gz);
  const expected = manifest.raster.nlat * manifest.raster.nlon * 2;
  if (buf.length !== expected) {
    throw new Error(`freshwater raster size ${buf.length} != expected ${expected}`);
  }
  // Copy to a fresh, 2-byte-aligned ArrayBuffer before viewing as Uint16.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const raster = new Uint16Array(ab);
  cached = { manifest, raster };
  return cached;
}

function cellBasin(raster: Uint16Array, m: FreshwaterManifest, row: number, col: number): number {
  const { nlat, nlon, noBasin } = m.raster;
  if (row < 0 || row >= nlat || col < 0 || col >= nlon) return noBasin;
  return raster[row * nlon + col];
}

/** Resolve the basin index for a point, with a small nearest-cell fallback. Returns null when none. */
function resolveBasin(
  raster: Uint16Array,
  m: FreshwaterManifest,
  lat: number,
  lng: number,
): { basin: number; rings: number } | null {
  const { dlat, dlon, lat0, lon0, noBasin } = m.raster;
  const row = Math.round((lat0 - lat) / dlat);
  const col = Math.round((lng - lon0) / dlon);
  const direct = cellBasin(raster, m, row, col);
  if (direct !== noBasin) return { basin: direct, rings: 0 };
  for (let ring = 1; ring <= MAX_FALLBACK_RINGS; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const b = cellBasin(raster, m, row + dr, col + dc);
        if (b !== noBasin) return { basin: b, rings: ring };
      }
    }
  }
  return null;
}

export function lookupFreshwater(lat: number, lng: number, scenario: string): FreshwaterLookup | null {
  const { manifest, raster } = load();
  const code = manifest.scenarioMap[scenario];
  if (!code) return null; // ssp245 (or any unmapped scenario) -> no Aqueduct match by design
  const resolved = resolveBasin(raster, manifest, lat, lng);
  if (!resolved) return null;
  const basin = manifest.basins[resolved.basin];
  if (!basin) return null;

  const horizons: FreshwaterHorizon[] = manifest.years.map((year, i) => {
    const category = basin.c[code]?.[i] ?? null;
    return {
      year,
      category,
      label: category === null ? null : manifest.legend[String(category)] ?? null,
      score: basin.s[code]?.[i] ?? null,
      rawRatio: basin.r[code]?.[i] ?? null,
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
    aqueductScenario: code,
    aqueductScenarioLabel: manifest.scenarioLabels[code],
    pfafId: basin.pfaf_id,
    fallbackRings: resolved.rings,
    horizons,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}

/** Lightweight summary for the data-quality report (no per-basin table). */
export function freshwaterArtifactSummary() {
  const { manifest } = load();
  return {
    sourceId: manifest.sourceId,
    version: manifest.version,
    provider: manifest.provider,
    indicator: manifest.indicator,
    indicatorLabel: manifest.indicatorLabel,
    license: manifest.license,
    attribution: manifest.attribution,
    basinCount: manifest.basinCount,
    years: manifest.years,
    scenarioMap: manifest.scenarioMap,
    resolutionDegrees: manifest.raster.dlat,
    method: manifest.method,
    caveats: manifest.caveats,
  };
}
