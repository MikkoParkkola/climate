import { useQuery } from "@tanstack/react-query";
import { Activity, Database, FileCheck2, GitBranch, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type DataQuality = {
  methodVersion: string;
  sourceRegistryVersion: string;
  artifacts: Array<{ path: string; bytes: number; sha256: string }>;
  sourceRegistry: { rowCount: number; policy?: string; rows: Array<{ sourceId: string; provider: string; displayPolicy: string }> };
  grids: {
    primary: {
      layerCount: number;
      resolution: string;
      cells: number;
      methodVersion?: string;
      cacheVersion?: string;
      sourceRegistryVersion?: string;
      artifactHash?: string;
    };
    observedBaseline: { layerCount: number; resolution: string; period?: string; citation?: string };
  };
  defaultScenarioPolicy: {
    scenario: string;
    policyVersion: string;
    basis: string;
    supportedFullForecastScenarios: string[];
    gridHash?: string;
  };
  rankings: {
    catalog: string;
    catalogSize: number;
    entryCount: number;
    scenarios: string[];
    yearRange: [number, number];
    metrics: string[];
    caveats: string[];
  };
  trajectoryAudit: {
    artifactGeneratedAt: string;
    cityCount: number;
    scenarioCount: number;
    yearRange: [number, number];
    yearCount: number;
    resultCount: number;
    trendReviewCount: number;
    trendReview: Array<{ scenario: string; name: string; flags: string[] }>;
    note: string;
  };
  validationReport: {
    repoPath: string;
    status: string;
    artifactGeneratedAt: string;
    historicalObservationHindcast: string;
    trendReviewCount: number;
    trendReviewSummary: Array<{ kind: string; count: number }>;
    blockers: string[];
  };
  executableChecks: string[];
  limitations: string[];
};

function formatBytes(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function DataQualityPage() {
  const { data, isLoading, error } = useQuery<DataQuality>({ queryKey: ["/api/data-quality"] });

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <nav className="flex flex-wrap gap-4 text-sm">
            <a href="/" className="text-blue-700 hover:underline">Back to the map</a>
            <a href="/methodology" className="text-blue-700 hover:underline">Methodology</a>
            <a href="https://github.com/MikkoParkkola/climate" className="text-blue-700 hover:underline">Source</a>
          </nav>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Data quality</p>
            <h1 className="text-3xl font-bold">What this build can prove</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              This page reports the packaged model versions, source registry, artifact hashes,
              ranking catalog coverage, trajectory-audit coverage, and known limitations for
              the current fupit build.
            </p>
          </div>
        </header>

        {isLoading && <Card><CardContent className="py-6 text-sm text-slate-600">Loading data-quality report...</CardContent></Card>}
        {error && <Card><CardContent className="py-6 text-sm text-red-700">Data-quality report is unavailable.</CardContent></Card>}

        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Source rows" value={data.sourceRegistry.rowCount} />
              <Stat label="Primary layers" value={data.grids.primary.layerCount} />
              <Stat label="Ranking slices" value={data.rankings.entryCount} />
              <Stat label="Audit results" value={data.trajectoryAudit.resultCount} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Versions</h2>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div><dt className="font-medium text-slate-500">Model cache</dt><dd className="break-all">{data.methodVersion}</dd></div>
                    <div><dt className="font-medium text-slate-500">Source registry</dt><dd>{data.sourceRegistryVersion}</dd></div>
                    <div><dt className="font-medium text-slate-500">Default scenario policy</dt><dd>{data.defaultScenarioPolicy.policyVersion} · {data.defaultScenarioPolicy.scenario}</dd></div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Grid coverage</h2>
                  </div>
                  <p className="text-sm text-slate-600">
                    Primary projection grid: {data.grids.primary.resolution}, {data.grids.primary.cells.toLocaleString()} cells.
                    Observed baseline: {data.grids.observedBaseline.resolution}, {data.grids.observedBaseline.period}.
                  </p>
                  <p className="text-xs text-slate-500">{data.grids.observedBaseline.citation}</p>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden />
                  <h2 className="text-xl font-semibold">Default scenario policy</h2>
                </div>
                <p className="text-sm text-slate-600">{data.defaultScenarioPolicy.basis}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Default" value={data.defaultScenarioPolicy.scenario} />
                  <Stat label="Policy version" value={data.defaultScenarioPolicy.policyVersion} />
                  <Stat label="Forecast scenarios" value={data.defaultScenarioPolicy.supportedFullForecastScenarios.join(", ")} />
                </div>
                {data.defaultScenarioPolicy.gridHash && (
                  <p className="break-all text-xs text-slate-500">Primary grid hash: {data.defaultScenarioPolicy.gridHash}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-700" aria-hidden />
                  <h2 className="text-xl font-semibold">Trajectory audit</h2>
                </div>
                <p className="text-sm text-slate-600">
                  {data.trajectoryAudit.cityCount} fixture cities, {data.trajectoryAudit.scenarioCount} scenarios,
                  annual points from {data.trajectoryAudit.yearRange[0]} to {data.trajectoryAudit.yearRange[1]}.
                  The latest artifact reports {data.trajectoryAudit.trendReviewCount} trend-review items.
                </p>
                <div className="max-h-72 overflow-auto rounded border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600">
                      <tr><th className="px-3 py-2">Scenario</th><th className="px-3 py-2">Place</th><th className="px-3 py-2">Review flags</th></tr>
                    </thead>
                    <tbody>
                      {data.trajectoryAudit.trendReview.map((item) => (
                        <tr key={`${item.scenario}-${item.name}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium">{item.scenario}</td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-slate-600">{item.flags.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">{data.trajectoryAudit.note}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-blue-700" aria-hidden />
                  <h2 className="text-xl font-semibold">Validation report</h2>
                </div>
                <p className="text-sm text-slate-600">
                  The repository report at <code className="rounded bg-slate-100 px-1">{data.validationReport.repoPath}</code> summarizes
                  the same trajectory-audit artifact and keeps historical hindcast status explicit:
                  <span className="font-medium"> {data.validationReport.historicalObservationHindcast}</span>.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat label="Trend review items" value={data.validationReport.trendReviewCount} />
                  <Stat label="Hindcast status" value={data.validationReport.historicalObservationHindcast} />
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {data.validationReport.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2 text-xs">
                  {data.validationReport.trendReviewSummary.map((item) => (
                    <span key={item.kind} className="rounded border border-slate-200 bg-white px-2 py-1">
                      {item.kind}: {item.count}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Source registry</h2>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {data.sourceRegistry.rows.map((row) => (
                      <li key={row.sourceId} className="rounded border border-slate-200 p-2">
                        <span className="font-medium">{row.sourceId}</span>
                        <span className="block text-slate-600">{row.provider} · {row.displayPolicy}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Artifact hashes</h2>
                  </div>
                  <ul className="space-y-2 text-xs">
                    {data.artifacts.map((artifact) => (
                      <li key={artifact.path} className="rounded border border-slate-200 p-2">
                        <div className="font-medium">{artifact.path} · {formatBytes(artifact.bytes)}</div>
                        <div className="break-all text-slate-500">sha256 {artifact.sha256}</div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="text-xl font-semibold">Ranking coverage</h2>
                  <p className="text-sm text-slate-600">
                    Catalog `{data.rankings.catalog}` has {data.rankings.catalogSize} curated places,
                    {data.rankings.entryCount} precomputed slices, scenarios {data.rankings.scenarios.join(", ")},
                    and years {data.rankings.yearRange[0]}-{data.rankings.yearRange[1]}.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {data.rankings.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-blue-700" aria-hidden />
                    <h2 className="text-xl font-semibold">Executable checks</h2>
                  </div>
                  <ul className="space-y-2 text-sm">
                    {data.executableChecks.map((check) => (
                      <li key={check} className="rounded border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                        {check}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 pt-6">
                  <h2 className="text-xl font-semibold">Known limits</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {data.limitations.map((limit) => <li key={limit}>{limit}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
