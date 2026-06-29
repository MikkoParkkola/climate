import type { Express } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { DatabaseUnavailableError, isDatabaseConfigured } from "./db";
import { MODEL_CACHE_VERSION, SOURCE_REGISTRY_VERSION } from "./model-cache-version";
import { insertClimateLocationSchema } from "@shared/schema";
import { z } from "zod";
import { getRanking, rankingQuerySchema } from "./precomputed-rankings";
import { loadSourceRegistry } from "./source-registry";
import { loadDataQuality } from "./data-quality";
import { lookupFreshwater } from "./freshwater";
import { lookupFireWeather } from "./fire-weather";
import { climateTwinQuerySchema, findClimateTwin, loadClimateAnalogCatalog } from "./climate-twin";
import { climateTrajectory, projectClimate } from "./grounded-node-model";
import { parseOgParams, renderOgPng } from "./og-image";

// Forecasts run in-process via the Node grid engine (grounded-node-model.ts);
// the legacy Python serving subprocess has been removed.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MIN_FORECAST_YEAR = 2024;
const MAX_FORECAST_YEAR = 2100;
// SSP1-1.9 temperature/precipitation layers exist in the artifact, but the
// ETCCDI extremes source has no SSP1-1.9. Full habitability forecasts therefore
// reject it instead of serving missing heat/drought/flood penalties.
const CLIMATE_SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"] as const;
const DEFAULT_CLIMATE_SCENARIO = "ssp245";

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

function isDatabaseUnavailable(error: unknown): boolean {
  return error instanceof DatabaseUnavailableError ||
    (error instanceof Error && error.name === "DatabaseUnavailableError");
}

function databaseUnavailable(res: any) {
  return res.status(503).json({
    message: "Database is not configured; this endpoint requires DATABASE_URL.",
  });
}

// Resolve a free-text place name to coordinates via the Open-Meteo geocoding API
// (no API key, CORS-friendly, OSM/GeoNames-sourced). This gives the product its
// "any location on Earth" promise without us maintaining a city table. Geocoding
// is factual name->coordinate lookup, not modeled science — the forecast itself
// still comes only from the grounded grid.
// ponytail: Open-Meteo only; add a Nominatim fallback if it measurably fails.
type GeocodeHit = { name: string; latitude: number; longitude: number; country: string | null; region: string | null; lat: number; lng: number; population?: number };
async function geocodePlaces(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`geocoder ${resp.status}`);
  const data = (await resp.json()) as { results?: Array<Record<string, any>> };
  return (data.results ?? []).map((r) => {
    const region = r.admin1 ?? null;
    const country = r.country ?? null;
    const label = [r.name, region, country].filter(Boolean).join(", ");
    return {
      name: label,
      latitude: r.latitude,
      longitude: r.longitude,
      country,
      region,
      lat: r.latitude,
      lng: r.longitude,
      population: r.population,
    };
  });
}

// Resolve coordinates -> a human place name. Used by the browser "use my location"
// button: the browser obtains the user's coordinates with explicit consent and
// sends only those coordinates here; we resolve the name server-side so the
// user's IP never reaches a third-party geocoder. Coordinates always work for the
// forecast even if the name lookup fails, so this degrades gracefully.
// ponytail: BigDataCloud free no-key reverse endpoint; swap if it rate-limits.
function coordLabel(lat: number, lng: number): GeocodeHit {
  return { name: `${lat.toFixed(2)}, ${lng.toFixed(2)}`, latitude: lat, longitude: lng, country: null, region: null, lat, lng };
}
async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<GeocodeHit> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`reverse geocoder ${resp.status}`);
  const r = (await resp.json()) as Record<string, any>;
  const city = r.city || r.locality || r.principalSubdivision || null;
  const region = r.principalSubdivision ?? null;
  const country = r.countryName ?? null;
  const label = [city, region, country].filter(Boolean).join(", ");
  return label ? { name: label, latitude: lat, longitude: lng, country, region, lat, lng } : coordLabel(lat, lng);
}



// Runs the climate model for a single (lat, lng, year). Kept as a narrow wrapper
// for legacy call sites and single-year cache fills.
async function runClimateModel(
  lat: number,
  lng: number,
  year: number,
  scenario = DEFAULT_CLIMATE_SCENARIO,
): Promise<any> {
  return projectClimate(lat, lng, year, scenario);
}

// Runs the climate model for multiple checkpoint years. The in-process Node grid
// engine loads the compact grid once and projects every year in one call.
async function runClimateTrajectory(
  lat: number,
  lng: number,
  years: number[],
  scenario = DEFAULT_CLIMATE_SCENARIO,
): Promise<any> {
  return climateTrajectory(lat, lng, years, scenario);
}

// ── HTTP cache header helpers ────────────────────────────────────────────────
// Applied only to deterministic, non-user-specific GET endpoints whose output
// is stable until the next deploy (grid artifact + precomputed rankings are
// baked into the build; source-registry and data-quality are static files).
//
// Lifetime rationale:
//   max-age=300      — browser/private cache: 5 min. Keeps repeat visits fast
//                      while staying fresh enough that a hot-fix deploy is
//                      visible within minutes without a hard refresh.
//   s-maxage=86400   — shared CDN/edge cache: 24 h. The CMIP6 grid does not
//                      change between deploys; serving from edge saves origin
//                      compute at scale. A deploy triggers a new ETag which
//                      invalidates any CDN that respects conditional requests.
//   stale-while-revalidate=86400 — CDN may serve a stale hit for up to 24 h
//                      while it revalidates in the background; users see
//                      zero extra latency on the hot path.
//   Vary: Accept-Encoding — required when gzip/br compression may produce
//                      different response bytes so CDNs key the cache correctly.
//
// Error / rate-limit paths MUST set no-store so a transient failure is never
// pinned at the edge as a permanent bad response.
function setForecastCacheHeaders(res: any): void {
  res.set({
    "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400",
    "Vary": "Accept-Encoding",
  });
}

function setNoCacheHeaders(res: any): void {
  res.set("Cache-Control", "no-store");
}

function projectionScenario(projection: unknown): string | undefined {
  if (!projection || typeof projection !== "object") return undefined;
  const p = projection as { scenario?: unknown; metadata?: { scenario?: unknown } };
  const scenario = p.metadata?.scenario ?? p.scenario;
  return typeof scenario === "string" ? scenario : undefined;
}

function roundCacheKey(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── SEO: per-route HTML head injection (production only) ────────────────────
// Social crawlers and search engines do not run the React app, so each public
// route needs distinct head tags in the initial HTML response.
const SEO_BASE = "https://fupit.com";
const GITHUB_PROFILE_URL = "https://github.com/MikkoParkkola";
const GITHUB_REPO_URL = "https://github.com/MikkoParkkola/climate";

interface SeoPage {
  path: string;
  title: string;
  description: string;
  bodyHtml: string;
}

const SEO_PAGES: Record<string, SeoPage> = {
  home: {
    path: "/",
    title: "fupit — see where the climate is still livable",
    description:
      "Climate projections for any place on Earth, year by year to 2100. Compare locations to find where stays livable — then help f*** up the forecast.",
    bodyHtml: `<main aria-label="Page introduction">
  <h1>fupit — see where the climate is still livable</h1>
  <p>Climate projections for any place on Earth, year by year to 2100. Compare locations to find where stays livable — then help f*** up the forecast.</p>
  <h2>Features</h2>
  <ul>
    <li>Search any location worldwide by city name or coordinates</li>
    <li>View projected average temperature and temperature change</li>
    <li>Explore annual precipitation forecasts and model-spread ranges</li>
    <li>Assess heat stress, drought, and flooding risk scores</li>
    <li>Compare habitability rankings across global cities</li>
  </ul>
  <h2>How it works</h2>
  <p>fupit serves projections from a grounded CMIP6/IPCC grid, with NASA/IPCC sea-level data and ETCCDI extreme-climate indices. The method is public so every served number can be traced to a source.</p>
  <p><a href="/comparison">Compare multiple locations side by side</a>, read <a href="/methodology">the full methodology</a>, or inspect <a href="${GITHUB_REPO_URL}">the source on GitHub</a>.</p>
</main>`,
  },
  comparison: {
    path: "/comparison",
    title: "fupit — compare climate by location",
    description:
      "Compare side-by-side climate projections for up to 10 locations. Slide from the current year to 2100, with a 2025 baseline reference, to watch temperature, precipitation, risk, and habitability diverge in real time.",
    bodyHtml: `<main aria-label="Page introduction">
  <h1>fupit — compare climate by location</h1>
  <p>Compare side-by-side climate projections for up to 10 locations. Slide from the current year to 2100, with a 2025 baseline reference, to watch temperature, precipitation, risk, and habitability diverge in real time.</p>
  <h2>What you can compare</h2>
  <ul>
    <li>Average temperature and temperature change across locations</li>
    <li>Annual precipitation and precipitation trends</li>
    <li>Model-spread ranges and risk changes over time</li>
    <li>Sea-level projections for coastal locations</li>
    <li>Heat stress, drought, and flooding risk scores</li>
    <li>Overall habitability scores from 0 to 100</li>
  </ul>
  <p><a href="/">Go back to fupit</a> to explore individual locations in detail.</p>
</main>`,
  },
  methodology: {
    path: "/methodology",
    title: "fupit methodology — grounded climate projections",
    description:
      "How fupit projects future climate and habitability using CMIP6/IPCC data, NASA/IPCC sea-level projections, ETCCDI extremes, and transparent risk thresholds.",
    bodyHtml: `<main aria-label="Methodology">
  <h1>How fupit gets its numbers</h1>
  <p>Every value on fupit traces to real climate science. We do not invent coefficients or warming rates. Where we cannot ground a number, we leave it blank rather than guess.</p>
  <h2>Forecast sources</h2>
  <ul>
    <li>Temperature and precipitation change: raw CMIP6 model output behind the IPCC Sixth Assessment Report, aggregated by scenario and decade.</li>
    <li>Present-day baseline: WorldClim v2.1 observed monthly climatology (1970-2000, 10 arc-minutes) where available, with CMIP6 historical climatology as fallback.</li>
    <li>Sea-level rise: IPCC AR6 regional projections.</li>
    <li>Heat, drought, and flood risk: CMIP6 ETCCDI extreme-climate indices scored against documented thresholds.</li>
    <li>Humid heat screen: CMIP6 relative humidity and monthly mean temperature through the Stull 2011 wet-bulb approximation; not WBGT or daily humid-heat days.</li>
    <li>Cold-season context: monthly mean temperature months at or below 0°C; not daily freeze days, freeze-thaw, heating demand, crop damage, pests, or health risk.</li>
    <li>Climate twin: nearest present-day city in the indexed catalog by standardized monthly temperature and precipitation distance from grounded model output.</li>
  </ul>
  <h2>Honesty rules</h2>
  <ul>
    <li>Temperature is shown with raw CMIP6 model consensus as the headline; the IPCC-calibrated value, adjustment, and calibration factor are shown for comparison.</li>
    <li>SSP2-4.5 is the default middle-path reference; SSP5-8.5 is available as a very-high-emissions stress test, not as a business-as-usual claim.</li>
    <li>Precipitation is shown as model consensus plus spread because there is no equivalent single assessed calibration anchor.</li>
    <li>Risk scores expose the raw physical quantity next to the 0 to 100 score.</li>
  </ul>
  <p>Sources: WorldClim v2.1 (Fick & Hijmans 2017); IPCC AR6 Working Group I; CMIP6; ETCCDI indices; Stull 2011 wet-bulb approximation; IPCC AR6 sea-level projections.</p>
  <p><a href="/">Return to fupit</a> or inspect <a href="${GITHUB_REPO_URL}">the source on GitHub</a>.</p>
</main>`,
  },
  dataQuality: {
    path: "/data-quality",
    title: "fupit data quality — source and validation evidence",
    description:
      "Current fupit build evidence: artifact hashes, source registry, ranking catalog coverage, trajectory-audit coverage, trend-review flags, and known limitations.",
    bodyHtml: `<main aria-label="Data quality">
  <h1>fupit data quality</h1>
  <p>This page reports the evidence behind the current packaged build: model/cache version, source-registry version, artifact hashes, ranking catalog coverage, annual trajectory-audit coverage, and known limitations.</p>
  <h2>What it proves</h2>
  <ul>
    <li>Which immutable climate artifacts are packaged with the app.</li>
    <li>Which source registry rows approve visible metrics and rankings.</li>
    <li>How much of the bounded ranking catalogs and trajectory audit matrix is covered.</li>
    <li>Which living-condition enrichment domains are partial, context-only, or withheld until grounded data exists.</li>
    <li>Which trend-review flags still require human scientific review.</li>
  </ul>
  <h2>Enrichment readiness ledger</h2>
  <p>The data-quality report marks humid heat, sea-level relevance, cold-season context, freshwater water-stress (WRI Aqueduct 4.0), and fire weather (Quilcaille et al. 2023, CMIP6 Fire Weather Index) as partial, AMOC as context-only, and daily cold stress, agriculture, infrastructure, and biodiversity as withheld until a registered source and method exist.</p>
  <p>Use this page with <a href="/methodology">the methodology</a> and <a href="${GITHUB_REPO_URL}">the source repository</a>. It does not prove that the public Replit deployment has already been republished or that production cache purge has been completed.</p>
</main>`,
  },
  rankings: {
    path: "/rankings",
    title: "fupit rankings — bounded climate signal lists",
    description:
      "Top-10 climate signal rankings from bounded curated-city, Natural Earth population-place, and Natural Earth-derived country aggregate artifacts, with catalog size, caveats, source receipts, and no safe-city claims.",
    bodyHtml: `<main aria-label="Rankings">
  <h1>fupit bounded climate rankings</h1>
  <p>Compare precomputed climate signals across the documented curated-city catalog, a Natural Earth population-place catalog, and a bounded country aggregate weighted across included populated places. Rankings are educational examples, not complete global, full national exposure, population-weighted, or climate-haven lists.</p>
  <h2>Available dimensions</h2>
  <ul>
    <li>Habitability score, heat stress, drought pressure, heavy-rain flood pressure, warming anomaly, and regional sea-level rise.</li>
    <li>Scenario and year controls using the same grounded CMIP6/IPCC artifact as the forecast API.</li>
    <li>Catalog size, caveats, exclusions, method version, and source IDs for every list.</li>
  </ul>
  <p><a href="/data-quality">Inspect data-quality evidence</a>, read <a href="/methodology">the methodology</a>, or return to <a href="/">the map</a>.</p>
</main>`,
  },
};

function pageUrl(pagePath: string): string {
  return `${SEO_BASE}${pagePath === "/" ? "/" : pagePath}`;
}

// Build the absolute social-preview image URL for a page. For the forecast home
// route (which carries place, lat, lng, year, scenario on shared links) we point
// at the dynamic og endpoint on THIS host, forwarding only the params present.
// Other pages keep the static branded card.
// Honesty: we deliberately do NOT forward `score` — the og endpoint recomputes it
// from the grounded model cache so a hand-edited URL can never fake a number.
function buildOgImageUrl(page: SeoPage, req: any): string {
  const staticDefault = `${SEO_BASE}/og-image.png`;
  if (!req || page.path !== "/") return staticDefault;
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  if (!host) return staticDefault;
  const proto = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const base = `${proto}://${host}`;
  const query = (req.query ?? {}) as Record<string, string | undefined>;
  const sp = new URLSearchParams();
  for (const key of ["place", "lat", "lng", "year", "scenario", "country"]) {
    const value = query[key];
    if (typeof value === "string" && value.trim() !== "") sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${base}/api/og?${qs}` : `${base}/api/og`;
}

function pageSchema(page: SeoPage) {
  const url = pageUrl(page.path);
  if (page.path === "/") {
    return {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "fupit",
      url,
      description: page.description,
      applicationCategory: "EducationalApplication",
      operatingSystem: "All",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SEO_BASE}/#org` },
      creator: {
        "@type": "Person",
        name: "Mikko Parkkola",
        url: GITHUB_PROFILE_URL,
      },
      sameAs: [GITHUB_REPO_URL, GITHUB_PROFILE_URL],
      codeRepository: GITHUB_REPO_URL,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url,
    description: page.description,
    isPartOf: {
      "@type": "WebSite",
      name: "fupit",
      url: `${SEO_BASE}/`,
    },
    author: {
      "@type": "Person",
      name: "Mikko Parkkola",
      url: GITHUB_PROFILE_URL,
    },
    sameAs: [GITHUB_REPO_URL],
  };
}

function injectSeoHtml(template: string, page: SeoPage, req?: any): string {
  const url = pageUrl(page.path);
  const ogImage = buildOgImageUrl(page, req);
  // Escape & for safe embedding in HTML attribute values (the og URL may carry
  // multiple query params). URLSearchParams already percent-encodes the rest.
  const ogImageAttr = ogImage.replace(/&/g, "&amp;");
  const jsonLd = JSON.stringify(pageSchema(page));
  let html = template
    .split("https://global-geo-selector-mikkoparkkola.replit.app")
    .join(SEO_BASE)
    .split("https://climate-projections.replit.app")
    .join(SEO_BASE)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${page.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${ogImageAttr}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${page.title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${page.description}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${ogImageAttr}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`)
    .replace(
      /<script type="application\/ld\+json" id="page-schema">[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="page-schema">${jsonLd}</script>`,
    )
    .replace(/<div id="root"><\/div>/, `<div id="root">${page.bodyHtml}</div>`);

  // Ensure summary_large_image + explicit image dimensions for rich social
  // unfurls. twitter:card is already summary_large_image in the source HTML;
  // og:image:width/height are not, so inject them next to og:image when absent.
  if (!/property="og:image:width"/.test(html)) {
    html = html.replace(
      /(<meta property="og:image" content="[^"]*"\s*\/?>)/,
      `$1\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`,
    );
  }
  if (!/name="twitter:card"/.test(html)) {
    html = html.replace(
      /(<meta name="twitter:image" content="[^"]*"\s*\/?>)/,
      `<meta name="twitter:card" content="summary_large_image" />\n    $1`,
    );
  }
  return html;
}

function makeSeoHandler(page: SeoPage) {
  return (req: any, res: any, next: any) => {
    try {
      const file = path.resolve(import.meta.dirname, "public", "index.html");
      const html = injectSeoHtml(fs.readFileSync(file, "utf-8"), page, req);
      res
        .status(200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        })
        .send(html);
    } catch {
      next();
    }
  };
}

function readBuildInfo() {
  try {
    const file = path.resolve(import.meta.dirname, "build-info.json");
    return JSON.parse(fs.readFileSync(file, "utf-8")) as {
      commit?: string | null;
      shortCommit?: string | null;
      branch?: string | null;
      builtAt?: string | null;
    };
  } catch {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    const buildInfo = readBuildInfo();
    const databaseConfigured = isDatabaseConfigured();
    const deploymentCommit =
      process.env.REPLIT_GIT_SHA ||
      process.env.GIT_COMMIT_SHA ||
      process.env.COMMIT_SHA ||
      buildInfo?.commit ||
      null;

    res.json({
      ok: true,
      app: "fupit",
      service: "climate-api",
      engine: "grounded-node-model.ts",
      gridEngine: "node",
      modelCacheVersion: MODEL_CACHE_VERSION,
      sourceRegistryVersion: SOURCE_REGISTRY_VERSION,
      databaseConfigured,
      cachePurge: databaseConfigured ? "startup-incompatible-delete-enabled" : "skipped-no-database",
      legacyProjectionEndpoints: "410-gone",
      retiredEndpoints: [
        "/api/projections",
        "/api/export/csv/:locationId/:year",
        "/api/user/keys",
        "/api/user/comparisons",
        "/api/climate/multi-comparison",
        "/api/climate/export-comparison",
      ],
      supportedScenarios: [...CLIMATE_SCENARIOS],
      seoBase: SEO_BASE,
      routes: ["/", "/comparison", "/rankings", "/methodology", "/data-quality"],
      apiRoutes: [
        "/api/health",
        "/api/source-registry",
        "/api/data-quality",
        "/api/climate-trajectory",
        "/api/climate-twin",
        "/api/climate/global-rankings",
      ],
      deployment: {
        commit: deploymentCommit,
        build: buildInfo,
        id: process.env.REPLIT_DEPLOYMENT_ID || null,
      },
    });
  });

  // ── Dynamic social-preview (Open Graph) image ────────────────────────────────
  // Grounded score for the OG card — cache-only, never trusts the URL. Interpolates
  // between the two cached checkpoint years bracketing the requested year, matching
  // what the visitor saw in-app. Returns null on any miss/failure, so a tampered
  // ?score=, an uncached location, or a DB outage all render a card with NO number
  // (cardinal rule: never show a number we cannot ground). No model spawn here — this
  // is a public, crawler-hit endpoint and must not become a model-spawn DoS vector;
  // any location a real user viewed + shared is already cached by the trajectory route.
  const OG_CHECKPOINT_YEARS = (() => {
    const BASELINE = 2025;
    const current = Math.min(2100, Math.max(BASELINE + 1, new Date().getUTCFullYear()));
    const five = Array.from({ length: 15 }, (_, i) => 2030 + i * 5).filter((y) => y >= current);
    return Array.from(new Set([BASELINE, current, ...five])).sort((a, b) => a - b);
  })();

  async function groundedOgScore(lat: number, lng: number, year: number, scenario: string): Promise<number | null> {
    try {
      const latKey = roundCacheKey(lat);
      const lngKey = roundCacheKey(lng);
      const scoreAt = async (y: number): Promise<number | null> => {
        const proj = (await storage.getCachedModelProjection(latKey, lngKey, y, scenario)) as any;
        if (!proj || projectionScenario(proj) !== scenario) return null;
        const s = proj?.habitability?.score;
        return typeof s === "number" && Number.isFinite(s) ? s : null;
      };
      const ys = OG_CHECKPOINT_YEARS;
      const clamped = Math.max(ys[0], Math.min(ys[ys.length - 1], year));
      const bound = (v: number) => Math.round(Math.max(0, Math.min(100, v)));
      // Exact checkpoint (the common case — share years are usually checkpoints): use it directly.
      if (ys.includes(clamped)) { const s = await scoreAt(clamped); return s == null ? null : bound(s); }
      // Otherwise interpolate between the two cached checkpoints bracketing the year.
      let lo = ys[0], hi = ys[ys.length - 1];
      for (let i = 0; i < ys.length - 1; i++) {
        if (clamped >= ys[i] && clamped <= ys[i + 1]) { lo = ys[i]; hi = ys[i + 1]; break; }
      }
      const [sLo, sHi] = await Promise.all([scoreAt(lo), scoreAt(hi)]);
      if (sLo == null || sHi == null) return null;
      const t = (clamped - lo) / (hi - lo || 1);
      return bound(sLo + (sHi - sLo) * t);
    } catch {
      return null; // DB down / unexpected -> honest: no number on the card
    }
  }

  // GET /api/og?place=&lat=&lng=&year=&scenario= -> 1200x630 PNG.
  // Rendered with satori + @resvg/resvg-wasm (pure JS + WASM, no native deps).
  // Honesty: the score is recomputed server-side from the grounded model cache
  // (groundedOgScore), NEVER read from the URL. Uncached/invalid -> no number.
  app.get("/api/og", async (req, res) => {
    try {
      const params = parseOgParams(req.query as Record<string, string | undefined>);
      // Cardinal rule: never trust a client-supplied score — recompute from cache.
      let grounded: number | null = null;
      if (
        typeof params.lat === "number" && typeof params.lng === "number" &&
        typeof params.year === "number" && typeof params.scenario === "string" &&
        (CLIMATE_SCENARIOS as readonly string[]).includes(params.scenario)
      ) {
        grounded = await groundedOgScore(params.lat, params.lng, params.year, params.scenario);
      }
      const png = await renderOgPng({ ...params, score: grounded ?? undefined });
      res
        .status(200)
        .set({
          "Content-Type": "image/png",
          // Same cache convention as the grounded forecast endpoints.
          "Cache-Control": "public, max-age=300",
        })
        .end(png);
    } catch (err) {
      console.error("og image failed:", (err as Error).message);
      res.status(500).json({ message: "OG image unavailable." });
    }
  });

  // ── Per-route SEO head injection ─────────────────────────────────────────────
  // Social crawlers and search engines do not execute JavaScript, so each public
  // route must receive distinct <title>, <meta description>, <link canonical>,
  // Open Graph, Twitter Card, and JSON-LD tags in the FIRST HTTP response byte.
  //
  // In production, app.get() handlers below are registered BEFORE serveStatic()
  // (see server/index.ts), so they intercept public SPA routes before
  // express.static can serve the shared index.html.  Each handler reads the
  // built dist/public/index.html and rewrites every head tag for that route.
  //
  // In development, the PAGE_SEMANTIC middleware further down serves a
  // self-contained HTML document (with the Vite dev entry point) for each route,
  // providing the same per-route tags to crawlers without interfering with HMR.
  if (app.get("env") !== "development") {
    for (const page of Object.values(SEO_PAGES)) {
      app.get(page.path, makeSeoHandler(page));
    }
  }

  // Climate location routes
  app.get("/api/locations/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json([]);
    }
    // Primary: live geocoder (any place on Earth, no DB needed).
    try {
      const hits = await geocodePlaces(query);
      return res.json(hits);
    } catch (geoError) {
      console.warn("Geocoder unavailable, falling back to stored locations:", (geoError as Error).message);
    }
    // Fallback: previously-stored locations (works offline / if geocoder is down).
    try {
      const locations = await storage.searchClimateLocations(query);
      res.json(locations.map((l) => ({ ...l, lat: Number(l.latitude), lng: Number(l.longitude) })));
    } catch (error) {
      if (isDatabaseUnavailable(error)) return res.json([]);
      console.error("Error searching locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  app.get("/api/locations/reverse", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: "valid lat and lng required" });
    }
    try {
      return res.json(await reverseGeocode(lat, lng));
    } catch (e) {
      console.warn("Reverse geocoder unavailable:", (e as Error).message);
      return res.json(coordLabel(lat, lng)); // coordinates still drive the forecast
    }
  });

  app.post("/api/locations", async (req, res) => {
    try {
      const locationData = insertClimateLocationSchema.parse(req.body);
      
      // Check if location already exists
      const existing = await storage.getClimateLocationByCoordinates(
        locationData.latitude, 
        locationData.longitude
      );
      
      if (existing) {
        return res.json(existing);
      }
      
      const location = await storage.createClimateLocation(locationData);
      res.json(location);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return databaseUnavailable(res);
      console.error("Error creating location:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  const legacyProjectionGone = (res: any) => res.status(410).json({
    message: "Legacy location-id projection endpoints are retired. Use /api/climate-trajectory for grounded CMIP6/IPCC projections.",
  });
  const retiredFeatureGone = (res: any) => res.status(410).json({
    message: "This legacy endpoint is retired. Use /api/climate-trajectory, /api/climate-twin, /api/climate/global-rankings, or /api/source-registry for grounded public data.",
  });

  // Climate projection routes
  app.get("/api/projections", (_req, res) => legacyProjectionGone(res));
  app.get("/api/projections/:locationId/:year", (_req, res) => legacyProjectionGone(res));
  app.get("/api/projections/:locationId", (_req, res) => legacyProjectionGone(res));

  app.get("/api/export/csv/:locationId/:year", (_req, res) => retiredFeatureGone(res));
  app.get("/api/user/keys", (_req, res) => retiredFeatureGone(res));
  app.put("/api/user/keys", (_req, res) => retiredFeatureGone(res));

  // Multi-location comparison endpoint
  app.get("/api/climate/multi-comparison", async (req, res) => {
    try {
      const locationIds = req.query.locationIds as string;
      const year = parseInt(req.query.year as string);
      
      if (!locationIds || isNaN(year)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      const ids = locationIds.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

      if (ids.length === 0) {
        return res.status(400).json({ message: "Invalid location IDs" });
      }

      return legacyProjectionGone(res);
    } catch (error) {
      console.error("Error fetching multi-comparison data:", error);
      res.status(500).json({ message: "Failed to fetch comparison data" });
    }
  });

  app.post("/api/user/comparisons", (_req, res) => retiredFeatureGone(res));
  app.get("/api/user/comparisons", (_req, res) => retiredFeatureGone(res));
  app.post("/api/climate/export-comparison", (_req, res) => retiredFeatureGone(res));

  // POST /api/climate-projection — compatibility single-year projection route.
  // Keeps the old response envelope, routed through the in-process Node grid engine.
  app.post("/api/climate-projection", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    const bodySchema = z.object({
      location: z.string().min(1).max(200),
      coordinates: z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      }),
      year: z.coerce.number().int().min(MIN_FORECAST_YEAR).max(MAX_FORECAST_YEAR),
      scenario: z.enum(CLIMATE_SCENARIOS).default(DEFAULT_CLIMATE_SCENARIO),
      apiKey: z.string().max(500).optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("climate-projection 400 — field errors:", JSON.stringify(parsed.error.issues));
      return res.status(400).json({ message: "Invalid request parameters" });
    }

    const { coordinates, year, apiKey: clientApiKey } = parsed.data;
    const scenario = parsed.data.scenario;
    // The grounded grid engine is offline and needs no API key.
    // clientApiKey is accepted but ignored for compatibility.
    void clientApiKey;

    try {
      const result = await runClimateModel(coordinates.lat, coordinates.lng, year, scenario);
      return res.json({ success: true, data: result });
    } catch (err) {
      if (isDatabaseUnavailable(err)) return databaseUnavailable(res);
      const msg = (err as Error).message;
      if (msg === "timeout") {
        return res.status(504).json({ message: "Climate model timed out. Please try again." });
      }
      console.error("climate-projection model error:", msg);
      return res.status(500).json({ message: "Climate model failed. Please try again." });
    }

  });

  // POST /api/climate-trajectory — runs the model at multiple checkpoint years
  // for a single location (sequentially) so the client can interpolate between
  // real data points as the year slider moves. One request per location keeps
  // client calls within the per-IP rate limit.
  app.post("/api/climate-trajectory", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    const bodySchema = z.object({
      coordinates: z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      }),
      // Baseline year + current forecast year + 5-year cadence to 2100 is
      // currently 17 points; leave headroom for targeted audits without
      // reopening the full-browser-e2e timeout trap.
      years: z.array(z.coerce.number().int().min(MIN_FORECAST_YEAR).max(MAX_FORECAST_YEAR)).min(1).max(20),
      scenario: z.enum(CLIMATE_SCENARIOS).default(DEFAULT_CLIMATE_SCENARIO),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("climate-trajectory 400 — field errors:", JSON.stringify(parsed.error.issues));
      return res.status(400).json({ message: "Invalid request parameters" });
    }

    const { coordinates, scenario } = parsed.data;
    // De-duplicate and sort the checkpoint years ascending.
    const years = Array.from(new Set(parsed.data.years)).sort((a, b) => a - b);

    // Round to a ~0.01° (~1 km) grid so the same location — or a near-identical
    // one — reuses a previously cached grounded-model run.
    // Storage also checks the JSON payload's grounded-grid cache version; old
    // unversioned cbottle-era rows read as misses and are overwritten.
    const latKey = roundCacheKey(coordinates.lat);
    const lngKey = roundCacheKey(coordinates.lng);

    try {
      const pointsByYear = new Map<number, any>();
      const missingYears: number[] = [];
      let cachedCount = 0;
      for (const year of years) {
        const cached = await storage.getCachedModelProjection(latKey, lngKey, year, scenario);
        if (cached && projectionScenario(cached) === scenario) {
          cachedCount++;
          pointsByYear.set(year, { year, cached: true, ...(cached as object) });
          continue;
        }
        missingYears.push(year);
      }

      if (missingYears.length > 0) {
        // The grounded grid engine is offline — no API key needed for any location.
        const trajectory = await runClimateTrajectory(coordinates.lat, coordinates.lng, missingYears, scenario);
        const projectedPoints = Array.isArray(trajectory?.points) ? trajectory.points : [];
        for (const projection of projectedPoints) {
          const year = Number(projection?.year);
          if (!missingYears.includes(year)) continue;
          await storage.saveModelProjection(latKey, lngKey, year, scenario, projection);
          pointsByYear.set(year, { year, cached: false, ...projection });
        }
        for (const year of missingYears) {
          if (!pointsByYear.has(year)) {
            throw new Error("parse_error");
          }
        }
      }

      const points = years.map((year) => pointsByYear.get(year));
      // Grounded Freshwater enrichment: Aqueduct 4.0 water-stress for the containing
      // sub-basin under the requested scenario. null for ssp245 (no Aqueduct match) or
      // open ocean / unclassified points — never fabricated.
      let freshwater = null;
      try {
        freshwater = lookupFreshwater(coordinates.lat, coordinates.lng, scenario);
      } catch (fwErr) {
        console.warn("freshwater lookup failed:", (fwErr as Error).message);
      }
      // Grounded fire-weather enrichment: Quilcaille 2023 CMIP6 FWI ensemble-mean indicators
      // for the containing 2.5-degree land cell under the requested scenario. null for
      // unsupported scenarios (ssp119) or open ocean — never fabricated.
      let fireWeather = null;
      try {
        fireWeather = lookupFireWeather(coordinates.lat, coordinates.lng, scenario);
      } catch (fireErr) {
        console.warn("fire-weather lookup failed:", (fireErr as Error).message);
      }
      res.json({ success: true, data: { coordinates, points, cachedCount, freshwater, fireWeather } });
    } catch (err) {
      if (isDatabaseUnavailable(err)) return databaseUnavailable(res);
      const msg = (err as Error).message;
      if (msg === "timeout") {
        return res.status(504).json({ message: "Climate model timed out. Please try again." });
      }
      console.error("climate-trajectory failed:", msg);
      res.status(500).json({ message: "Climate model failed. Please try again." });
    }
  });

  // GET /api/climate-twin - bounded current-day analog lookup. The target
  // projection is grounded grid output; the candidate set is the registered
  // current analog catalog, not an unbounded global search.
  app.get("/api/climate-twin", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      setNoCacheHeaders(res);
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    const parsed = climateTwinQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      setNoCacheHeaders(res);
      return res.status(400).json({ message: "Invalid request parameters", errors: parsed.error.issues });
    }

    const { lat, lng, year, scenario, catalog, limit } = parsed.data;
    if (catalog !== "current") {
      setNoCacheHeaders(res);
      return res.status(404).json({
        message: "No climate twin catalog for those parameters.",
        availableCatalogs: ["current"],
      });
    }

    const latKey = roundCacheKey(lat);
    const lngKey = roundCacheKey(lng);

    try {
      let projection = await storage.getCachedModelProjection(latKey, lngKey, year, scenario);
      let cachedProjection = Boolean(projection && projectionScenario(projection) === scenario);

      if (!cachedProjection) {
        projection = await runClimateModel(lat, lng, year, scenario);
        await storage.saveModelProjection(latKey, lngKey, year, scenario, projection);
        cachedProjection = false;
      }

      const twin = findClimateTwin({
        catalog: loadClimateAnalogCatalog(),
        projection: projection as Parameters<typeof findClimateTwin>[0]["projection"],
        lat,
        lng,
        year,
        scenario,
        limit,
      });

      if (!twin) {
        setNoCacheHeaders(res);
        return res.status(422).json({ message: "Climate twin could not be computed from the current catalog." });
      }

      setForecastCacheHeaders(res);
      res.json({ success: true, data: { ...twin, cachedProjection } });
    } catch (err) {
      setNoCacheHeaders(res);
      if (isDatabaseUnavailable(err)) return databaseUnavailable(res);
      const msg = (err as Error).message;
      if (msg === "timeout") {
        return res.status(504).json({ message: "Climate model timed out. Please try again." });
      }
      console.error("climate-twin failed:", msg);
      res.status(500).json({ message: "Climate twin failed. Please try again." });
    }
  });

  app.get("/api/source-registry", (_req, res) => {
    try {
      setForecastCacheHeaders(res);
      res.json(loadSourceRegistry());
    } catch (err) {
      setNoCacheHeaders(res);
      console.error("source-registry failed:", (err as Error).message);
      res.status(500).json({ message: "Source registry unavailable." });
    }
  });

  app.get("/api/data-quality", (_req, res) => {
    try {
      setForecastCacheHeaders(res);
      res.json(loadDataQuality());
    } catch (err) {
      setNoCacheHeaders(res);
      console.error("data-quality failed:", (err as Error).message);
      res.status(500).json({ message: "Data-quality report unavailable." });
    }
  });

  // Global habitability rankings endpoint
  app.get("/api/climate/global-rankings", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      setNoCacheHeaders(res);
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    const parsed = rankingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      setNoCacheHeaders(res);
      return res.status(400).json({ message: "Invalid request parameters", errors: parsed.error.issues });
    }
    const ranking = getRanking(parsed.data);
    if (!ranking) {
      setNoCacheHeaders(res);
      return res.status(404).json({ message: "No precomputed ranking for those parameters." });
    }
    setForecastCacheHeaders(res);
    res.json(ranking);
  });

  // Semantic content for each known public route.
  // This is injected into the HTML served to all clients so that crawlers and
  // social preview bots see real page content on the first byte, before any
  // JavaScript executes, regardless of whether the client renders JS.
  const PAGE_SEMANTIC = Object.fromEntries(
    Object.values(SEO_PAGES).map((page) => [page.path, page]),
  ) as Record<string, SeoPage>;

  // In development there is no built index.html; serve a self-contained page
  // that includes Vite's dev entry point so the interactive React app still
  // loads and hydrates after the initial server-rendered content.
  function buildDevHtml(page: SeoPage): string {
    const url = pageUrl(page.path);
    const jsonLd = JSON.stringify(pageSchema(page));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<link rel="canonical" href="${url}">
<script type="application/ld+json">${jsonLd}</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Vite dev client + @vitejs/plugin-react refresh preamble. Because this HTML
     is built by hand (not passed through Vite's transformIndexHtml), the React
     plugin's preamble must be injected manually or React fails to mount with
     "@vitejs/plugin-react can't detect preamble". -->
<script type="module" src="/@vite/client"></script>
<script type="module">
import RefreshRuntime from "/@react-refresh"
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>
</head>
<body>
<div id="root">${page.bodyHtml}</div>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }

  // Pre-render middleware: intercepts GET requests for known public routes and
  // serves HTML with real page content embedded in <div id="root"> on the first
  // response. In production the built index.html (with hashed bundle scripts) is
  // read from disk and the semantic body is injected before the app mounts; in
  // development a self-contained page with the Vite dev entry is used instead.
  // This ensures ALL clients — browsers, crawlers, and AI agents — receive
  // crawlable content on the first byte without requiring JavaScript execution.
  const distIndexPath = path.resolve(import.meta.dirname, "public", "index.html");

  app.use(async (req, res, next) => {
    if (req.method !== "GET") return next();
    const page = PAGE_SEMANTIC[req.path];
    if (!page) return next();

    try {
      if (fs.existsSync(distIndexPath)) {
        // Production: inject semantic content into the built index.html so the
        // correct hashed bundle scripts are preserved.
        const template = await fs.promises.readFile(distIndexPath, "utf-8");
        const html = injectSeoHtml(template, page, req);
        return res.status(200).set("Content-Type", "text/html; charset=utf-8").end(html);
      }
      // Development: serve self-contained HTML with Vite dev entry point.
      return res.status(200).set("Content-Type", "text/html; charset=utf-8").end(buildDevHtml(page));
    } catch (err) {
      next(err);
    }
  });

  // 404 guard — registered in routes.ts so it runs BEFORE vite.middlewares and
  // express.static, ensuring unknown paths return a genuine 404 rather than the
  // SPA shell (soft 404). Known SPA routes and Vite-internal prefixes pass
  // through; in development all file-extension requests also pass through so
  // Vite can serve its own assets; in production file-extension paths pass
  // through to express.static, and any that are not found on disk then fall
  // through to the narrowed /{*any} fallback in server/vite.ts which also
  // returns 404 for non-SPA paths.
  const KNOWN_SPA_ROUTES_404 = new Set(["/", "/comparison", "/rankings", "/methodology", "/data-quality"]);
  const VITE_INTERNAL_PREFIXES = ["/api/", "/@", "/src/", "/node_modules/", "/__mockup", "/__vite"];
  const isDev = process.env.NODE_ENV !== "production";
  const NOT_FOUND_HTML_404 = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>404 Not Found</title></head>
<body><h1>404 – Page Not Found</h1><p><a href="/">Go to Climate Projections Explorer</a></p></body></html>`;

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = req.path;

    // Always pass through: known SPA routes (served by pre-render middleware above)
    // and Vite / API path prefixes.
    if (KNOWN_SPA_ROUTES_404.has(p) || VITE_INTERNAL_PREFIXES.some(pfx => p.startsWith(pfx))) {
      return next();
    }

    // In development, pass through file-extension paths so Vite dev server can
    // serve its own compiled assets (e.g. /src/main.tsx, /@vite/client, etc.).
    // In production, pass through too — express.static will serve them if they
    // exist; the vite.ts fallback returns 404 for any that don't.
    if (p.includes(".")) {
      // In development, only Vite-served files have extensions we should honour.
      // Unknown dotted paths that Vite can't serve still hit /{*any} in vite.ts
      // which is narrowed to return 404 for non-SPA paths.
      return next();
    }

    // Unknown page-like path (no extension, not a known SPA route, not an API
    // or Vite internal path) — return a real 404.
    res.status(404).set("Content-Type", "text/html; charset=utf-8").end(NOT_FOUND_HTML_404);
  });

  // Suppress unused variable warning — isDev is available for future use.
  void isDev;

  const httpServer = createServer(app);
  return httpServer;
}
