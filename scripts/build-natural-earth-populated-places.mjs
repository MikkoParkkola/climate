#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCommit = "117488dc884bad03366ff727eca013e434615127";
const sourceUrl =
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${sourceCommit}/geojson/ne_110m_populated_places_simple.geojson`;
const minPopulation = 3_000_000;
const outPath = path.join(repoRoot, "data", "population-centers.natural-earth-110m.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "fupit-catalog-builder" } });
assert(response.ok, `Natural Earth fetch failed: HTTP ${response.status}`);
const source = await response.json();
assert(source.type === "FeatureCollection" && Array.isArray(source.features), "Natural Earth GeoJSON invalid");

const places = source.features
  .map((feature) => {
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates ?? [];
    const population = Number(props.pop_max);
    const lng = Number(coords[0] ?? props.longitude);
    const lat = Number(coords[1] ?? props.latitude);
    return {
      id: String(props.ne_id ?? `${props.nameascii}-${props.adm0name}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      name: String(props.nameascii || props.name || "Unknown"),
      country: String(props.adm0name || props.sov0name || "Unknown"),
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      population,
      populationField: "pop_max",
      scalerank: Number(props.scalerank),
      inclusionReason: `Natural Earth 1:110m populated place with pop_max >= ${minPopulation}`,
    };
  })
  .filter((place) =>
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    Number.isFinite(place.population) &&
    place.population >= minPopulation
  )
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));

assert(places.length >= 50, "Natural Earth population-center catalog unexpectedly small");

const artifact = {
  catalog: "natural_earth_populated_places_110m",
  label: "Natural Earth populated places, pop_max >= 3 million",
  version: `natural-earth-vector-${sourceCommit.slice(0, 12)}`,
  sourceId: "natural-earth-populated-places-110m-v5",
  sourceUrl,
  sourceCommit,
  license: "Natural Earth public-domain map data; attribution requested.",
  populationThreshold: minPopulation,
  populationField: "pop_max",
  generatedAt: new Date().toISOString(),
  places,
};

writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`wrote ${path.relative(repoRoot, outPath)} with ${places.length} places`);
