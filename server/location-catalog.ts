// ── Location catalog: slug ⇄ coordinates for crawlable per-place pages ────────
// The growth engine gives every catalog city a clean, shareable URL
// (`/place/<slug>`, e.g. `amsterdam-netherlands`). This module is the single
// source of truth for that slug scheme, used by both the per-location SSR head
// injection (server/routes.ts) and the sitemap generator (scripts/build-sitemap.mjs).
//
// Corpus = curated ranking cities (data/ranking_cities.json) merged with the
// Natural Earth populated-places catalog (data/population-centers.natural-earth-110m.json).
// Both list real cities with coordinates; we dedupe by slug so a city present in
// both appears once. Arbitrary points (not in the catalog) are still addressable
// via a coordinate slug (`<lat>,<lng>`), so any place on Earth has a stable URL.
import fs from "fs";
import path from "path";

export interface CatalogLocation {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export interface ResolvedPlace extends CatalogLocation {
  source: "catalog" | "coordinates";
}

// Lowercase, strip diacritics, collapse non-alphanumerics to single hyphens.
// "São Paulo" + "Brazil" -> "sao-paulo-brazil". Stable and URL-safe.
export function slugify(...parts: string[]): string {
  return parts
    .filter((p) => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function locationSlug(name: string, country: string): string {
  const base = slugify(name, country);
  return base || slugify(name) || "location";
}

// Canonical coordinate slug for an arbitrary point. Two decimals (~1.1 km) keeps
// it short and matches the model's cache-key rounding granularity.
export function coordinateSlug(lat: number, lng: number): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(lat)},${r(lng)}`;
}

function dataFile(file: string): string | null {
  const candidates = [
    path.resolve(import.meta.dirname, "..", "data", file), // prod: dist/../data, dev: server/../data
    path.resolve(process.cwd(), "data", file),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

type CuratedCity = { name?: string; country?: string; lat?: number; lng?: number };
type PopulatedPlacesArtifact = { places?: CuratedCity[] };

let cached: Map<string, CatalogLocation> | undefined;

// Build (once) the merged, deduped slug -> location map. Curated cities are added
// first so they win on slug collision (richer hand-picked metadata); Natural
// Earth places fill in the rest of the global corpus.
function buildCatalog(): Map<string, CatalogLocation> {
  if (cached) return cached;
  const map = new Map<string, CatalogLocation>();

  const add = (raw: CuratedCity) => {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const country = typeof raw.country === "string" ? raw.country.trim() : "";
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const slug = locationSlug(name, country);
    if (map.has(slug)) return;
    map.set(slug, { slug, name, country, lat, lng });
  };

  try {
    const curatedPath = dataFile("ranking_cities.json");
    if (curatedPath) {
      const curated = JSON.parse(fs.readFileSync(curatedPath, "utf-8")) as CuratedCity[];
      if (Array.isArray(curated)) curated.forEach(add);
    }
  } catch {
    // curated catalog optional — Natural Earth still provides a corpus
  }

  try {
    const nePath = dataFile("population-centers.natural-earth-110m.json");
    if (nePath) {
      const ne = JSON.parse(fs.readFileSync(nePath, "utf-8")) as PopulatedPlacesArtifact;
      if (Array.isArray(ne.places)) ne.places.forEach(add);
    }
  } catch {
    // Natural Earth catalog optional
  }

  cached = map;
  return map;
}

export function listCatalogLocations(): CatalogLocation[] {
  return Array.from(buildCatalog().values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getLocationBySlug(slug: string): CatalogLocation | null {
  return buildCatalog().get(slug) ?? null;
}

// Parse a coordinate slug ("<lat>,<lng>", also accepts "_" separator and
// URL-encoded forms). Returns null if it is not a valid coordinate pair.
export function parseCoordinateSlug(slug: string): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(slug).trim();
  const m = decoded.match(/^(-?\d{1,3}(?:\.\d+)?)[,_](-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Resolve any `/place/<slug>` segment to a concrete location, preferring a known
// catalog city, then falling back to a coordinate slug for arbitrary points.
export function resolvePlaceSlug(rawSlug: string): ResolvedPlace | null {
  if (typeof rawSlug !== "string" || rawSlug.trim() === "") return null;
  const decoded = decodeURIComponent(rawSlug).trim();
  const normalized = decoded.toLowerCase();

  const catalog = getLocationBySlug(normalized);
  if (catalog) return { ...catalog, source: "catalog" };

  const coords = parseCoordinateSlug(decoded);
  if (coords) {
    return {
      slug: coordinateSlug(coords.lat, coords.lng),
      name: `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`,
      country: "",
      lat: coords.lat,
      lng: coords.lng,
      source: "coordinates",
    };
  }
  return null;
}
