import fs from "node:fs";
import path from "node:path";
import { locationSlug } from "./location-catalog";

/**
 * Historical observed (1980-2024) annual temperature + precipitation for the
 * curated ~45-city catalog (data/ranking_cities.json), sourced from Open-Meteo's
 * ERA5 archive by scripts/build_historical_observed.py (MIK-6777). That script
 * runs incrementally in the background and rewrites data/historical-observed.
 * openmeteo.json atomically every run, filling in more years over time -- so the
 * artifact is (by design) partial and growing, never assumed complete here.
 *
 * Deliberately NOT module-cached: the ingest script can rewrite the file between
 * requests, and re-parsing a ~45-city JSON file on every request is cheap (small
 * file, no per-request external calls), so a fresh read is simpler and always
 * fresh than adding an mtime-watch/invalidation path for a dataset this size.
 */

const START_YEAR = 1980;
const END_YEAR = 2024;
const TOTAL_YEARS = END_YEAR - START_YEAR + 1;

interface HistoricalObservedCity {
  name?: string;
  country?: string;
  lat?: number;
  lng?: number;
  years?: number[];
  tempC?: (number | null)[];
  precipMm?: (number | null)[];
}

interface HistoricalObservedArtifact {
  version?: string;
  source?: string;
  period?: string;
  coverage?: string;
  cities?: HistoricalObservedCity[];
  skipped_cities?: string[];
}

function artifactPath(): string {
  return path.resolve(import.meta.dirname, "..", "data", "historical-observed.openmeteo.json");
}

function loadArtifact(): HistoricalObservedArtifact | null {
  try {
    const raw = fs.readFileSync(artifactPath(), "utf-8");
    return JSON.parse(raw) as HistoricalObservedArtifact;
  } catch {
    // File not written yet by the ingest script, or transiently unreadable
    // mid-write -- treat as "no data yet", never a hard error.
    return null;
  }
}

export interface HistoricalObservedResult {
  name: string;
  country: string;
  years: number[];
  tempC: (number | null)[];
  precipMm: (number | null)[];
  period: string;
  coverageNote: string;
}

// Look up the curated-catalog city matching (name, country) via the same slug
// scheme used everywhere else in the app (server/location-catalog.ts), NOT
// lat/lng equality -- callers pass a free-text location that may not
// float-match the catalog's coordinates exactly. Pure function (no file I/O)
// so it is directly unit-testable against an in-memory fixture artifact --
// see scripts/smoke-historical-observed.ts.
export function lookupFromArtifact(
  artifact: HistoricalObservedArtifact | null,
  name: string,
  country: string,
): HistoricalObservedResult | null {
  if (!artifact || !Array.isArray(artifact.cities)) return null;

  const targetSlug = locationSlug(name, country);
  const city = artifact.cities.find(
    (c) => typeof c.name === "string" && locationSlug(c.name, c.country ?? "") === targetSlug,
  );
  if (!city || !Array.isArray(city.years) || city.years.length === 0) return null;

  const years = city.years;
  const tempC = city.tempC ?? [];
  const precipMm = city.precipMm ?? [];
  const period = `${Math.min(...years)}-${Math.max(...years)}`;

  return {
    name: city.name!,
    country: city.country ?? "",
    years,
    tempC,
    precipMm,
    period,
    coverageNote: `${years.length} of ${TOTAL_YEARS} years so far`,
  };
}

// Request-facing entry point: reads the live artifact off disk (see the
// module-level comment above for why this is uncached) and delegates to the
// pure lookup above.
export function lookupHistoricalObserved(name: string, country: string): HistoricalObservedResult | null {
  return lookupFromArtifact(loadArtifact(), name, country);
}

