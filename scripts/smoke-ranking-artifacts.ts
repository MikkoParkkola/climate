import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRanking } from "../server/precomputed-rankings";
import { loadSourceRegistry } from "../server/source-registry";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rankingsPage = fs.readFileSync(path.join(repoRoot, "client", "src", "pages", "rankings.tsx"), "utf8");

assert.match(rankingsPage, /current-policy-reference-2025/, "rankings page explains the versioned current-policy default");
assert.match(rankingsPage, /UNEP current-policy and Climate Action Tracker/, "rankings page cites current-policy synthesis sources");
assert.match(rankingsPage, /not a prediction or hidden scenario average/, "rankings page avoids prophecy and hidden-average framing");
assert.match(rankingsPage, /natural_earth_populated_places_110m/, "rankings page exposes Natural Earth population-place catalog");
assert.match(rankingsPage, /natural_earth_country_population_place_weighted/, "rankings page exposes bounded country aggregate catalog");
assert.match(rankingsPage, /populationField/, "rankings page displays population-place field metadata");
assert.match(rankingsPage, /not population-weighted exposure/, "rankings page caveats Natural Earth catalog limits");
assert.match(rankingsPage, /not full national exposure/, "rankings page caveats country aggregate limits");

const registry = loadSourceRegistry();
assert.equal(registry.version, "source-registry-v1");
assert.ok(registry.rows.some((row) => row.sourceId === "cmip6-scenariomip"));
assert.ok(registry.rows.some((row) => row.sourceId === "natural-earth-populated-places-110m-v5"));
assert.ok(registry.rows.some((row) => row.sourceId === "natural-earth-country-population-weighted-v1"));

const habitability = getRanking({
  year: 2050,
  scenario: "ssp245",
  catalog: "curated_cities",
  metric: "habitability_score",
  direction: "highest",
  limit: 10,
});
assert.ok(habitability);
assert.equal(habitability.rows.length, 10);
assert.ok(habitability.sourceIds.every((sourceId) => registry.rows.some((row) => row.sourceId === sourceId)));
assert.ok(habitability.caveats.some((caveat) => caveat.includes("not complete global rankings")));

const unsupportedExtreme = getRanking({
  year: 2050,
  scenario: "ssp119",
  catalog: "curated_cities",
  metric: "heat_stress_days",
  direction: "highest",
  limit: 10,
});
assert.equal(unsupportedExtreme, undefined);

const populatedPlaces = getRanking({
  year: 2050,
  scenario: "ssp245",
  catalog: "natural_earth_populated_places_110m",
  metric: "heat_stress_days",
  direction: "highest",
  limit: 10,
});
assert.ok(populatedPlaces);
assert.equal(populatedPlaces.catalog, "natural_earth_populated_places_110m");
assert.ok(populatedPlaces.catalogSize >= 50);
assert.equal(populatedPlaces.rows.length, 10);
assert.ok(populatedPlaces.sourceIds.includes("natural-earth-populated-places-110m-v5"));
assert.ok(populatedPlaces.sourceIds.every((sourceId) => registry.rows.some((row) => row.sourceId === sourceId)));
assert.ok(populatedPlaces.caveats.some((caveat) => caveat.includes("pop_max >= 3,000,000")));
assert.ok(populatedPlaces.rows.every((row) => Number.isFinite(row.population) && row.population! >= 3_000_000));
assert.ok(populatedPlaces.rows.every((row) => row.populationField === "pop_max"));
assert.ok(populatedPlaces.rows.every((row) => String(row.inclusionReason ?? "").includes("Natural Earth")));

const countryAggregates = getRanking({
  year: 2050,
  scenario: "ssp245",
  catalog: "natural_earth_country_population_place_weighted",
  metric: "heat_stress_days",
  direction: "highest",
  limit: 10,
});
assert.ok(countryAggregates);
assert.equal(countryAggregates.catalog, "natural_earth_country_population_place_weighted");
assert.ok(countryAggregates.catalogSize >= 25);
assert.equal(countryAggregates.rows.length, 10);
assert.ok(countryAggregates.placeSampleSize && countryAggregates.placeSampleSize >= 50);
assert.ok(countryAggregates.sourceIds.includes("natural-earth-country-population-weighted-v1"));
assert.ok(countryAggregates.sourceIds.includes("natural-earth-populated-places-110m-v5"));
assert.ok(countryAggregates.sourceIds.every((sourceId) => registry.rows.some((row) => row.sourceId === sourceId)));
assert.ok(countryAggregates.caveats.some((caveat) => caveat.includes("not a complete national exposure")));
assert.ok(countryAggregates.rows.every((row) => row.country === "country aggregate"));
assert.ok(countryAggregates.rows.every((row) => Number.isFinite(row.population) && row.population! >= 3_000_000));
assert.ok(countryAggregates.rows.every((row) => row.populationField === "pop_max weighted included places"));
assert.ok(countryAggregates.rows.every((row) => Number.isFinite(row.placeCount) && row.placeCount! >= 1));
assert.ok(countryAggregates.rows.every((row) => Array.isArray(row.includedPlaces) && row.includedPlaces.length === row.placeCount));

console.log("ranking artifact smoke passed");
