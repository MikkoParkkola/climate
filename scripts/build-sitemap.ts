// Generate the public sitemap from the location corpus. Replaces the old
// hand-maintained 5-URL sitemap with one covering every catalog city's
// `/place/<slug>` page plus the static routes. Scales to a sitemap index +
// chunked sitemaps if the corpus ever grows past SITEMAP_CHUNK URLs.
//
// Run via tsx (it imports the TS location catalog so the slug scheme stays the
// single source of truth shared with the server resolver). Wired into `build`
// BEFORE `vite build`, so the generated files in client/public are copied into
// dist/public by Vite.
import fs from "fs";
import path from "path";
import { listCatalogLocations } from "../server/location-catalog";

const SEO_BASE = (process.env.CLIMATE_SEO_BASE || "https://fupit.com").replace(/\/+$/, "");
const SITEMAP_CHUNK = 5000; // safely under the 50k-URL sitemap limit
const OUT_DIR = path.resolve(import.meta.dirname, "..", "client", "public");

type UrlEntry = { loc: string; changefreq: string; priority: string };

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const staticRoutes: UrlEntry[] = [
  { loc: `${SEO_BASE}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${SEO_BASE}/comparison`, changefreq: "weekly", priority: "0.8" },
  { loc: `${SEO_BASE}/rankings`, changefreq: "weekly", priority: "0.7" },
  { loc: `${SEO_BASE}/methodology`, changefreq: "monthly", priority: "0.9" },
  { loc: `${SEO_BASE}/data-quality`, changefreq: "monthly", priority: "0.8" },
];

const placeRoutes: UrlEntry[] = listCatalogLocations().map((loc) => ({
  loc: `${SEO_BASE}/place/${loc.slug}`,
  changefreq: "monthly",
  priority: "0.6",
}));

const all: UrlEntry[] = [...staticRoutes, ...placeRoutes];

function urlset(entries: UrlEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function write(file: string, contents: string): void {
  fs.writeFileSync(path.join(OUT_DIR, file), contents);
}

// Clean any prior chunk files so a shrinking corpus never leaves stale shards.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (/^sitemap-\d+\.xml$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
}

if (all.length <= SITEMAP_CHUNK) {
  write("sitemap.xml", urlset(all));
  console.log(`build-sitemap OK — sitemap.xml: ${all.length} URLs (${staticRoutes.length} static + ${placeRoutes.length} places)`);
} else {
  const chunks: UrlEntry[][] = [];
  for (let i = 0; i < all.length; i += SITEMAP_CHUNK) chunks.push(all.slice(i, i + SITEMAP_CHUNK));
  chunks.forEach((chunk, i) => write(`sitemap-${i + 1}.xml`, urlset(chunk)));
  const index =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    chunks.map((_, i) => `  <sitemap>\n    <loc>${SEO_BASE}/sitemap-${i + 1}.xml</loc>\n  </sitemap>`).join("\n") +
    `\n</sitemapindex>\n`;
  write("sitemap.xml", index);
  console.log(`build-sitemap OK — sitemap index of ${chunks.length} chunks, ${all.length} URLs total`);
}
