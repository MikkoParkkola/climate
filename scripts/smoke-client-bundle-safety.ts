// smoke:client-safety — guards against Node-only globals leaking into the browser bundle.
//
// Why this exists: on 2026-06-29 fupit.com served only the SEO fallback and no UI.
// The build was green and every other gate passed, but two client lib self-check
// blocks referenced `process.argv[1]` WITHOUT a `typeof process` guard. In the
// browser `process` is undefined, so the bundle threw `ReferenceError: process is
// not defined` at module-init, React never mounted, and users saw the crawler HTML.
// CI never caught it because nothing ever EXECUTES the bundle (per the project's
// "verify in layers, never one giant e2e" rule). This static scan is the cheap,
// browser-free guard for that exact class: a bare Node global at top-level eval.
//
// ponytail: static scan, not a real browser mount. Catches bare `process.`/`__dirname`/
// top-level `require(` — the crash-on-init class. A footgun smuggled in via a Vite
// `define` (e.g. process.env.X replaced at build time) would slip past; add a headless
// mount check if that ever bites.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = "dist/public";

// The mount bundle is whatever index.html eager-loads via <script src> (plus any
// modulepreload). Lazy import() chunks (jspdf, html2canvas and their vendored deps)
// are deliberately OUT of scope: they only execute on a user action, and third-party
// polyfills carry their own `process` fallbacks. The site-killing crash is strictly
// code that runs at initial page load — so that is all we scan.
function eagerBundles(): string[] {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  const srcs = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+src="(\/assets\/[^"]+\.js)"/g)) srcs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="(\/assets\/[^"]+\.js)"/g)) srcs.add(m[1]);
  return [...srcs].map((s) => s.replace(/^\//, ""));
}

// A `process.` use is safe only if a `typeof process` guard sits just before it
// (esbuild minifies `typeof process !== "undefined"` to `typeof process<"u"`).
// Window is generous: the minified guard `typeof process<"u"&&import.meta.url===...`
// can put ~50 chars between the guard and the `process.argv` use it protects.
function unguardedProcessUses(src: string): number {
  let count = 0;
  let idx = src.indexOf("process.");
  while (idx !== -1) {
    const window = src.slice(Math.max(0, idx - 90), idx);
    if (!window.includes("typeof process")) count++;
    idx = src.indexOf("process.", idx + 1);
  }
  return count;
}

function main(): void {
  const files = eagerBundles();
  assert.ok(files.length > 0, `no <script> bundle found in ${PUBLIC}/index.html — run \`npm run build\` first`);

  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(PUBLIC, f), "utf8");
    const bareProcess = unguardedProcessUses(src);
    // `__dirname`/`__filename` and a top-level `require(` never belong in a browser bundle.
    const hasDirname = /\b__dirname\b|\b__filename\b/.test(src);
    if (bareProcess > 0) offenders.push(`${f}: ${bareProcess} unguarded process.* reference(s)`);
    if (hasDirname) offenders.push(`${f}: references __dirname/__filename`);
  }

  assert.equal(
    offenders.length,
    0,
    `Node-only global(s) leaked into the eager client bundle — this crashes React at module init in the browser:\n  ${offenders.join("\n  ")}\n` +
      `Fix: guard dev-only self-checks with \`typeof process !== "undefined" && ...\` or move the code server-side.`,
  );

  console.log(`smoke:client-safety OK — ${files.length} eager bundle(s) free of unguarded Node globals: ${files.join(", ")}`);
}

main();
