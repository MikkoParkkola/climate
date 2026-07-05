import { lookupFreshwater, freshwaterArtifactSummary } from "./freshwater";
import { lookupCropYield, cropYieldArtifactSummary } from "./crops";
import { lookupRiverFlood, floodRiverArtifactSummary } from "./floods";
import { lookupFireWeather, fireWeatherArtifactSummary } from "./fire-weather";
import { lookupHumidHeat, lookupColdSeason, lookupDegreeDays, nexGddpArtifactSummary } from "./nex-gddp";

/**
 * Honest per-enrichment coverage status for the climate-trajectory response.
 *
 * Each grounded enrichment (freshwater, crop yield, riverine flood, fire weather) only
 * publishes a subset of SSP pathways. When the requested scenario is not published but the
 * source DOES publish an adjacent pathway, we surface the nearest pathway's REAL value,
 * explicitly labeled — never an interpolated or fabricated number. This is the cardinal
 * no-fabricated-science rule applied at the coverage layer: a real adjacent-scenario value
 * with a clear label beats either silence or a made-up substitute.
 */

export type CoverageStatusKind =
  | "available"
  | "unavailable_scenario"
  | "unavailable_location"
  | "withheld";

export interface NearestScenario {
  /** SSP id of the nearest published pathway (e.g. "ssp370"). */
  scenario: string;
  /** The REAL lookup result for that pathway at this location (same shape as the served enrichment). */
  value: unknown;
  /** Plain-language label clarifying this is a labeled substitution, not interpolation. */
  note: string;
}

export interface CoverageStatus {
  status: CoverageStatusKind;
  reason: string;
  /** The scenario actually served, or null when no value is served. */
  servedScenario: string | null;
  /** Real adjacent-scenario fallback when the requested scenario is unpublished, else null. */
  nearestScenario: NearestScenario | null;
}

export type EnrichmentKind =
  | "freshwater"
  | "cropYield"
  | "floodRiver"
  | "fireWeather"
  | "humidHeat"
  | "coldSeason"
  | "degreeDays";

const SCENARIO_ORDER = ["ssp126", "ssp245", "ssp370", "ssp585"] as const;

const SCENARIO_LABELS: Record<string, string> = {
  ssp126: "SSP1-2.6 (low)",
  ssp245: "SSP2-4.5 (intermediate)",
  ssp370: "SSP3-7.0 (high)",
  ssp585: "SSP5-8.5 (very high)",
};

interface KindConfig {
  label: string;
  summary: () => { scenarioMap: Record<string, string | null> };
  lookup: (lat: number, lng: number, scenario: string) => unknown;
}

// NEX-GDDP publishes all four SSPs directly, so its scenarioMap is the identity over whatever
// scenarios the artifact reports — no adjacent-scenario fallback is ever needed.
function nexScenarioMapSummary(): { scenarioMap: Record<string, string | null> } {
  const scenarioMap: Record<string, string | null> = {};
  for (const sc of nexGddpArtifactSummary().scenarios) scenarioMap[sc] = sc;
  return { scenarioMap };
}

const KIND_CONFIG: Record<EnrichmentKind, KindConfig> = {
  freshwater: {
    label: "WRI Aqueduct 4.0 water stress",
    summary: freshwaterArtifactSummary,
    lookup: lookupFreshwater,
  },
  cropYield: {
    label: "ISIMIP GGCMI crop-yield change",
    summary: cropYieldArtifactSummary,
    lookup: lookupCropYield,
  },
  floodRiver: {
    label: "WRI Aqueduct Floods riverine exposure",
    summary: floodRiverArtifactSummary,
    lookup: lookupRiverFlood,
  },
  fireWeather: {
    label: "Quilcaille 2023 CMIP6 Fire Weather Index",
    summary: fireWeatherArtifactSummary,
    lookup: lookupFireWeather,
  },
  humidHeat: {
    label: "NASA NEX-GDDP-CMIP6 humid-heat (wet-bulb)",
    summary: nexScenarioMapSummary,
    lookup: lookupHumidHeat,
  },
  coldSeason: {
    label: "NASA NEX-GDDP-CMIP6 cold-season indices",
    summary: nexScenarioMapSummary,
    lookup: lookupColdSeason,
  },
  degreeDays: {
    label: "NASA NEX-GDDP-CMIP6 degree-days",
    summary: nexScenarioMapSummary,
    lookup: lookupDegreeDays,
  },
};

function label(scenario: string): string {
  return SCENARIO_LABELS[scenario] ?? scenario;
}

/** A scenario is "in source" when scenarioMap maps it to a non-null source pathway. */
function scenarioInSource(scenarioMap: Record<string, string | null>, scenario: string): boolean {
  return Boolean(scenarioMap[scenario]);
}

/**
 * Nearest published pathway by warming-level distance. Ties (equidistant) break toward the
 * higher-warming pathway, which is the more conservative choice for a risk screen.
 */
function nearestAvailableScenario(
  requested: string,
  scenarioMap: Record<string, string | null>,
): string | null {
  const order = SCENARIO_ORDER as readonly string[];
  const i = order.indexOf(requested);
  if (i < 0) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (let j = 0; j < order.length; j++) {
    if (j === i) continue;
    const s = order[j];
    if (!scenarioInSource(scenarioMap, s)) continue;
    const dist = Math.abs(j - i);
    if (dist < bestDist || (dist === bestDist && best !== null && order.indexOf(best) < j)) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Compute the coverage status for one enrichment. `served` is the value the route already
 * computed for the requested scenario (or null). We reuse it instead of re-looking-up.
 */
export function buildCoverageStatus(
  kind: EnrichmentKind,
  lat: number,
  lng: number,
  requested: string,
  served: unknown,
): CoverageStatus {
  const cfg = KIND_CONFIG[kind];

  let scenarioMap: Record<string, string | null>;
  try {
    scenarioMap = cfg.summary().scenarioMap;
  } catch {
    return {
      status: "unavailable_location",
      reason: `${cfg.label} artifact is unavailable in this build.`,
      servedScenario: null,
      nearestScenario: null,
    };
  }

  if (served !== null && served !== undefined) {
    return {
      status: "available",
      reason: `Served directly from ${cfg.label} for ${label(requested)}.`,
      servedScenario: requested,
      nearestScenario: null,
    };
  }

  // served is null: either the scenario is published but this point has no grounded value,
  // or the scenario is simply not published by the source.
  if (scenarioInSource(scenarioMap, requested)) {
    return {
      status: "unavailable_location",
      reason: `${cfg.label} publishes ${label(requested)}, but no grounded value covers this location (e.g. open ocean, no river basin, or crop not grown here). No value is fabricated.`,
      servedScenario: null,
      nearestScenario: null,
    };
  }

  const nearest = nearestAvailableScenario(requested, scenarioMap);
  if (nearest) {
    let nearestValue: unknown = null;
    try {
      nearestValue = cfg.lookup(lat, lng, nearest);
    } catch {
      nearestValue = null;
    }
    if (nearestValue !== null && nearestValue !== undefined) {
      return {
        status: "unavailable_scenario",
        reason: `${label(requested)} is not published by ${cfg.label}; showing the nearest published pathway ${label(nearest)}, explicitly labeled (a real adjacent-scenario value, not interpolated or fabricated).`,
        servedScenario: null,
        nearestScenario: {
          scenario: nearest,
          value: nearestValue,
          note: `${label(requested)} not published by ${cfg.label}; nearest available ${label(nearest)}.`,
        },
      };
    }
    return {
      status: "unavailable_scenario",
      reason: `${label(requested)} is not published by ${cfg.label}; the nearest published pathway ${label(nearest)} has no grounded value at this location.`,
      servedScenario: null,
      nearestScenario: null,
    };
  }

  return {
    status: "unavailable_scenario",
    reason: `${label(requested)} is not published by ${cfg.label} and no adjacent pathway is available.`,
    servedScenario: null,
    nearestScenario: null,
  };
}
