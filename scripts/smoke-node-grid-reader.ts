import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sampleObservedBaseline, samplePrimaryLayer } from "../server/grid-reader";

type PrimaryRequest = {
  kind: "primary";
  layer: string;
  scenario: string;
  variable: string;
  lat: number;
  lng: number;
  axisValue: number;
};

type ObservedRequest = {
  kind: "observed";
  scenario: "temperature" | "precipitation";
  lat: number;
  lng: number;
  axisValue: number;
};

type SampleRequest = PrimaryRequest | ObservedRequest;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pythonBin = process.env.PYTHON_BIN || "python3";
const coordinates = [
  { name: "Helsinki", lat: 60.17, lng: 24.94 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Manaus", lat: -3.12, lng: -60.02 },
  { name: "San Francisco", lat: 37.77, lng: -122.42 },
  { name: "Dateline Pacific", lat: 0.2, lng: 179.9 },
];

const primaryLayers = [
  { layer: "temperature", scenario: "ssp245", variable: "mean", axisValue: 2055 },
  { layer: "temperature", scenario: "ssp585", variable: "std", axisValue: 2095 },
  { layer: "precipitation", scenario: "ssp245", variable: "mean", axisValue: 2045 },
  { layer: "baseline", scenario: "temperature", variable: "clim", axisValue: 7 },
  { layer: "baseline", scenario: "precipitation", variable: "clim", axisValue: 1 },
  { layer: "baseline-extreme", scenario: "cdd", variable: "clim", axisValue: 0 },
  { layer: "extreme-tr", scenario: "ssp370", variable: "mean", axisValue: 2075 },
  { layer: "extreme-rx5day", scenario: "ssp126", variable: "std", axisValue: 2035 },
  { layer: "sealevel", scenario: "ssp585", variable: "high", axisValue: 2100 },
];

const requests: SampleRequest[] = [];
for (const point of coordinates) {
  for (const layer of primaryLayers) {
    requests.push({ kind: "primary", lat: point.lat, lng: point.lng, ...layer });
  }
  for (const scenario of ["temperature", "precipitation"] as const) {
    for (const month of [1, 4, 7, 10]) {
      requests.push({ kind: "observed", scenario, lat: point.lat, lng: point.lng, axisValue: month });
    }
  }
}

function pythonSamples(sampleRequests: SampleRequest[]): Array<number | null> {
  const script = `
import json, math, sys
import grounded_model
requests = json.load(sys.stdin)
out = []
for req in requests:
    if req["kind"] == "primary":
        value = grounded_model.sample(req["layer"], req["scenario"], req["variable"], req["lat"], req["lng"], req["axisValue"])
    else:
        value = grounded_model.sample_observed_baseline(req["scenario"], req["lat"], req["lng"], req["axisValue"])
    out.append(None if math.isnan(value) else value)
print(json.dumps(out))
`;
  const result = spawnSync(pythonBin, ["-c", script], {
    cwd: root,
    input: JSON.stringify(sampleRequests),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as Array<number | null>;
}

function nodeSample(request: SampleRequest): number {
  if (request.kind === "primary") {
    return samplePrimaryLayer(
      { layer: request.layer, scenario: request.scenario, variable: request.variable },
      request.lat,
      request.lng,
      request.axisValue,
    );
  }
  return sampleObservedBaseline(request.scenario, request.lat, request.lng, request.axisValue);
}

const expected = pythonSamples(requests);
let finiteComparisons = 0;
let missingComparisons = 0;

requests.forEach((request, index) => {
  const actual = nodeSample(request);
  const pythonValue = expected[index];
  const label =
    request.kind === "primary"
      ? `${request.layer}/${request.scenario}/${request.variable}@${request.axisValue} (${request.lat},${request.lng})`
      : `observed/${request.scenario}@${request.axisValue} (${request.lat},${request.lng})`;

  if (pythonValue === null) {
    assert.ok(Number.isNaN(actual), `${label}: Node returned ${actual}, Python returned missing`);
    missingComparisons++;
    return;
  }

  assert.ok(Number.isFinite(actual), `${label}: Node returned missing, Python returned ${pythonValue}`);
  assert.ok(
    Math.abs(actual - pythonValue) <= 1e-9,
    `${label}: Node ${actual} differed from Python ${pythonValue}`,
  );
  finiteComparisons++;
});

assert.ok(finiteComparisons > 0, "grid reader smoke made no finite comparisons");

console.log(
  `node grid-reader parity smoke passed (${finiteComparisons} finite comparisons, ${missingComparisons} missing-data comparisons)`,
);
