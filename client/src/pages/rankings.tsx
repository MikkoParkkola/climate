import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Database, ExternalLink, Info, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SCENARIOS, scenarioOptionLabel } from "@/lib/climate-constants";

// SCENARIOS imported from climate-constants — single source of truth for scenario wording.
const DEFAULT_SCENARIO = "ssp245";
const DEFAULT_SCENARIO_POLICY_VERSION = "current-policy-reference-2025";
const DEFAULT_SCENARIO_EXPLANATION =
  "Default reference: 2025 UNEP current-policy and Climate Action Tracker policies/action estimates put end-century warming roughly between 2.6 C and just below 3 C, so fupit maps the reference case to the closest fully grounded SSP pathway. It is a versioned reference, not a prediction or hidden scenario average.";

const YEARS = [2026, 2030, 2050, 2075, 2100];

const CATALOGS = [
  {
    id: "curated_cities",
    label: "Curated examples",
    description: "45 hand-picked places used for examples, smoke tests, and communication.",
  },
  {
    id: "natural_earth_populated_places_110m",
    label: "Population places",
    description: "Natural Earth 1:110m populated places with pop_max >= 3 million.",
  },
  {
    id: "natural_earth_country_population_place_weighted",
    label: "Country aggregates",
    description: "Country aggregates from included Natural Earth places, weighted by pop_max; not full national exposure.",
  },
] as const;

const METRICS = [
  { id: "habitability_score", label: "Habitability score", defaultDirection: "highest" },
  { id: "heat_stress_days", label: "Heat stress", defaultDirection: "highest" },
  { id: "drought_risk", label: "Drought pressure", defaultDirection: "highest" },
  { id: "flood_risk", label: "Heavy-rain flood pressure", defaultDirection: "highest" },
  { id: "warming_anomaly_c", label: "Warming anomaly", defaultDirection: "highest" },
  { id: "sea_level_rise_cm", label: "Regional sea-level rise", defaultDirection: "highest" },
] as const;

type Direction = "highest" | "lowest";

type Ranking = {
  methodVersion: string;
  sourceRegistryVersion: string;
  catalog: string;
  catalogSize: number;
  placeSampleSize?: number;
  scenario: string;
  year: number;
  metric: string;
  label: string;
  direction: Direction;
  unit: string;
  rows: Array<{
    rank: number;
    id: string;
    name: string;
    country: string;
    lat: number;
    lng: number;
    population?: number;
    populationField?: string;
    placeCount?: number;
    includedPlaces?: string[];
    inclusionReason?: string;
    value: number;
    unit: string;
    uncertainty?: { low?: number | null; high?: number | null };
    sourceReceipt: string[];
  }>;
  exclusions: string[];
  caveats: string[];
  sourceIds: string[];
};

function formatValue(value: number, unit: string) {
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
  if (unit === "degC") return `${rounded} C`;
  if (unit === "score") return `${rounded}/100`;
  return `${rounded} ${unit}`;
}

function uncertaintyLabel(row: Ranking["rows"][number]) {
  const low = row.uncertainty?.low;
  const high = row.uncertainty?.high;
  if (!Number.isFinite(low) || !Number.isFinite(high)) return "Range not available";
  return `${formatValue(Number(low), row.unit)} to ${formatValue(Number(high), row.unit)}`;
}

export default function RankingsPage() {
  const [catalog, setCatalog] = useState<(typeof CATALOGS)[number]["id"]>("curated_cities");
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [year, setYear] = useState(2050);
  const [metric, setMetric] = useState("habitability_score");
  const [direction, setDirection] = useState<Direction>("highest");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      catalog,
      scenario,
      year: String(year),
      metric,
      direction,
      limit: "10",
    });
    return `/api/climate/global-rankings?${params.toString()}`;
  }, [catalog, direction, metric, scenario, year]);

  const { data, isLoading, error } = useQuery<Ranking>({ queryKey: [query] });
  const selectedMetric = METRICS.find((item) => item.id === metric) ?? METRICS[0];
  const selectedCatalog = CATALOGS.find((item) => item.id === catalog) ?? CATALOGS[0];

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <nav className="flex flex-wrap gap-4 text-sm">
            <a href="/" className="text-blue-700 hover:underline">Back to the map</a>
            <a href="/methodology" className="text-blue-700 hover:underline">Methodology</a>
            <a href="/data-quality" className="text-blue-700 hover:underline">Data quality</a>
          </nav>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Bounded rankings</p>
            <h1 className="text-3xl font-bold">Top-10 climate signals in bounded place catalogs</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              These lists are teaching examples from documented bounded catalogs, including a
              curated example set, a Natural Earth population-place catalog, and a bounded
              country aggregate derived from those places. They are not climate-haven,
              safety, full national-exposure, or complete winner/loser lists.
            </p>
          </div>
        </header>

        <section className="grid gap-3 rounded border border-slate-200 bg-white p-4 md:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Catalog</span>
            <select
              value={catalog}
              onChange={(event) => setCatalog(event.target.value as (typeof CATALOGS)[number]["id"])}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              {CATALOGS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <span className="block text-xs leading-5 text-slate-500">{selectedCatalog.description}</span>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Metric</span>
            <select
              value={metric}
              onChange={(event) => {
                const nextMetric = event.target.value;
                setMetric(nextMetric);
                const nextSpec = METRICS.find((item) => item.id === nextMetric);
                setDirection((nextSpec?.defaultDirection ?? "highest") as Direction);
              }}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              {METRICS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Scenario</span>
            <select value={scenario} onChange={(event) => setScenario(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2">
              {SCENARIOS.map((item) => <option key={item.id} value={item.id}>{scenarioOptionLabel(item)}</option>)}
            </select>
            {scenario === DEFAULT_SCENARIO && (
              <span className="block text-xs leading-5 text-slate-500">
                {DEFAULT_SCENARIO_EXPLANATION} Version: {DEFAULT_SCENARIO_POLICY_VERSION}.
              </span>
            )}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Year</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="w-full rounded border border-slate-300 bg-white px-3 py-2">
              {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Direction</span>
            <select value={direction} onChange={(event) => setDirection(event.target.value as Direction)} className="w-full rounded border border-slate-300 bg-white px-3 py-2">
              <option value="highest">Highest values</option>
              <option value="lowest">Lowest values</option>
            </select>
          </label>
        </section>

        {isLoading && <Card><CardContent className="py-6 text-sm text-slate-600">Loading ranking artifact...</CardContent></Card>}
        {error && <Card><CardContent className="py-6 text-sm text-red-700">No precomputed ranking is available for that combination.</CardContent></Card>}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Catalog</div>
                <div className="mt-1 font-semibold">
                  {data.catalog.replace(/_/g, " ")} · {data.catalogSize} {data.catalog.includes("country") ? "countries" : "places"}
                </div>
                {Number.isFinite(data.placeSampleSize) && (
                  <div className="text-xs text-slate-500">from {Number(data.placeSampleSize).toLocaleString()} included populated places</div>
                )}
              </div>
              <div className="rounded border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Metric</div>
                <div className="mt-1 font-semibold">{data.label} · {data.direction}</div>
              </div>
              <div className="rounded border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Model</div>
                <div className="mt-1 truncate font-semibold" title={data.methodVersion}>{data.methodVersion}</div>
              </div>
            </section>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">
                      {data.direction === "highest" ? "Highest" : "Lowest"} {selectedMetric.label.toLowerCase()} · {data.year}
                    </h2>
                  </div>
                  <a
                    href={query}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                  >
                    Raw JSON <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </div>

                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2">Place</th>
                        <th className="px-3 py-2">Value</th>
                        <th className="px-3 py-2">Range</th>
                        <th className="px-3 py-2">Sources</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">#{row.rank}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">
                              {row.country === "country aggregate" ? row.name : `${row.name}, ${row.country}`}
                            </div>
                            <div className="text-xs text-slate-500">{row.lat.toFixed(2)}, {row.lng.toFixed(2)}</div>
                            {Number.isFinite(row.population) && (
                              <div className="text-xs text-slate-500">
                                Catalog {row.populationField ?? "population"} {Number(row.population).toLocaleString()}
                              </div>
                            )}
                            {Number.isFinite(row.placeCount) && (
                              <div className="text-xs text-slate-500">
                                {row.placeCount} included place{row.placeCount === 1 ? "" : "s"}
                                {row.includedPlaces?.length ? `: ${row.includedPlaces.slice(0, 5).join(", ")}${row.includedPlaces.length > 5 ? ", ..." : ""}` : ""}
                              </div>
                            )}
                            {row.inclusionReason && (
                              <div className="max-w-md text-xs text-slate-500">{row.inclusionReason}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{formatValue(row.value, row.unit)}</td>
                          <td className="px-3 py-2 text-slate-600">{uncertaintyLabel(row)}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{row.sourceReceipt.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden />
                    <h2 className="text-xl font-semibold">How to read this</h2>
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {data.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Receipt</h2>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div><dt className="font-medium text-slate-500">Source registry</dt><dd>{data.sourceRegistryVersion}</dd></div>
                    <div><dt className="font-medium text-slate-500">Source IDs</dt><dd className="break-words">{data.sourceIds.join(", ")}</dd></div>
                    <div><dt className="font-medium text-slate-500">Exclusions</dt><dd>{data.exclusions.length ? data.exclusions.join("; ") : "None in this bounded catalog slice."}</dd></div>
                  </dl>
                  <p className="flex gap-2 text-xs text-slate-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Natural Earth place rankings are bounded basemap catalogs, not GHSL urban centers
                    and not population-weighted exposure. The country aggregate catalog is population-place
                    weighted across included points only, not full national exposure.
                  </p>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
