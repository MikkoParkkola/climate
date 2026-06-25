---
name: SPA per-route SEO head injection
description: How this Vite SPA serves distinct per-route head tags to crawlers without SSR, and the constraints that make it work.
---

This app is a Vite SPA with one shared `client/index.html` shell, but `/` and `/comparison` need distinct crawler-visible `<title>`/description/OG/Twitter/canonical/JSON-LD. We cannot edit `server/vite.ts`/`vite.config.ts`.

Approach: register plain Express `app.get("/")` and `app.get("/comparison")` handlers inside `registerRoutes` that read the built `dist/public/index.html` and regex-rewrite the head tags per route.

**Why it works / why these constraints matter:**
- `registerRoutes` runs *before* `serveStatic` (and before Vite's dev catch-all) in `server/index.ts`, so route handlers registered there win over the static index serving and the SPA catch-all. Registration order is load-bearing.
- The handlers MUST be guarded by `app.get("env") !== "development"`. In dev, Vite owns the catch-all and transforms `index.html` for HMR; registering `app.get("/")` in dev would intercept the home route and break HMR.
- Absolute URLs (canonical/OG) are derived from `req.get("host")` at request time so custom domains and `.replit.app` both stay correct. The hardcoded `SEO_BASE` constant in `index.html` is only a dev/fallback default; the handler does `html.split(SEO_BASE).join(base)` to realign every absolute URL (including the site-wide JSON-LD `@graph`).
- Per-page JSON-LD is isolated with `id="page-schema"` so a single regex swaps only it, leaving the site-wide `@graph` untouched.

**How to apply:** If you add a new public route that should rank, add it to `SEO_PAGES` and register another guarded `app.get` in `registerRoutes`. Verify by building (`npm run build`) then replicating the transform against `dist/public/index.html` — running the prod server locally conflicts with the dev server on port 5000.
