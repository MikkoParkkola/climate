import assert from "node:assert/strict";
import { lookupHistoricalObserved, lookupFromArtifact } from "../server/historical-observed";

// Historical observed (1980-2024, curated ~45-city catalog only) smoke test.
// The real artifact (data/historical-observed.openmeteo.json) is populated
// incrementally by a live background process (scripts/build_historical_observed.py)
// and is deliberately NOT touched here -- this test exercises the pure
// lookupFromArtifact() matching/shaping logic against in-memory fixtures, plus
// confirms the file-backed entry point degrades to null when no artifact exists.

// 1. No artifact on disk (or unreadable) -> null, never a throw.
assert.equal(lookupHistoricalObserved("Helsinki", "Finland"), null);

// 2. Slug-based match (server/location-catalog.ts scheme), not lat/lng equality.
const fixture = {
  version: "historical-observed-v1",
  cities: [
    { name: "Helsinki", country: "Finland", lat: 60.17, lng: 24.94, years: [1985, 2024], tempC: [4.1, 5.9], precipMm: [650, 700] },
    { name: "São Paulo", country: "Brazil", lat: -23.55, lng: -46.63, years: [2024], tempC: [19.8], precipMm: [1400] },
    { name: "Sparse City", country: "Nowhere", lat: 0, lng: 0, years: [2000, 2010, 2020], tempC: [10, null, 12], precipMm: [100, 110, null] },
  ],
};

const helsinki = lookupFromArtifact(fixture, "Helsinki", "Finland");
assert.ok(helsinki, "Helsinki should resolve via slug match");
assert.deepEqual(helsinki!.years, [1985, 2024]);
assert.deepEqual(helsinki!.tempC, [4.1, 5.9]);
assert.equal(helsinki!.period, "1985-2024");
assert.equal(helsinki!.coverageNote, "2 of 45 years so far");

// Diacritics-insensitive match ("Sao Paulo" without the accent still resolves).
const saoPaulo = lookupFromArtifact(fixture, "Sao Paulo", "Brazil");
assert.ok(saoPaulo, "unaccented name should still slug-match São Paulo");
assert.equal(saoPaulo!.years.length, 1);

// 3. A city not in the curated catalog at all -> null (expected/normal, not an error).
assert.equal(lookupFromArtifact(fixture, "Nowhere Special", "Atlantis"), null);

// 4. Partial (sparse) coverage is passed through as-is, including nulls -- the
// frontend, not this module, is responsible for dropping null years before
// charting (see obsTempIdx in climate-result-sections-top.tsx).
const sparse = lookupFromArtifact(fixture, "Sparse City", "Nowhere");
assert.ok(sparse);
assert.equal(sparse!.tempC[1], null);
assert.equal(sparse!.coverageNote, "3 of 45 years so far");

// 5. Malformed/empty artifact shapes never throw.
assert.equal(lookupFromArtifact(null, "Helsinki", "Finland"), null);
assert.equal(lookupFromArtifact({}, "Helsinki", "Finland"), null);
assert.equal(lookupFromArtifact({ cities: [{ name: "Helsinki", country: "Finland", years: [] }] }, "Helsinki", "Finland"), null);

console.log("historical-observed smoke passed");
