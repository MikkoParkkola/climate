// ── Per-location SEO: grounded, crawlable <head> for every place page ─────────
// Pure builders (no Express, no DB) so the smoke test can exercise the exact
// strings a crawler receives. routes.ts wires these into the `/place/:slug`
// handler; scripts/smoke-location-seo.ts asserts the output directly.
//
// Cardinal rule: only grounded values reach the head. Any metric the engine
// returns as null is simply omitted — never guessed, never hyped. The headline
// hook is the climate twin ("<city> in <year> may feel like <analog> today"),
// the single most shareable sentence the engine already computes.
import type { ResolvedPlace } from "./location-catalog";

export interface LocationHeadline {
  warmingC: number | null;
  seaLevelCm: number | null;
  seaApplicable: boolean;
  habitability: number | null;
  category: string | null;
  analog: { name: string; country: string } | null;
  analogClose: boolean;
}

export interface LocationSeo {
  title: string;
  description: string;
  canonical: string;
  ogImageUrl: string;
  jsonLd: string;
  bodyHtml: string;
  island: string;
}

const SCENARIO_LABELS: Record<string, string> = {
  ssp126: "SSP1-2.6, low emissions",
  ssp245: "SSP2-4.5, middle path",
  ssp370: "SSP3-7.0, high emissions",
  ssp585: "SSP5-8.5, very high emissions",
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function placeLabel(place: ResolvedPlace): string {
  return place.country ? `${place.name}, ${place.country}` : place.name;
}

// Pull the headline numbers from the engine projection + climate-twin result.
// Defensive: the projection is a Record<string, unknown>, so every field is
// guarded and degrades to null rather than fabricating a value.
export function extractHeadline(projection: unknown, twin: unknown): LocationHeadline {
  const p = (projection ?? {}) as Record<string, any>;
  const warmingC = num(p?.temperature?.anomaly);
  const seaLevelCm = num(p?.extremes?.sea_level_rise_cm);
  const seaApplicable = Boolean(p?.extremes?.sea_level_applicable);
  const habitability = num(p?.habitability?.score);
  const category = typeof p?.habitability?.category === "string" ? p.habitability.category : null;

  let analog: { name: string; country: string } | null = null;
  let analogClose = false;
  const t = (twin ?? {}) as Record<string, any>;
  const candidate = t?.match?.candidate;
  const quality = typeof t?.matchQuality === "string" ? t.matchQuality : "";
  if (candidate && typeof candidate.name === "string" && !t?.noCloseAnalog) {
    analog = { name: candidate.name, country: typeof candidate.country === "string" ? candidate.country : "" };
    analogClose = quality === "close-catalog-match" || quality === "moderate-catalog-match";
  }
  return { warmingC, seaLevelCm, seaApplicable, habitability, category, analog, analogClose };
}

function fmtWarming(c: number): string {
  return `${c >= 0 ? "+" : ""}${c.toFixed(1)}°C`;
}

// Build every head string for a place page. `base` is the canonical origin
// (https://fupit.com); `ogBase` is the live request origin so the OG image is
// fetched from the host the crawler actually hit (custom domain or .replit.app).
export function buildLocationSeo(
  place: ResolvedPlace,
  year: number,
  scenario: string,
  headline: LocationHeadline,
  base: string,
  ogBase: string = base,
): LocationSeo {
  const label = placeLabel(place);
  const scenarioLabel = SCENARIO_LABELS[scenario] ?? scenario;
  const canonical = `${base}/place/${place.slug}`;

  // Title — climate-twin hook when we have a defensible analog, else a grounded
  // warming headline. Never hype, always traceable.
  const title =
    headline.analog && headline.analogClose
      ? `${place.name} in ${year} may feel like ${headline.analog.name} today — fupit`
      : headline.warmingC !== null
        ? `${place.name} climate in ${year}: ${fmtWarming(headline.warmingC)} warming — fupit`
        : `${place.name} climate projection to ${year} — fupit`;

  // Description — stitched from grounded numbers only.
  const bits: string[] = [];
  if (headline.warmingC !== null) bits.push(`${fmtWarming(headline.warmingC)} average warming`);
  if (headline.seaApplicable && headline.seaLevelCm !== null) bits.push(`+${Math.round(headline.seaLevelCm)} cm sea-level rise`);
  if (headline.habitability !== null) {
    bits.push(`habitability ${headline.habitability}/100${headline.category ? ` (${headline.category})` : ""}`);
  }
  let description = `Grounded CMIP6/IPCC climate projection for ${label} in ${year} (${scenarioLabel}).`;
  if (bits.length) description += ` ${bits.join(", ")}.`;
  if (headline.analog) {
    description += ` Its projected climate is closest to present-day ${headline.analog.name}${headline.analog.country ? `, ${headline.analog.country}` : ""}.`;
  }

  // OG image — reuse the dynamic card endpoint with this location's params. The
  // endpoint recomputes the score from cache, so the URL cannot fake a number.
  const sp = new URLSearchParams();
  sp.set("place", label);
  sp.set("lat", String(place.lat));
  sp.set("lng", String(place.lng));
  sp.set("year", String(year));
  sp.set("scenario", scenario);
  const ogImageUrl = `${ogBase}/api/og?${sp.toString()}`;

  // JSON-LD Place + grounded climate summary (schema.org), so search engines and
  // AI answers can cite the projection. Only grounded values become properties.
  const properties: Array<{ "@type": "PropertyValue"; name: string; value: string; unitText?: string }> = [];
  if (headline.warmingC !== null) {
    properties.push({ "@type": "PropertyValue", name: `Projected average warming by ${year} (${scenarioLabel})`, value: fmtWarming(headline.warmingC) });
  }
  if (headline.seaApplicable && headline.seaLevelCm !== null) {
    properties.push({ "@type": "PropertyValue", name: `Projected regional sea-level rise by ${year}`, value: `+${Math.round(headline.seaLevelCm)} cm` });
  }
  if (headline.habitability !== null) {
    properties.push({ "@type": "PropertyValue", name: "Projected habitability score", value: `${headline.habitability}`, unitText: "0-100" });
  }
  if (headline.analog) {
    properties.push({ "@type": "PropertyValue", name: "Present-day climate analog", value: headline.analog.country ? `${headline.analog.name}, ${headline.analog.country}` : headline.analog.name });
  }
  const placeSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: label,
    url: canonical,
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
    description,
    isPartOf: { "@type": "WebSite", name: "fupit", url: `${base}/` },
  };
  if (properties.length) placeSchema.additionalProperty = properties;
  const jsonLd = JSON.stringify(placeSchema);

  // Crawlable body — real content on the first byte, before the SPA mounts.
  const li: string[] = [];
  if (headline.warmingC !== null) li.push(`<li>Average warming by ${year}: ${escapeHtml(fmtWarming(headline.warmingC))}</li>`);
  if (headline.seaApplicable && headline.seaLevelCm !== null) li.push(`<li>Regional sea-level rise by ${year}: +${Math.round(headline.seaLevelCm)} cm</li>`);
  if (headline.habitability !== null) li.push(`<li>Habitability score: ${headline.habitability} / 100${headline.category ? ` (${escapeHtml(headline.category)})` : ""}</li>`);
  if (headline.analog) li.push(`<li>Closest present-day climate analog: ${escapeHtml(headline.analog.name)}${headline.analog.country ? `, ${escapeHtml(headline.analog.country)}` : ""}</li>`);
  const bodyHtml = `<main aria-label="Climate projection for ${escapeHtml(label)}">
  <h1>${escapeHtml(title.replace(/ — fupit$/, ""))}</h1>
  <p>${escapeHtml(description)}</p>
  ${li.length ? `<ul>\n    ${li.join("\n    ")}\n  </ul>` : ""}
  <p>Numbers come from a grounded CMIP6/IPCC grid; see <a href="/methodology">the methodology</a>, <a href="/comparison">compare locations</a>, or return to <a href="/">fupit</a>.</p>
</main>`;

  // Client island — the SPA reads this synchronously on mount to resolve the
  // location without a round-trip, then runs the live forecast.
  const island = JSON.stringify({
    name: place.name,
    country: place.country,
    lat: place.lat,
    lng: place.lng,
    year,
    scenario,
    slug: place.slug,
    autoRun: true,
  });

  return { title, description, canonical, ogImageUrl, jsonLd, bodyHtml, island };
}

// Inject a location's head into the built (or dev) index.html. Mirrors the
// static-page injector in routes.ts: same regex swaps, plus self-referential
// hreflang and a JSON island for the client. base/ogBase realign absolute URLs.
export function injectLocationSeoHtml(template: string, seo: LocationSeo, base: string): string {
  const ogImageAttr = seo.ogImageUrl.replace(/&/g, "&amp;");
  const titleAttr = escapeHtml(seo.title);
  const descAttr = escapeHtml(seo.description);
  let html = template
    .split("https://global-geo-selector-mikkoparkkola.replit.app")
    .join(base)
    .split("https://climate-projections.replit.app")
    .join(base)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${titleAttr}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${descAttr}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${titleAttr}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${descAttr}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${seo.canonical}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${ogImageAttr}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${titleAttr}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${descAttr}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${ogImageAttr}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${seo.canonical}" />`)
    .replace(
      /<script type="application\/ld\+json" id="page-schema">[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="page-schema">${seo.jsonLd}</script>`,
    )
    .replace(/<div id="root"><\/div>/, `<div id="root">${seo.bodyHtml}</div>`);

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

  // Self-referential hreflang (English default) + the client place island,
  // injected just before </head>.
  const headExtra =
    `<link rel="alternate" hreflang="en" href="${seo.canonical}" />\n` +
    `    <link rel="alternate" hreflang="x-default" href="${seo.canonical}" />\n` +
    `    <script type="application/json" id="fupit-place">${seo.island.replace(/</g, "\\u003c")}</script>\n`;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `    ${headExtra}</head>`);
  }
  return html;
}
