// ── Dynamic social-preview (Open Graph) image renderer ───────────────────────
// Renders a 1200x630 PNG social card with satori (React-element -> SVG) and
// @resvg/resvg-wasm (WASM SVG -> PNG). Pure JS + WASM only: no sharp, no native
// @resvg/resvg-js, no node-canvas — so it builds and runs in the Replit autoscale
// sandbox without native toolchains.
//
// CARDINAL RULE (no fabricated science): the livability score shown is exactly
// the value passed in. If it is missing or invalid, the card renders a generic
// branded default with NO number — silence beats a confident lie.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

// ── Theme (mirrors client/src/lib/climate-constants.ts) ──────────────────────
const BG = "hsl(28,13%,8%)"; // graphite
const PANEL = "hsl(28,13%,11.5%)";
const BORDER = "hsl(34,12%,22%)";
const ACCENT = "hsl(24,88%,56%)"; // ember
const MUTED = "hsl(38,11%,60%)";
const TEXT = "hsl(38,30%,94%)";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export interface OgParams {
  place?: string;
  lat?: number;
  lng?: number;
  year?: number;
  score?: number;
  scenario?: string;
}

// Parse + validate raw query into honest, bounded fields. Never throws: invalid
// input simply yields an absent field, which the card renders as "no number".
export function parseOgParams(query: Record<string, unknown>): OgParams {
  const out: OgParams = {};

  const place = typeof query.place === "string" ? query.place.trim() : "";
  if (place) out.place = place.slice(0, 80);

  const lat = Number(query.lat);
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90) out.lat = lat;

  const lng = Number(query.lng);
  if (Number.isFinite(lng) && lng >= -180 && lng <= 180) out.lng = lng;

  const year = Number(query.year);
  if (Number.isFinite(year) && year >= 1900 && year <= 2100) out.year = Math.round(year);

  const score = Number(query.score);
  if (Number.isFinite(score) && score >= 0 && score <= 100) out.score = Math.round(score);

  const scenario = typeof query.scenario === "string" ? query.scenario.trim() : "";
  if (scenario) out.scenario = scenario.slice(0, 40);

  return out;
}

// Human label for a scenario code. Unknown codes return undefined so we never
// invent a pathway claim.
function scenarioLabel(scenario?: string): string | undefined {
  if (!scenario) return undefined;
  const key = scenario.toLowerCase().replace(/[\s_-]+/g, "");
  switch (key) {
    case "ssp126":
      return "SSP1-2.6 · low emissions";
    case "ssp245":
      return "SSP2-4.5 · middle path";
    case "ssp370":
      return "SSP3-7.0 · high emissions";
    case "ssp585":
      return "SSP5-8.5 · very high emissions";
    case "currentpolicy":
    case "currentpolicyreference":
      return "Current-policy reference";
    default:
      return undefined;
  }
}

// ── Font loading (Public Sans, OFL-1.1; matches the site's body font) ────────
// satori needs TTF/OTF/WOFF buffers (it embeds glyphs as SVG paths). The repo's
// committed web fonts are woff2, which satori cannot read, so two small TTFs are
// committed under server/assets/fonts and copied into dist at build time.
type SatoriFont = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fontsCache: SatoriFont[] | null = null;

function readFontFile(file: string): Buffer {
  const candidates = [
    path.resolve(import.meta.dirname, "assets", "fonts", file), // prod: dist/assets/fonts (build copy)
    fileURLToPath(new URL(`./assets/fonts/${file}`, import.meta.url)), // dev: server/assets/fonts
    path.resolve(process.cwd(), "server", "assets", "fonts", file), // fallback: repo root
  ];
  for (const candidate of candidates) {
    try {
      return fs.readFileSync(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(`og font not found: ${file}`);
}

function loadFonts(): SatoriFont[] {
  if (fontsCache) return fontsCache;
  fontsCache = [
    { name: "Public Sans", data: readFontFile("PublicSans-Regular.ttf"), weight: 400, style: "normal" },
    { name: "Public Sans", data: readFontFile("PublicSans-Bold.ttf"), weight: 700, style: "normal" },
  ];
  return fontsCache;
}

// ── WASM init (once) ─────────────────────────────────────────────────────────
let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    wasmReady = initWasm(fs.readFileSync(wasmPath));
  }
  return wasmReady;
}

// ── Element helpers (plain objects, no JSX runtime dependency) ────────────────
type El = { type: string; props: Record<string, unknown> };
function el(type: string, style: Record<string, unknown>, children?: unknown): El {
  return { type, props: { style, children } };
}

function buildCard(params: OgParams): El {
  const hasScore = typeof params.score === "number";
  const sLabel = scenarioLabel(params.scenario);

  const headline = params.place || "See where the climate is still livable";
  const coordLine =
    typeof params.lat === "number" && typeof params.lng === "number"
      ? `${params.lat.toFixed(2)}°, ${params.lng.toFixed(2)}°`
      : undefined;

  // Header: wordmark + tagline
  const header = el(
    "div",
    { display: "flex", alignItems: "center", gap: 18 },
    [
      el("div", { display: "flex", fontSize: 46, fontWeight: 700, color: ACCENT, letterSpacing: -1 }, "fupit"),
      el("div", { display: "flex", fontSize: 22, fontWeight: 400, color: MUTED }, "grounded climate projection"),
    ],
  );

  // Middle: place name (+ coords)
  const middleChildren: El[] = [
    el(
      "div",
      { display: "flex", fontSize: headline.length > 28 ? 60 : 76, fontWeight: 700, color: TEXT, lineHeight: 1.05 },
      headline,
    ),
  ];
  if (coordLine) {
    middleChildren.push(
      el("div", { display: "flex", fontSize: 26, fontWeight: 400, color: MUTED, marginTop: 10 }, coordLine),
    );
  }
  const middle = el("div", { display: "flex", flexDirection: "column" }, middleChildren);

  // Score block — only when honest value present
  let scoreBlock: El;
  if (hasScore) {
    scoreBlock = el(
      "div",
      { display: "flex", alignItems: "flex-end", gap: 22 },
      [
        el("div", { display: "flex", fontSize: 168, fontWeight: 700, color: ACCENT, lineHeight: 0.9 }, String(params.score)),
        el(
          "div",
          { display: "flex", flexDirection: "column", marginBottom: 22 },
          [
            el("div", { display: "flex", fontSize: 34, fontWeight: 700, color: TEXT }, "livability"),
            el("div", { display: "flex", fontSize: 24, fontWeight: 400, color: MUTED }, "score out of 100"),
          ],
        ),
      ],
    );
  } else {
    scoreBlock = el(
      "div",
      { display: "flex", fontSize: 34, fontWeight: 400, color: MUTED, maxWidth: 900, lineHeight: 1.2 },
      "Climate projections for any place on Earth, year by year to 2100.",
    );
  }

  // Footer: year + scenario chips, and domain
  const chips: El[] = [];
  if (typeof params.year === "number") {
    chips.push(chip(`Year ${params.year}`));
  }
  if (sLabel) {
    chips.push(chip(sLabel));
  }
  const footer = el(
    "div",
    { display: "flex", alignItems: "center", justifyContent: "space-between" },
    [
      el("div", { display: "flex", alignItems: "center", gap: 14 }, chips),
      el("div", { display: "flex", fontSize: 24, fontWeight: 700, color: MUTED }, "fupit.com"),
    ],
  );

  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: OG_WIDTH,
      height: OG_HEIGHT,
      padding: 72,
      backgroundColor: BG,
      fontFamily: "Public Sans",
      // ember hairline along the top edge
      borderTop: `10px solid ${ACCENT}`,
    },
    [header, middle, scoreBlock, footer],
  );
}

function chip(label: string): El {
  return el(
    "div",
    {
      display: "flex",
      fontSize: 24,
      fontWeight: 700,
      color: TEXT,
      backgroundColor: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: "10px 18px",
    },
    label,
  );
}

// Render a social card to a PNG buffer. Pass {} for the generic default card.
export async function renderOgPng(params: OgParams): Promise<Buffer> {
  await ensureWasm();
  const tree = buildCard(params) as Parameters<typeof satori>[0];
  const svg = await satori(tree, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: loadFonts(),
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { loadSystemFonts: false },
  });
  return Buffer.from(resvg.render().asPng());
}
