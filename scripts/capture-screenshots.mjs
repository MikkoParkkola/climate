import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_CHROME_PATHS = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];

const STATIC_PAGES = [
  { name: "home", url: "/" },
  { name: "comparison", url: "/comparison" },
  { name: "rankings", url: "/rankings" },
  { name: "methodology", url: "/methodology" },
  { name: "data-quality", url: "/data-quality" },
];

const SINGLE_LOCATION_PAGE = {
  name: "single-helsinki-2050",
  url: "/?lat=60.1700&lng=24.9400&place=Helsinki&country=Finland&year=2050&scenario=ssp245&run=1",
  waitText: "Projection Receipt",
  timeoutMs: 70000,
};

function parseArgs(argv) {
  const args = {
    base: "http://127.0.0.1:5000",
    outDir: path.join(repoRoot, "artifacts", "release-screenshots"),
    chrome: undefined,
    includeSingle: false,
    settleMs: 1800,
    timeoutMs: 30000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--base") {
      args.base = argv[++i];
    } else if (arg === "--out") {
      args.outDir = path.resolve(argv[++i]);
    } else if (arg === "--chrome") {
      args.chrome = argv[++i];
    } else if (arg === "--include-single") {
      args.includeSingle = true;
    } else if (arg === "--settle-ms") {
      args.settleMs = Number(argv[++i]);
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Capture launch screenshots with local Chrome headless.

Usage:
  node scripts/capture-screenshots.mjs [options]

Options:
  --base URL          Base URL to capture. Default: http://127.0.0.1:5000
  --out DIR           Output directory. Default: artifacts/release-screenshots
  --chrome PATH       Chrome/Chromium binary. Default: CHROME_BIN or common paths
  --include-single    Include one auto-running single-location result deep link
  --settle-ms N       Extra wait after page load for static pages. Default: 1800
  --timeout-ms N      Navigation timeout for static pages. Default: 30000

Run after npm run build and npm run start, or point --base at a deployed URL.
The --include-single route calls /api/climate-trajectory and should only be used
on a host with DATABASE_URL and the grounded model artifacts available.`);
}

function findChrome(explicitPath) {
  const candidates = explicitPath ? [explicitPath] : DEFAULT_CHROME_PATHS;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) {
      return candidate;
    }
  }
  throw new Error("Chrome/Chromium not found. Set CHROME_BIN or pass --chrome.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 10000, init = {}) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response.json();
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await delay(250);
  }
  throw lastError ?? new Error(`Timed out fetching ${url}`);
}

async function launchChrome(chromePath) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), "fupit-chrome-"));
  const port = 41000 + Math.floor(Math.random() * 1000);
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  chrome.stderr.on("data", () => {
    // Chrome writes noisy diagnostics to stderr in headless mode.
  });

  await fetchJson(`http://127.0.0.1:${port}/json/version`, 12000);

  return {
    port,
    async close() {
      if (!chrome.killed) chrome.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => chrome.once("exit", resolve)),
        delay(2000),
      ]);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          rmSync(userDataDir, { recursive: true, force: true });
          return;
        } catch (err) {
          if (attempt === 4) throw err;
          await delay(250);
        }
      }
    },
  };
}

async function createPage(port) {
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, 10000, { method: "PUT" });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();

  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result ?? {});
      return;
    }
    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) listener(message.params ?? {});
    }
  });

  function send(method, params = {}) {
    const commandId = ++id;
    ws.send(JSON.stringify({ id: commandId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(commandId, { resolve, reject });
    });
  }

  function once(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const methodListeners = listeners.get(method) ?? [];
        listeners.set(method, methodListeners.filter((listener) => listener !== handler));
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const handler = (params) => {
        clearTimeout(timeout);
        const methodListeners = listeners.get(method) ?? [];
        listeners.set(method, methodListeners.filter((listener) => listener !== handler));
        resolve(params);
      };
      listeners.set(method, [...(listeners.get(method) ?? []), handler]);
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");

  return {
    send,
    once,
    close() {
      ws.close();
    },
  };
}

async function waitForText(page, text, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await page.send("Runtime.evaluate", {
      expression: `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await delay(500);
  }
  throw new Error(`Timed out waiting for visible text: ${text}`);
}

async function capture(page, baseUrl, route, viewport, outDir, defaults) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
  });

  const url = new URL(route.url, baseUrl).toString();
  const loaded = page.once("Page.loadEventFired", route.timeoutMs ?? defaults.timeoutMs);
  await page.send("Page.navigate", { url });
  await loaded;
  await delay(defaults.settleMs);

  if (route.waitText) {
    await waitForText(page, route.waitText, route.timeoutMs ?? defaults.timeoutMs);
  }

  const screenshot = await page.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  const filename = `${route.name}-${viewport.name}.png`;
  const filePath = path.join(outDir, filename);
  writeFileSync(filePath, Buffer.from(screenshot.data, "base64"));
  return { file: filePath, route: route.url, viewport: viewport.name, width: viewport.width, height: viewport.height };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const chromePath = findChrome(args.chrome);
  mkdirSync(args.outDir, { recursive: true });
  const pages = args.includeSingle ? [...STATIC_PAGES, SINGLE_LOCATION_PAGE] : STATIC_PAGES;
  const chrome = await launchChrome(chromePath);
  const manifest = {
    generatedAt: new Date().toISOString(),
    base: args.base,
    chromePath,
    includeSingle: args.includeSingle,
    screenshots: [],
  };

  try {
    const page = await createPage(chrome.port);
    try {
      for (const route of pages) {
        for (const viewport of VIEWPORTS) {
          const item = await capture(page, args.base, route, viewport, args.outDir, args);
          manifest.screenshots.push(item);
          console.log(`captured ${path.relative(repoRoot, item.file)} (${route.name}, ${viewport.name})`);
        }
      }
    } finally {
      page.close();
    }
  } finally {
    await chrome.close();
  }

  const manifestPath = path.join(args.outDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${path.relative(repoRoot, manifestPath)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
