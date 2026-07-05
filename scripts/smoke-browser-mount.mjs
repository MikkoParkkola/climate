// smoke:browser-mount — the definitive guard for the 2026-06-29 blank-UI incident.
//
// That outage: the build was green, every other smoke test passed, yet fupit.com
// rendered only the SEO fallback because the client bundle threw at module init
// (`ReferenceError: process is not defined`) and React never mounted. The gap was
// that NOTHING in CI ever executed the bundle in a browser. This test closes that:
// it boots the production server against the real built assets, loads actual routes
// in headless Chrome, and FAILS if the page throws or React fails to mount.
//
// No new dependency: drives system Chrome over the DevTools Protocol using `ws`
// (already a dep). If no Chrome is found, it SKIPS loudly (exit 0) so Chrome-less
// CI environments aren't blocked — the static `smoke:client-safety` scan still runs
// there. On any machine with Chrome (every dev box, and CI images that ship it),
// this runs for real.
//
// ponytail: system-Chrome-over-CDP instead of bundling Playwright (~150MB download +
// untrusted postinstall). Upgrade to a pinned browser only if CI must guarantee a
// browser is always present.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import WebSocket from "ws";

const SERVER_PORT = Number(process.env.MOUNT_TEST_PORT || 5098);
const CDP_PORT = Number(process.env.MOUNT_TEST_CDP_PORT || 9333);
const BASE = `http://127.0.0.1:${SERVER_PORT}`;
// Routes that get server-side SEO injection — the exact surface that broke. "/" is
// the home page that was blank in production; "/comparison" shares the inject path.
const ROUTES = ["/", "/comparison"];
// The SEO fallback's root marker. If this is still #root's first child after JS runs,
// React did not mount.
const SEO_MARKER = "Page introduction";

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(macChrome)) return macChrome;
  for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      const p = execSync(`command -v ${bin}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (p) return p;
    } catch { /* not found, try next */ }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { tries = 60, gap = 500, what = "condition" }) {
  for (let i = 0; i < tries; i++) {
    try { if (await fn()) return; } catch { /* keep polling */ }
    await sleep(gap);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// Drive one tab: navigate, collect exceptions, return whether React replaced the SEO root.
async function checkRoute(wsUrl, route) {
  const ws = new WebSocket(wsUrl);
  const exceptions = [];
  let nextId = 0;
  const send = (method, params = {}) => { const id = ++nextId; ws.send(JSON.stringify({ id, method, params })); return id; };
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = send(method, params);
      const onMsg = (d) => { const m = JSON.parse(d); if (m.id === id) { ws.off("message", onMsg); resolve(m.result); } };
      ws.on("message", onMsg);
    });

  await new Promise((r) => ws.on("open", r));
  ws.on("message", (d) => {
    const m = JSON.parse(d);
    if (m.method === "Runtime.exceptionThrown") {
      const e = m.params.exceptionDetails;
      exceptions.push((e.exception && (e.exception.description || e.exception.value)) || e.text);
    }
  });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Page.navigate", { url: BASE + route });
  await sleep(4000); // let the module graph evaluate and React mount

  const ev = await call("Runtime.evaluate", {
    expression:
      "document.querySelector('#root')?.firstElementChild?.getAttribute('aria-label') || " +
      "document.querySelector('#root')?.firstElementChild?.tagName || 'EMPTY'",
    returnByValue: true,
  });
  const rootMarker = ev?.result?.value ?? "EMPTY";
  ws.close();
  const mounted = rootMarker !== "EMPTY" && !String(rootMarker).includes(SEO_MARKER);
  return { route, mounted, rootMarker, exceptions };
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.log("smoke:browser-mount SKIPPED — no Chrome found (set CHROME_PATH to enable). Static smoke:client-safety still guards this.");
    process.exit(0);
  }
  if (!existsSync("dist/index.js") || !existsSync("dist/public/index.html")) {
    throw new Error("no production build — run `npm run build` first");
  }

  const profile = mkdtempSync(join(tmpdir(), "fupit-mount-"));
  // DB-free: the mount path needs no database, and that is the path that broke.
  const server = spawn("node", ["dist/index.js"], {
    env: { ...process.env, PORT: String(SERVER_PORT), NODE_ENV: "production", DATABASE_URL: "" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const browser = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore"] });

  const cleanup = () => {
    try { browser.kill("SIGKILL"); } catch { /* */ }
    try { server.kill("SIGKILL"); } catch { /* */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* */ }
  };

  try {
    await waitFor(async () => (await fetch(`${BASE}/api/health`)).ok, { what: "server /api/health" });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok, { what: "chrome devtools" });

    const results = [];
    for (const route of ROUTES) {
      const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE + route)}`, { method: "PUT" })
        .catch(() => fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE + route)}`))).json();
      results.push(await checkRoute(tab.webSocketDebuggerUrl, route));
    }

    const failures = results.filter((r) => !r.mounted || r.exceptions.length > 0);
    for (const r of results) {
      const status = !r.mounted ? "DID NOT MOUNT" : r.exceptions.length ? "THREW" : "ok";
      console.log(`  ${r.route} -> ${status}${r.exceptions.length ? ": " + r.exceptions[0].split("\n")[0] : ` (root: ${r.rootMarker})`}`);
    }
    if (failures.length > 0) {
      throw new Error(
        `React failed to mount or the page threw on ${failures.length}/${results.length} route(s). ` +
        `This is the blank-UI class of bug — the build is fine but the app crashes in the browser.`,
      );
    }
    console.log(`smoke:browser-mount OK — React mounted with no page exceptions on ${results.length} route(s): ${ROUTES.join(", ")}`);
  } finally {
    cleanup();
  }
}

main().catch((e) => {
  console.error("smoke:browser-mount FAILED:", e.message);
  process.exit(1);
});
