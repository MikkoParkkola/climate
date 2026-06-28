#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCommit = "117488dc884bad03366ff727eca013e434615127";
const sourceUrl =
  `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${sourceCommit}/geojson/ne_110m_coastline.geojson`;
const outPath = path.join(repoRoot, "client", "public", "coastal-proximity.natural-earth-110m.json");
const coordinatePrecision = 2;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function roundCoord(value) {
  return Number(Number(value).toFixed(coordinatePrecision));
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "fupit-coastline-builder" } });
assert(response.ok, `Natural Earth coastline fetch failed: HTTP ${response.status}`);
const source = await response.json();
assert(source.type === "FeatureCollection" && Array.isArray(source.features), "Natural Earth coastline GeoJSON invalid");

const lines = [];
for (const feature of source.features) {
  const geometry = feature.geometry ?? {};
  const coordinates = geometry.coordinates ?? [];
  const rawLines =
    geometry.type === "LineString" ? [coordinates] :
      geometry.type === "MultiLineString" ? coordinates :
        [];

  for (const rawLine of rawLines) {
    const line = rawLine
      .map((coord) => [roundCoord(coord?.[0]), roundCoord(coord?.[1])])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    if (line.length >= 2) lines.push(line);
  }
}

const pointCount = lines.reduce((total, line) => total + line.length, 0);
assert(lines.length >= 100, "Natural Earth coastline line count unexpectedly small");
assert(pointCount >= 3000, "Natural Earth coastline point count unexpectedly small");

const artifact = {
  catalog: "natural_earth_coastline_110m",
  label: "Natural Earth 1:110m coastline proximity",
  version: `natural-earth-vector-${sourceCommit.slice(0, 12)}`,
  sourceId: "natural-earth-coastline-110m-v5",
  sourceUrl,
  sourceCommit,
  license: "Natural Earth public-domain map data; attribution requested.",
  generatedAt: new Date().toISOString(),
  coordinatePrecision,
  coastalThresholdKm: 50,
  nearCoastalThresholdKm: 100,
  regionalThresholdKm: 250,
  method:
    "Client computes nearest distance to packaged Natural Earth 1:110m coastline line segments using a coarse equirectangular approximation. This is a regional coastal-relevance screen only, not an elevation, storm-surge, subsidence, tide, defense, river, drainage, or parcel-exposure model.",
  caveats: [
    "Natural Earth 1:110m coastlines are generalized basemap geometry and are not parcel-scale exposure data.",
    "No elevation, tides, storm surge, subsidence, coastal defenses, rivers, drainage, or local engineering data are included.",
    "Inland locations can still see regional AR6 sea-level context, but not as a claim of local exposure.",
  ],
  lineCount: lines.length,
  pointCount,
  lines,
};

writeFileSync(outPath, `${JSON.stringify(artifact)}\n`);
console.log(`wrote ${path.relative(repoRoot, outPath)} with ${lines.length} lines and ${pointCount} points`);
