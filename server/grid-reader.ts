import { gunzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type GridDefinition = {
  nlat: number;
  nlon: number;
  lat0: number;
  lon0: number;
  dlat: number;
  dlon: number;
};

type LayerManifest = {
  layer: string;
  scenario: string;
  var: string;
  scale: number;
  shape: [number, number, number];
  offset: number;
  bytes: number;
  decades?: number[];
  months?: number[];
};

type GridManifest = {
  grid: GridDefinition;
  fill: number;
  binary: string;
  layers: LayerManifest[];
  calibration?: {
    factors?: Record<string, Record<string, { k: number | string }>>;
  };
  source?: Record<string, unknown>;
};

type LoadedLayer = LayerManifest & {
  axis: number[];
  data: Int16Array;
};

type LoadedGrid = {
  grid: GridDefinition;
  fill: number;
  layers: Map<string, LoadedLayer>;
  calibration?: GridManifest["calibration"];
  source?: Record<string, unknown>;
};

type LayerKey = {
  layer: string;
  scenario: string;
  variable: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDir = path.join(repoRoot, "data");
let primaryGrid: LoadedGrid | undefined;
let observedGrid: LoadedGrid | undefined;

function layerId(key: LayerKey): string {
  return `${key.layer}\u0000${key.scenario}\u0000${key.variable}`;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unshuffleInt16(shuffled: Buffer): Int16Array {
  if (shuffled.length % 2 !== 0) {
    throw new Error(`invalid shuffled int16 byte length ${shuffled.length}`);
  }
  const half = shuffled.length / 2;
  const unshuffled = Buffer.allocUnsafe(shuffled.length);
  for (let i = 0; i < half; i++) {
    unshuffled[i * 2] = shuffled[i];
    unshuffled[i * 2 + 1] = shuffled[half + i];
  }
  return new Int16Array(unshuffled.buffer, unshuffled.byteOffset, half);
}

function loadGridArtifact(manifestName: string, dataDir = defaultDataDir): LoadedGrid {
  const manifestPath = path.join(dataDir, manifestName);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as GridManifest;
  const raw = gunzipSync(fs.readFileSync(path.join(dataDir, manifest.binary)));
  const layers = new Map<string, LoadedLayer>();

  for (const entry of manifest.layers) {
    const axis = entry.decades ?? entry.months ?? [0];
    const data = unshuffleInt16(raw.subarray(entry.offset, entry.offset + entry.bytes));
    const expectedCells = entry.shape.reduce((product, value) => product * value, 1);
    if (data.length !== expectedCells) {
      throw new Error(
        `${manifestName}:${entry.layer}/${entry.scenario}/${entry.var} decoded ${data.length} cells; expected ${expectedCells}`,
      );
    }
    layers.set(
      layerId({ layer: entry.layer, scenario: entry.scenario, variable: entry.var }),
      { ...entry, axis, data },
    );
  }

  return {
    grid: manifest.grid,
    fill: manifest.fill,
    layers,
    calibration: manifest.calibration,
    source: manifest.source,
  };
}

export function loadPrimaryGrid(dataDir = defaultDataDir): LoadedGrid {
  if (!primaryGrid || dataDir !== defaultDataDir) {
    const loaded = loadGridArtifact("manifest.json", dataDir);
    if (dataDir === defaultDataDir) primaryGrid = loaded;
    return loaded;
  }
  return primaryGrid;
}

export function loadObservedGrid(dataDir = defaultDataDir): LoadedGrid {
  if (!observedGrid || dataDir !== defaultDataDir) {
    const loaded = loadGridArtifact("worldclim10m.manifest.json", dataDir);
    if (dataDir === defaultDataDir) observedGrid = loaded;
    return loaded;
  }
  return observedGrid;
}

function rawAt(layer: LoadedLayer, grid: GridDefinition, axisIndex: number, row: number, col: number): number {
  const [, nlat, nlon] = layer.shape;
  if (nlat !== grid.nlat || nlon !== grid.nlon) {
    throw new Error(`${layer.layer}/${layer.scenario}/${layer.var} shape does not match grid definition`);
  }
  return layer.data[axisIndex * nlat * nlon + row * nlon + col];
}

function bilinear(layer: LoadedLayer, grid: GridDefinition, fill: number, axisIndex: number, lat: number, lng: number): number {
  const fractionalRow = (lat - grid.lat0) / grid.dlat;
  const fractionalCol = positiveModulo(lng - grid.lon0, 360) / grid.dlon;
  const row0 = Math.floor(fractionalRow);
  const col0 = Math.floor(fractionalCol);
  const rowWeight = fractionalRow - row0;
  const colWeight = fractionalCol - col0;
  let total = 0;
  let weightSum = 0;

  for (const [rowDelta, rowPart] of [[0, 1 - rowWeight], [1, rowWeight]] as const) {
    const row = clamp(row0 + rowDelta, 0, grid.nlat - 1);
    for (const [colDelta, colPart] of [[0, 1 - colWeight], [1, colWeight]] as const) {
      const col = positiveModulo(col0 + colDelta, grid.nlon);
      const rawValue = rawAt(layer, grid, axisIndex, row, col);
      if (rawValue === fill) continue;
      const weight = rowPart * colPart;
      total += weight * rawValue * layer.scale;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? total / weightSum : Number.NaN;
}

export function sampleGridLayer(
  loadedGrid: LoadedGrid,
  key: LayerKey,
  lat: number,
  lng: number,
  axisValue: number,
): number {
  const layer = loadedGrid.layers.get(layerId(key));
  if (!layer) return Number.NaN;
  const axis = layer.axis;
  const clampedAxis = clamp(axisValue, axis[0], axis[axis.length - 1]);
  const highIndex = axis.findIndex((value) => value >= clampedAxis);
  const hi = highIndex >= 0 ? highIndex : axis.length - 1;
  const lo = Math.max(hi - 1, 0);
  const lowValue = bilinear(layer, loadedGrid.grid, loadedGrid.fill, lo, lat, lng);

  if (lo === hi || axis[hi] === axis[lo]) return lowValue;
  const highValue = bilinear(layer, loadedGrid.grid, loadedGrid.fill, hi, lat, lng);
  if (Number.isNaN(lowValue)) return highValue;
  if (Number.isNaN(highValue)) return lowValue;
  const t = (clampedAxis - axis[lo]) / (axis[hi] - axis[lo]);
  return lowValue + t * (highValue - lowValue);
}

export function describeGridLayerAxis(loadedGrid: LoadedGrid, key: LayerKey, axisValue: number): Record<string, unknown> {
  const layer = loadedGrid.layers.get(layerId(key));
  if (!layer) {
    return {
      requested_year: axisValue,
      cadence: "projection year basis unavailable because the scenario layer is missing",
      mode: "missing",
    };
  }
  const axis = layer.axis;
  const effective = clamp(axisValue, axis[0], axis[axis.length - 1]);
  const highIndex = axis.findIndex((value) => value >= effective);
  const hi = highIndex >= 0 ? highIndex : axis.length - 1;
  const lo = Math.max(hi - 1, 0);
  const sourceLow = axis[lo];
  const sourceHigh = axis[hi];
  const cadence = "scenario layers are decadal 2030-2100; in-between years are linearly interpolated";
  let mode: string;
  let note: string;
  if (axisValue < axis[0]) {
    mode = "clamped-earliest-source-year";
    note = `Requested year ${axisValue} is before the first packed scenario layer; the earliest available ${sourceLow} source layer is used.`;
  } else if (axisValue > axis[axis.length - 1]) {
    mode = "clamped-latest-source-year";
    note = `Requested year ${axisValue} is after the last packed scenario layer; the latest available ${sourceHigh} source layer is used.`;
  } else if (lo === hi || sourceLow === sourceHigh) {
    mode = "direct-source-year";
    note = `Requested year ${axisValue} uses the packed ${sourceLow} source layer.`;
  } else {
    mode = "linear-interpolation";
    note = `Requested year ${axisValue} is linearly interpolated between packed ${sourceLow} and ${sourceHigh} source layers.`;
  }
  return {
    requested_year: axisValue,
    source_year_low: sourceLow,
    source_year_high: sourceHigh,
    effective_source_year: Math.round(effective * 100) / 100,
    mode,
    cadence,
    note,
  };
}

export function samplePrimaryLayer(key: LayerKey, lat: number, lng: number, axisValue: number): number {
  return sampleGridLayer(loadPrimaryGrid(), key, lat, lng, axisValue);
}

export function describePrimaryLayerAxis(key: LayerKey, axisValue: number): Record<string, unknown> {
  return describeGridLayerAxis(loadPrimaryGrid(), key, axisValue);
}

export function sampleObservedBaseline(scenario: "temperature" | "precipitation", lat: number, lng: number, month: number): number {
  return sampleGridLayer(
    loadObservedGrid(),
    { layer: "observed-baseline", scenario, variable: "clim" },
    lat,
    lng,
    month,
  );
}
