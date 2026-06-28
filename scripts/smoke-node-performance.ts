import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { climateTrajectory } from "../server/grounded-node-model";

const baselineYear = 2025;
const currentYear = Math.min(Math.max(new Date().getFullYear(), 2026), 2100);
const years = Array.from(new Set([
  baselineYear,
  currentYear,
  ...Array.from({ length: (2100 - 2030) / 5 + 1 }, (_, index) => 2030 + index * 5),
])).sort((a, b) => a - b);
const p95TargetMs = Number(process.env.FUPIT_NODE_TRAJECTORY_P95_MS ?? 500);

const samples = [
  { name: "Helsinki", lat: 60.17, lng: 24.94, scenario: "ssp126" },
  { name: "London", lat: 51.51, lng: -0.13, scenario: "ssp245" },
  { name: "Amsterdam", lat: 52.37, lng: 4.9, scenario: "ssp370" },
  { name: "Paris", lat: 48.86, lng: 2.35, scenario: "ssp585" },
  { name: "Prague", lat: 50.08, lng: 14.44, scenario: "ssp245" },
  { name: "Kyiv", lat: 50.45, lng: 30.52, scenario: "ssp370" },
  { name: "Bangkok", lat: 13.76, lng: 100.5, scenario: "ssp585" },
  { name: "New York", lat: 40.71, lng: -74.01, scenario: "ssp245" },
  { name: "San Francisco", lat: 37.77, lng: -122.42, scenario: "ssp126" },
  { name: "Singapore", lat: 1.35, lng: 103.82, scenario: "ssp370" },
  { name: "Mumbai", lat: 19.08, lng: 72.88, scenario: "ssp585" },
  { name: "Cairo", lat: 30.04, lng: 31.24, scenario: "ssp245" },
  { name: "Manaus", lat: -3.12, lng: -60.02, scenario: "ssp370" },
];

type ProjectionPoint = Record<string, unknown>;

function valueAt(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function collectNullPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null) return [prefix || "<root>"];
  if (Array.isArray(obj)) {
    return obj.flatMap((item, index) => collectNullPaths(item, `${prefix}[${index}]`));
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).flatMap(([key, value]) => collectNullPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return [];
}

function assertTrajectoryContract(sample: (typeof samples)[number], points: ProjectionPoint[]): void {
  assert.equal(points.length, years.length, `${sample.name}: trajectory point count mismatch`);

  for (const point of points) {
    assert.equal(valueAt(point, "scenario"), sample.scenario, `${sample.name}: scenario mismatch`);
    assert.ok(years.includes(valueAt(point, "year") as number), `${sample.name}: unexpected year`);

    for (const pathName of [
      "temperature.annual_mean",
      "temperature.anomaly",
      "temperature.ipcc_calibrated.annual_mean",
      "precipitation.annual_total",
      "extremes.heat_stress_days",
      "extremes.drought_risk",
      "extremes.flood_risk",
      "habitability.score",
      "metadata.model_version",
      "metadata.projection_year_basis.mode",
    ]) {
      assert.notEqual(valueAt(point, pathName), undefined, `${sample.name}: missing ${pathName}`);
    }

    for (const pathName of ["temperature.monthly", "temperature.ipcc_calibrated.monthly", "precipitation.monthly"]) {
      const value = valueAt(point, pathName);
      assert.ok(Array.isArray(value), `${sample.name}: ${pathName} is not an array`);
      assert.equal(value.length, 12, `${sample.name}: ${pathName} must have 12 months`);
      assert.ok(value.every((item) => typeof item === "number" && Number.isFinite(item)), `${sample.name}: ${pathName} contains non-finite values`);
    }

    const nulls = collectNullPaths(point);
    assert.equal(nulls.length, 0, `${sample.name}: null values in projected point: ${nulls.slice(0, 8).join(", ")}`);
  }
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

// Warm the gzip decode and in-memory artifact maps before measuring steady-state
// Node grid lookups. Cold-start time is covered separately by build/start checks.
climateTrajectory(samples[0].lat, samples[0].lng, years, samples[0].scenario);

const durations = [];
for (const sample of samples) {
  const started = performance.now();
  const result = climateTrajectory(sample.lat, sample.lng, years, sample.scenario) as { points: ProjectionPoint[] };
  const elapsed = performance.now() - started;
  assertTrajectoryContract(sample, result.points);
  durations.push(elapsed);
}

const p50 = percentile(durations, 50);
const p95 = percentile(durations, 95);
const max = Math.max(...durations);

assert.ok(
  p95 <= p95TargetMs,
  `Node trajectory p95 ${p95.toFixed(1)}ms exceeded target ${p95TargetMs}ms for ${years.length}-point trajectories`,
);

console.log(
  `node performance smoke passed: ${samples.length} warm ${years.length}-point trajectories; ` +
  `p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms target=${p95TargetMs}ms`,
);
