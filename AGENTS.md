# AGENTS.md — Working guide for AI agents (and humans) on `climate`

> This is the **canonical** agent/contributor guide. `CLAUDE.md` and `LLM.md` are symlinks to this file. Keep it current; it is the first thing any agent should read.

## What this project is

`climate` (brand: **fupit**, formerly ClimateVision) is a public web app for exploring **future climate conditions and habitability for any location on Earth, out to year 2100**. Users pick a place, see projected temperature, precipitation, sea level, risk indices, habitability score, and compare locations or view global rankings.

- **Repo:** `github.com/MikkoParkkola/climate` · **Dir:** `~/github/climate`
- **Deploy:** Replit autoscale (Node serves the built SPA + API; Python model invoked as a subprocess).

## ⛔ THE CARDINAL RULE: no fabricated science

This product's entire value is **accuracy grounded in real climate science**. Every number served to a user must trace to a defensible source: real model output (cBottle), IPCC AR6 scenario data, or a peer-reviewed / authoritative public dataset.

**Never** invent coefficients, "plausible-looking" formulas, or hardcoded warming rates and present them as a model. The legacy `cbottle_runner.py` does exactly this (see `docs/CURRENT_STATE.md`) — it is **not** cBottle and is being replaced. Do not extend it; replace it per `docs/PLAN.md`.

If you cannot ground a value, the correct behavior is to **not show it** (or show it explicitly labeled as an estimate with stated method and uncertainty). Silence beats a confident lie. This maps to Rams #6 (Honest — no overclaim).

## Tech stack (verified)

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 6, Wouter (routing), TanStack Query, Radix UI + Tailwind (shadcn-style), Leaflet, Chart.js / Recharts, Framer Motion |
| Backend | Express **5** + TypeScript (`tsx` dev, `esbuild` prod bundle) |
| DB | PostgreSQL via Drizzle ORM (`@neondatabase/serverless`) — schema in `shared/schema.ts` |
| Model | Python (`cbottle_runner.py`) spawned as subprocess — **being replaced by real cBottle, see plan** |
| Other | `@octokit/rest` (GitHub-repo tool) |

## Layout

```
client/          React SPA (pages/, components/, components/ui/, lib/, hooks/)
server/          Express: index.ts (entry), routes.ts (API + SEO), storage.ts, db.ts, vite.ts
shared/          schema.ts — Drizzle tables + Zod insert schemas (single source of truth for DB types)
cbottle_runner.py  legacy heuristic "model" (to be replaced)
docs/            plans + architecture (this is the persistence layer — read before large changes)
.agents/memory/  project-local gotcha notes (read these; they cost real time to learn)
artifacts/       mockup sandbox — NOT production
```

## Commands

```bash
npm run dev      # NODE_ENV=development, tsx server/index.ts, port 5000 (Vite dev + HMR)
npm run build    # vite build + esbuild bundles server -> dist/
npm run start    # NODE_ENV=production node dist/index.js
npm run check    # tsc typecheck
npm run db:push  # drizzle-kit push (apply schema to DB)
```

## Load-bearing gotchas (from `.agents/memory/` — ignore at your peril)

1. **SPA per-route SEO** — `/` and `/comparison` get crawler-visible `<head>` tags by regex-rewriting the built `dist/public/index.html` in **prod-only** Express handlers registered in `registerRoutes` **before** `serveStatic`. Registration order is load-bearing. The dev branch hand-builds HTML and **must** include the Vite `@react-refresh` preamble + `/@vite/client` before the entry module, or React silently won't mount (cost ~half a day once). See `.agents/memory/spa-seo-injection.md`.
2. **Express 5 wildcards** — `app.use("*")` must be `app.use("/{*any}")` (path-to-regexp 8.x) or the server crashes at startup. See `.agents/memory/express5-vite-wildcards.md`.
3. **Heavy-model e2e times out** — the model is slow + rate-limited. A full browser end-to-end run blows the 10-min sandbox cap. **Verify in layers**: endpoint JSON asserts + `npm run build` + screenshot — never one giant e2e. See `.agents/memory/e2e-real-model-timeout.md`.

## Operational guardrails (already in `server/routes.ts`)

- Rate limit: 10 requests / minute / IP on model endpoints.
- Python concurrency: max 2 concurrent processes, 60s timeout, queued waiters.
- Model output cached in `climate_model_cache` (rounded lat/lng/year grid, lossless full JSON). Caching is central to the product — see plan.

## Conventions

- **Types flow from `shared/schema.ts`** (Drizzle + drizzle-zod). Don't redefine DB shapes elsewhere.
- Validate every request body/param with Zod server-side — the browser is untrusted (`threat_model.md`).
- Never log or return secrets (NVIDIA / user API keys, DB creds).
- Never concatenate user input into shell/process commands feeding the Python runner.
- Prefer `Edit` over rewrite; keep diffs small.

## Memory & persistence

- Durable project memory lives in **hebb** under project namespace `climate` (not `fupit` — brand may change again). Write decisions/gotchas there as you learn them.
- **Plans and architecture live in `docs/`** — this is the human+agent-readable persistence layer. Update the relevant doc in the same change that alters reality. A plan that lies is worse than no plan.

## Known drift to reconcile

- `threat_model.md` references `server/routes-simple.ts` as the production routes file — that file **does not exist**; live routes are `server/routes.ts`. Threat model is stale.
- `conflict_area.txt` (root) is a leftover merge artifact — safe to delete once confirmed.
