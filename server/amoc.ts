/**
 * AMOC / Gulf Stream risk signal for the climate-trajectory response.
 *
 * A context-only, qualitative risk signal grounded in:
 *  - IPCC AR6 WGI: the Atlantic Meridional Overturning Circulation is very likely to weaken
 *    this century; an abrupt collapse before 2100 is assessed as low-confidence but
 *    high-impact (not the central assessment),
 *  - recent peer-reviewed early-warning literature that lowers confidence in AMOC stability
 *    (Ditlevsen & Ditlevsen 2023; van Westen et al. 2024).
 *
 * It applies NO deterministic local temperature correction. Per the cardinal
 * no-fabricated-science rule, `europeImpact` is a plain-language explanation of the
 * cooling-amid-warming paradox, not an invented local number or collapse date.
 */

export interface AmocCitation {
  /** Registered source id (see data/source-registry.json). */
  sourceId: string;
  title: string;
  doi: string | null;
  url: string;
  finding: string;
}

export interface AmocAssessment {
  /** True for AMOC-sensitive regions (NW Europe, North Atlantic seaboard) — flags prominence. */
  regionRelevant: boolean;
  status: "context-only";
  weakeningAssessment: string;
  collapseRisk: string;
  europeImpact: string;
  citations: AmocCitation[];
}

/**
 * AMOC-sensitive regions: NW Europe and the North Atlantic seaboard. Coarse bounding boxes
 * flag where the signal should be surfaced prominently; they do NOT assert a local correction.
 */
function isAmocRelevant(lat: number, lng: number): boolean {
  // NW Europe (British Isles, Nordics, Low Countries, N France, Iceland approaches).
  const nwEurope = lat >= 45 && lat <= 72 && lng >= -25 && lng <= 32;
  // NE North American / North Atlantic seaboard (US Northeast, Canadian Maritimes).
  const naSeaboard = lat >= 35 && lat <= 60 && lng >= -80 && lng <= -45;
  return nwEurope || naSeaboard;
}

const CITATIONS: AmocCitation[] = [
  {
    sourceId: "ipcc-ar6-amoc",
    title: "IPCC AR6 WGI — Atlantic Meridional Overturning Circulation assessment",
    doi: null,
    url: "https://www.ipcc.ch/report/ar6/wg1/",
    finding:
      "AMOC is very likely to weaken over the 21st century across all assessed emissions scenarios; an abrupt collapse before 2100 is assessed as low confidence but cannot be ruled out (a high-impact tail risk).",
  },
  {
    sourceId: "ditlevsen-2023-amoc",
    title:
      "Ditlevsen & Ditlevsen (2023) — Warning of a forthcoming collapse of the Atlantic meridional overturning circulation",
    doi: "10.1038/s41467-023-39810-w",
    url: "https://doi.org/10.1038/s41467-023-39810-w",
    finding:
      "Statistical early-warning indicators in sea-surface-temperature fingerprints suggest a possible AMOC tipping around mid-century under continued forcing. A contested estimate, but evidence that confidence in stability is lower than once assumed.",
  },
  {
    sourceId: "vanwesten-2024-amoc",
    title:
      "van Westen, Kliphuis & Dijkstra (2024) — Physics-based early warning signal shows that AMOC is on tipping course",
    doi: "10.1126/sciadv.adk1189",
    url: "https://doi.org/10.1126/sciadv.adk1189",
    finding:
      "A physics-based early-warning signal in a coupled climate model indicates the AMOC is on a tipping course; in the model, a collapse drives severe cooling over NW Europe even amid global warming. No calendar date is asserted for the real ocean.",
  },
];

export function amocAssessment(lat: number, lng: number): AmocAssessment {
  return {
    regionRelevant: isAmocRelevant(lat, lng),
    status: "context-only",
    weakeningAssessment:
      "IPCC AR6 assesses that the Atlantic Meridional Overturning Circulation (the current system that carries the Gulf Stream's heat north) is very likely to weaken during this century under every assessed emissions pathway.",
    collapseRisk:
      "An abrupt AMOC collapse before 2100 is not the central IPCC assessment and remains low-confidence, but recent peer-reviewed work (Ditlevsen & Ditlevsen 2023; van Westen et al. 2024) lowers confidence in its stability and treats it as a high-impact tail risk. No deterministic collapse date is applied.",
    europeImpact:
      "If the AMOC weakens substantially, NW Europe could warm more slowly than the global average — or cool in places — because less warm tropical water reaches the North Atlantic. This is the cooling-amid-warming paradox: the planet keeps warming while one region loses imported ocean heat. fupit applies no local temperature correction for this; it is shown as qualitative, cited context only.",
    citations: CITATIONS,
  };
}
