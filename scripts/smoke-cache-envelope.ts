import assert from "node:assert/strict";
import {
  MODEL_CACHE_VERSION,
  SOURCE_REGISTRY_VERSION,
  unwrapModelProjectionFromCache,
  wrapModelProjectionForCache,
} from "../server/model-cache-version";

const projection = {
  year: 2050,
  scenario: "ssp245",
  temperature: { monthly: Array.from({ length: 12 }, () => 1) },
};

const wrapped = wrapModelProjectionForCache(projection, "ssp245");
assert.equal(wrapped.__cache.modelVersion, MODEL_CACHE_VERSION);
assert.equal(wrapped.__cache.sourceRegistryVersion, SOURCE_REGISTRY_VERSION);
assert.equal(wrapped.__cache.scenario, "ssp245");
assert.deepEqual(unwrapModelProjectionFromCache(wrapped, "ssp245"), projection);
assert.equal(unwrapModelProjectionFromCache(wrapped, "ssp585"), undefined);

assert.equal(unwrapModelProjectionFromCache({ projection }, "ssp245"), undefined);
assert.equal(
  unwrapModelProjectionFromCache({
    __cache: {
      modelVersion: MODEL_CACHE_VERSION,
      scenario: "ssp245",
      sourceRegistryVersion: "old-source-registry",
    },
    projection,
  }, "ssp245"),
  undefined,
);

console.log("cache envelope smoke passed");
