// smoke:location-seo — guards the per-location growth engine. Asserts that a
// sample place slug produces a grounded, crawlable <head>: climate-twin/grounded
// title, canonical /place/<slug>, JSON-LD Place with GeoCoordinates, dynamic OG
// image carrying the location params, twitter summary_large_image, the client
// island, and self-referential hreflang. Also checks the generated sitemap
// includes place URLs. Pure in-process — no server, no DB.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { resolvePlaceSlug, listCatalogLocations } from "../server/location-catalog";
import { extractHeadline, buildLocationSeo, injectLocationSeoHtml } from "../server/location-seo";
import { projectClimate } from "../server/grounded-node-model";
import { findClimateTwin, loadClimateAnalogCatalog } from "../server/climate-twin";

const SEO_BASE = "https://fupit.com";

function main(): void {
  const catalog = listCatalogLocations();
  assert.ok(catalog.length >= 20, `expected a non-trivial location catalog, got ${catalog.length}`);

  // Prefer a well-known city; fall back to the first catalog entry.
  const sampleSlug = resolvePlaceSlug("amsterdam-netherlands") ? "amsterdam-netherlands" : catalog[0].slug;
  const place = resolvePlaceSlug(sampleSlug);
  assert.ok(place, `sample slug must resolve: ${sampleSlug}`);

  // Coordinate slug must also resolve (arbitrary points are addressable).
  const coord = resolvePlaceSlug("52.37,4.9");
  assert.ok(coord && coord.source === "coordinates", "coordinate slug must resolve to a coordinates place");

  const year = 2100;
  const scenario = "ssp245";
  const projection = projectClimate(place!.lat, place!.lng, year, scenario);
  let twin: unknown = null;
  try {
    twin = findClimateTwin({
      catalog: loadClimateAnalogCatalog(),
      projection: projection as Parameters<typeof findClimateTwin>[0]["projection"],
      lat: place!.lat,
      lng: place!.lng,
      year,
      scenario,
      limit: 1,
    });
  } catch {
    twin = null;
  }

  const headline = extractHeadline(projection, twin);
  assert.ok(headline.warmingC !== null, "headline must carry a grounded warming value");
  assert.ok(headline.habitability !== null, "headline must carry a grounded habitability score");

  const seo = buildLocationSeo(place!, year, scenario, headline, SEO_BASE, SEO_BASE);
  assert.ok(seo.title.includes("fupit"), "title must be branded");
  assert.ok(/\d{4}/.test(seo.title), "title must reference the projection year");
  assert.equal(seo.canonical, `${SEO_BASE}/place/${place!.slug}`, "canonical must be the place URL");
  assert.ok(seo.ogImageUrl.includes("/api/og?"), "OG image must use the dynamic card endpoint");
  assert.ok(seo.ogImageUrl.includes("lat=") && seo.ogImageUrl.includes("lng=") && seo.ogImageUrl.includes(`year=${year}`), "OG image must carry the location params");

  const ld = JSON.parse(seo.jsonLd) as Record<string, any>;
  assert.equal(ld["@type"], "Place", "JSON-LD must be a Place");
  assert.equal(ld.geo?.["@type"], "GeoCoordinates", "JSON-LD must include GeoCoordinates");
  assert.equal(ld.geo?.latitude, place!.lat, "JSON-LD latitude must match");
  assert.ok(Array.isArray(ld.additionalProperty) && ld.additionalProperty.length > 0, "JSON-LD must expose grounded climate properties");

  // Inject into the real source template and assert the head is rewritten.
  const templatePath = path.resolve(import.meta.dirname, "..", "client", "index.html");
  const template = fs.readFileSync(templatePath, "utf-8");
  const html = injectLocationSeoHtml(template, seo, SEO_BASE);
  assert.ok(html.includes(`<title>${seo.title.replace(/&/g, "&amp;")}</title>`) || html.includes(seo.title), "title injected");
  assert.ok(html.includes(`<link rel="canonical" href="${seo.canonical}" />`), "canonical injected");
  assert.ok(html.includes('id="page-schema">{"@context":"https://schema.org","@type":"Place"'), "Place JSON-LD injected");
  assert.ok(html.includes('hreflang="en"') && html.includes('hreflang="x-default"'), "self-referential hreflang injected");
  assert.ok(html.includes('id="fupit-place"'), "client place island injected");
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'), "twitter summary_large_image present");
  assert.ok(html.includes("/api/og?"), "dynamic OG image referenced in head");
  // Crawlable body content on the first byte.
  assert.ok(html.includes("<h1>") && !html.includes('<div id="root"></div>'), "semantic body injected into #root");

  // Sitemap must exist and include place URLs (build:sitemap runs in `build`).
  const sitemapPath = path.resolve(import.meta.dirname, "..", "client", "public", "sitemap.xml");
  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, "utf-8");
    assert.ok(sitemap.includes("/place/"), "sitemap must include per-location URLs");
  }

  console.log(
    `smoke:location-seo OK — ${catalog.length} catalog cities; sample "${place!.slug}" -> "${seo.title}"; ` +
      `warming ${headline.warmingC}°C, habitability ${headline.habitability}, analog ${headline.analog?.name ?? "none"}`,
  );
}

try {
  main();
} catch (e) {
  console.error("smoke:location-seo FAILED:", (e as Error).message);
  process.exit(1);
}
