import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { MODEL_CACHE_VERSION } from "./model-cache-version";
import { insertClimateLocationSchema } from "@shared/schema";
import { z } from "zod";

const MAX_PYTHON_CONCURRENT = 2;
const PYTHON_TIMEOUT_MS = 60_000;
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
let activePythonProcesses = 0;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MIN_FORECAST_YEAR = 2024;
const MAX_FORECAST_YEAR = 2100;
const CLIMATE_SCENARIOS = ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"] as const;
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

// Bounded concurrency for the Python climate model. Callers acquire a slot
// before spawning and release it when the process settles. Waiters queue
// (instead of failing) so multi-year trajectory requests glide to completion.
const pythonQueue: Array<() => void> = [];

function acquirePythonSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activePythonProcesses < MAX_PYTHON_CONCURRENT) {
      activePythonProcesses++;
      resolve();
    } else {
      pythonQueue.push(resolve);
    }
  });
}

function releasePythonSlot(): void {
  const next = pythonQueue.shift();
  if (next) {
    // Hand the slot directly to the next waiter; count stays unchanged.
    next();
  } else {
    activePythonProcesses = Math.max(0, activePythonProcesses - 1);
  }
}

// Runs grounded_model.py with bounded concurrency and returns parsed JSON.
async function runGroundedModel(args: string[]): Promise<any> {
  await acquirePythonSlot();
  return new Promise((resolve, reject) => {
    let killed = false;
    let settled = false;
    // grounded_model.py is offline (reads the compact CMIP6/IPCC grid in data/).
    const python = spawn(PYTHON_BIN, [
      "grounded_model.py",
      ...args,
    ]);

    const killTimer = setTimeout(() => {
      killed = true;
      python.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    let output = "";
    python.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    python.stderr.on("data", (_data: Buffer) => {
      // Intentionally discarded — stderr may contain internal paths or secrets
    });

    python.on("close", (code: number | null) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (settled) return;
      settled = true;
      if (killed) return reject(new Error("timeout"));
      if (code !== 0) return reject(new Error("model_failed"));
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("parse_error"));
      }
    });

    python.on("error", (err: Error) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (settled) return;
      settled = true;
      console.error("Failed to start grounded_model.py:", err.message);
      reject(new Error("spawn_error"));
    });
  });
}

// Runs the climate model for a single (lat, lng, year). Kept as a narrow wrapper
// for legacy call sites and single-year cache fills.
async function runClimateModel(
  lat: number,
  lng: number,
  year: number,
  scenario = DEFAULT_CLIMATE_SCENARIO,
): Promise<any> {
  return runGroundedModel([lat.toString(), lng.toString(), year.toString(), scenario]);
}

// Runs the climate model for multiple checkpoint years in one Python process so
// the compact grid is loaded once for an uncached trajectory.
async function runClimateTrajectory(
  lat: number,
  lng: number,
  years: number[],
  scenario = DEFAULT_CLIMATE_SCENARIO,
): Promise<any> {
  return runGroundedModel([
    "--trajectory",
    lat.toString(),
    lng.toString(),
    years.join(","),
    scenario,
  ]);
}

function projectionScenario(projection: unknown): string | undefined {
  if (!projection || typeof projection !== "object") return undefined;
  const p = projection as { scenario?: unknown; metadata?: { scenario?: unknown } };
  const scenario = p.metadata?.scenario ?? p.scenario;
  return typeof scenario === "string" ? scenario : undefined;
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
      "Compare side-by-side climate projections for up to 10 locations. Slide through 2025–2100 to watch temperature, precipitation, risk, and habitability diverge in real time.",
    bodyHtml: `<main aria-label="Page introduction">
  <h1>fupit — compare climate by location</h1>
  <p>Compare side-by-side climate projections for up to 10 locations. Slide through 2025–2100 to watch temperature, precipitation, risk, and habitability diverge in real time.</p>
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
    <li>Temperature and precipitation change: CMIP6 model output behind the IPCC Sixth Assessment Report, aggregated by scenario and decade.</li>
    <li>Present-day baseline: WorldClim v2.1 observed monthly climatology (1970-2000, 10 arc-minutes) where available, with CMIP6 historical climatology as fallback.</li>
    <li>Sea-level rise: IPCC AR6 regional projections.</li>
    <li>Heat, drought, and flood risk: CMIP6 ETCCDI extreme-climate indices scored against documented thresholds.</li>
    <li>Climate twin: nearest present-day city in the indexed catalog by standardized monthly temperature and precipitation distance from grounded model output.</li>
  </ul>
  <h2>Honesty rules</h2>
  <ul>
    <li>Temperature is shown with the IPCC-calibrated value as the headline and raw CMIP6 model consensus available for comparison.</li>
    <li>Precipitation is shown as model consensus plus spread because there is no equivalent single assessed calibration anchor.</li>
    <li>Risk scores expose the raw physical quantity next to the 0 to 100 score.</li>
  </ul>
  <p>Sources: WorldClim v2.1 (Fick & Hijmans 2017); IPCC AR6 Working Group I; CMIP6; ETCCDI indices; IPCC AR6 sea-level projections.</p>
  <p><a href="/">Return to fupit</a> or inspect <a href="${GITHUB_REPO_URL}">the source on GitHub</a>.</p>
</main>`,
  },
};

function pageUrl(pagePath: string): string {
  return `${SEO_BASE}${pagePath === "/" ? "/" : pagePath}`;
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

function injectSeoHtml(template: string, page: SeoPage): string {
  const url = pageUrl(page.path);
  const ogImage = `${SEO_BASE}/og-image.png`;
  const jsonLd = JSON.stringify(pageSchema(page));
  return template
    .split("https://global-geo-selector-mikkoparkkola.replit.app")
    .join(SEO_BASE)
    .split("https://climate-projections.replit.app")
    .join(SEO_BASE)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${page.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${page.title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${page.description}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`)
    .replace(
      /<script type="application\/ld\+json" id="page-schema">[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="page-schema">${jsonLd}</script>`,
    )
    .replace(/<div id="root"><\/div>/, `<div id="root">${page.bodyHtml}</div>`);
}

function makeSeoHandler(page: SeoPage) {
  return (_req: any, res: any, next: any) => {
    try {
      const file = path.resolve(import.meta.dirname, "public", "index.html");
      const html = injectSeoHtml(fs.readFileSync(file, "utf-8"), page);
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
      engine: "grounded_model.py",
      modelCacheVersion: MODEL_CACHE_VERSION,
      cachePurge: "startup-incompatible-delete-enabled",
      legacyProjectionEndpoints: "410-gone",
      seoBase: SEO_BASE,
      routes: ["/", "/comparison", "/methodology"],
      deployment: {
        commit: deploymentCommit,
        build: buildInfo,
        id: process.env.REPLIT_DEPLOYMENT_ID || null,
      },
    });
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
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const locations = await storage.searchClimateLocations(query);
      // Add lat/lng aliases so the client can use either naming convention
      res.json(locations.map(l => ({ ...l, lat: Number(l.latitude), lng: Number(l.longitude) })));
    } catch (error) {
      console.error("Error searching locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
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

  // Climate projection routes
  app.get("/api/projections", (_req, res) => legacyProjectionGone(res));
  app.get("/api/projections/:locationId/:year", (_req, res) => legacyProjectionGone(res));
  app.get("/api/projections/:locationId", (_req, res) => legacyProjectionGone(res));

  // Export data routes
  app.get("/api/export/csv/:locationId/:year", async (req, res) => {
    try {
      const locationId = parseInt(req.params.locationId);
      const year = parseInt(req.params.year);
      
      const location = await storage.getClimateLocation(locationId);
      const projection = await storage.getClimateProjection(locationId, year);
      
      if (!location || !projection) {
        return res.status(404).json({ message: "Data not found" });
      }
      
      const csvData = generateCSV(location, projection);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="climate-projection-${location.name}-${year}.csv"`);
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // API Key Management Routes
  app.get("/api/user/keys", async (req, res) => {
    try {
      const userId = 1; // Demo user - in production would come from auth
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        nvidiaApiKey: !!user.nvidiaApiKey,
        cbottleApiKey: !!user.cbottleApiKey,
      });
    } catch (error) {
      console.error("Error fetching user keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.put("/api/user/keys", async (req, res) => {
    try {
      const { nvidiaApiKey, cbottleApiKey } = req.body;
      const userId = 1; // Demo user
      
      const user = await storage.updateUserApiKeys(userId, nvidiaApiKey, cbottleApiKey);
      
      res.json({
        message: "API keys updated successfully",
        nvidiaApiKey: !!user.nvidiaApiKey,
        cbottleApiKey: !!user.cbottleApiKey,
      });
    } catch (error) {
      console.error("Error updating API keys:", error);
      res.status(500).json({ message: "Failed to update API keys" });
    }
  });

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

  // Save user comparison
  app.post("/api/user/comparisons", async (req, res) => {
    try {
      const { name, locationIds, year } = req.body;
      const userId = 1; // Demo user
      
      const comparison = await storage.createLocationComparison(userId, name, locationIds, year);
      res.json(comparison);
    } catch (error) {
      console.error("Error saving comparison:", error);
      res.status(500).json({ message: "Failed to save comparison" });
    }
  });

  // Get user comparisons
  app.get("/api/user/comparisons", async (req, res) => {
    try {
      const userId = 1; // Demo user
      const comparisons = await storage.getUserComparisons(userId);
      res.json(comparisons);
    } catch (error) {
      console.error("Error fetching comparisons:", error);
      res.status(500).json({ message: "Failed to fetch comparisons" });
    }
  });

  // PDF Export endpoint
  app.post("/api/climate/export-comparison", async (req, res) => {
    try {
      const { locationIds, year, name } = req.body;
      
      const pdfData = await generateComparisonPDF(locationIds, year, name);
      
      res.json({ 
        downloadUrl: `/tmp/${pdfData.filename}`,
        message: "PDF generated successfully" 
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // POST /api/climate-projection — securely spawns Python runner with validated args
  app.post("/api/climate-projection", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    if (activePythonProcesses >= MAX_PYTHON_CONCURRENT) {
      return res.status(503).json({ message: "Server busy. Please try again shortly." });
    }

    const bodySchema = z.object({
      location: z.string().min(1).max(200),
      coordinates: z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      }),
      year: z.coerce.number().int().min(MIN_FORECAST_YEAR).max(MAX_FORECAST_YEAR),
      apiKey: z.string().max(500).optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("climate-projection 400 — field errors:", JSON.stringify(parsed.error.issues));
      return res.status(400).json({ message: "Invalid request parameters" });
    }

    const { coordinates, year, apiKey: clientApiKey } = parsed.data;
    // grounded_model.py is offline (reads the compact CMIP6/IPCC grid in data/)
    // and needs no API key. clientApiKey is accepted but ignored for compatibility.
    void clientApiKey;

    activePythonProcesses++;
    let killed = false;
    let responded = false;

    const python = spawn(PYTHON_BIN, [
      "grounded_model.py",
      coordinates.lat.toString(),
      coordinates.lng.toString(),
      year.toString(),
    ]);

    const killTimer = setTimeout(() => {
      killed = true;
      python.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    let output = "";

    python.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    python.stderr.on("data", (_data: Buffer) => {
      // Intentionally discarded — stderr may contain internal paths or secrets
    });

    python.on("close", (code: number | null) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (responded) return;
      responded = true;
      if (killed) {
        return res.status(504).json({ message: "Climate model timed out. Please try again." });
      }
      if (code !== 0) {
        console.error("grounded_model.py exited with non-zero code:", code);
        return res.status(500).json({ message: "Climate model failed. Please try again." });
      }
      try {
        const result = JSON.parse(output);
        res.json({ success: true, data: result });
      } catch {
        console.error("Failed to parse grounded_model.py output");
        res.status(500).json({ message: "Failed to parse climate model output." });
      }
    });

    python.on("error", (err: Error) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (responded) return;
      responded = true;
      console.error("Failed to start grounded_model.py:", err.message);
      res.status(500).json({ message: "Climate model unavailable." });
    });
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
      years: z.array(z.coerce.number().int().min(MIN_FORECAST_YEAR).max(MAX_FORECAST_YEAR)).min(1).max(5),
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
    // one — reuses a previously cached model run instead of re-spawning Python.
    // Storage also checks the JSON payload's grounded-grid cache version; old
    // unversioned cbottle-era rows read as misses and are overwritten.
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const latKey = round2(coordinates.lat);
    const lngKey = round2(coordinates.lng);

    try {
      const pointsByYear = new Map<number, any>();
      const missingYears: number[] = [];
      let cachedCount = 0;
      for (const year of years) {
        const cached = await storage.getCachedModelProjection(latKey, lngKey, year);
        if (cached && projectionScenario(cached) === scenario) {
          cachedCount++;
          pointsByYear.set(year, { year, cached: true, ...(cached as object) });
          continue;
        }
        missingYears.push(year);
      }

      if (missingYears.length > 0) {
        // grounded_model.py is offline — no API key needed for any location.
        const trajectory = await runClimateTrajectory(coordinates.lat, coordinates.lng, missingYears, scenario);
        const projectedPoints = Array.isArray(trajectory?.points) ? trajectory.points : [];
        for (const projection of projectedPoints) {
          const year = Number(projection?.year);
          if (!missingYears.includes(year)) continue;
          await storage.saveModelProjection(latKey, lngKey, year, projection);
          pointsByYear.set(year, { year, cached: false, ...projection });
        }
        for (const year of missingYears) {
          if (!pointsByYear.has(year)) {
            throw new Error("parse_error");
          }
        }
      }

      const points = years.map((year) => pointsByYear.get(year));
      res.json({ success: true, data: { coordinates, points, cachedCount } });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "timeout") {
        return res.status(504).json({ message: "Climate model timed out. Please try again." });
      }
      console.error("climate-trajectory failed:", msg);
      res.status(500).json({ message: "Climate model failed. Please try again." });
    }
  });

  // Global habitability rankings endpoint
  app.get("/api/climate/global-rankings", async (req, res) => {
    const clientIp = ((req.ip ?? "") || (req.socket?.remoteAddress ?? "unknown")).replace(/^::ffff:/, "");
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    if (activePythonProcesses >= MAX_PYTHON_CONCURRENT) {
      return res.status(503).json({ message: "Server busy. Please try again shortly." });
    }

    const rawYear = req.query.year === undefined ? 2050 : Number(req.query.year);
    if (!Number.isInteger(rawYear) || rawYear < MIN_FORECAST_YEAR || rawYear > MAX_FORECAST_YEAR) {
      return res.status(400).json({ message: "Invalid request parameters" });
    }
    const year = rawYear;

    activePythonProcesses++;
    let killed = false;
    let responded = false;

    const python = spawn(PYTHON_BIN, ["grounded_model.py", "--rankings", year.toString()]);

    const killTimer = setTimeout(() => {
      killed = true;
      python.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    let output = "";

    python.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });

    python.stderr.on("data", (_data: Buffer) => {
      // Intentionally discarded — do not expose internal diagnostics to callers
    });

    python.on("close", (code: number | null) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (responded) return;
      responded = true;
      if (killed) {
        return res.status(504).json({ message: "Rankings computation timed out. Please try again." });
      }
      if (code !== 0) {
        console.error("grounded_model.py --rankings exited with code:", code);
        return res.status(500).json({ message: "Failed to generate global rankings." });
      }
      try {
        const rankings = JSON.parse(output);
        res.json(rankings);
      } catch {
        console.error("Failed to parse global rankings output");
        res.status(500).json({ message: "Failed to parse rankings data." });
      }
    });

    python.on("error", (err: Error) => {
      clearTimeout(killTimer);
      releasePythonSlot();
      if (responded) return;
      responded = true;
      console.error("Failed to start grounded_model.py --rankings:", err.message);
      res.status(500).json({ message: "Rankings service unavailable." });
    });
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
        const html = injectSeoHtml(template, page);
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
  const KNOWN_SPA_ROUTES_404 = new Set(["/", "/comparison", "/methodology"]);
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

async function generateComparisonPDF(locationIds: number[], year: number, name: string) {
  // Simplified PDF generation - in production use libraries like PDFKit or Puppeteer
  const filename = `climate-comparison-${year}-${Date.now()}.pdf`;
  const content = `Climate Comparison Report\n\nName: ${name}\nYear: ${year}\nLocations: ${locationIds.join(', ')}\n\nGenerated on: ${new Date().toISOString()}`;
  
  return {
    filename,
    content,
    path: `/tmp/${filename}`
  };
}

function generateCSV(location: any, projection: any): string {
  const headers = [
    'Location',
    'Latitude',
    'Longitude',
    'Projection Year',
    'Average Temperature (°C)',
    'Temperature Change (°C)',
    'Annual Precipitation (mm)',
    'Precipitation Change (mm)',
    'Humidity (%)',
    'Humidity Change (%)',
    'Sea Level (m)',
    'Sea Level Change (m)',
    'Heat Stress Risk (0-100)',
    'Drought Risk (0-100)',
    'Flooding Risk (0-100)',
  ];

  const row = [
    location.name,
    location.latitude,
    location.longitude,
    projection.projectionYear,
    projection.averageTemperature,
    projection.temperatureChange,
    projection.annualPrecipitation,
    projection.precipitationChange,
    projection.humidity,
    projection.humidityChange,
    projection.seaLevel,
    projection.seaLevelChange,
    projection.heatStressRisk,
    projection.droughtRisk,
    projection.floodingRisk,
  ];

  return [headers.join(','), row.join(',')].join('\n');
}
