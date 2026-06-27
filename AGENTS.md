# AGENTS.md — Working guide for AI agents (and humans) on `climate`

> This is the **canonical** agent/contributor guide. `CLAUDE.md` and `LLM.md` are symlinks to this file. Keep it current; it is the first thing any agent should read.

> **STATUS (2026-06-27):** Grounded engine landed. `grounded_model.py` (CMIP6/IPCC, offline, reads `data/grid.i16.gz` with numpy+gzip) has **replaced** the fabricated legacy runner in `server/routes.ts`; build and local Postgres-backed endpoint smoke are green. `/methodology`, source registry, versioned cache identity, and precomputed curated-city rankings are live in code. **To finish public launch, follow `docs/PLAN.md` -> "Phase 4 handoff".** Blocking items: Replit autoscale republish, production `climate_model_cache` purge/version-guard proof, and live verification. cBottle decision (not for accuracy): `docs/architecture/RESOLUTION_AND_CBOTTLE.md`.

## What this project is

`climate` (brand: **fupit**, formerly ClimateVision) is a public web app for exploring **future climate conditions and habitability for any location on Earth, out to year 2100**. Users pick a place, see projected temperature, precipitation, sea level, risk indices, habitability score, and compare locations or view global rankings.

- **Repo:** `github.com/MikkoParkkola/climate` · **Dir:** `~/github/climate`
- **Deploy:** Replit autoscale (Node serves the built SPA + API; Python model invoked as a subprocess).

## ⛔ THE CARDINAL RULE: no fabricated science

This product's entire value is **accuracy grounded in real climate science**. Every number served to a user must trace to a defensible source: real model output (cBottle), IPCC AR6 scenario data, or a peer-reviewed / authoritative public dataset.

**Never** invent coefficients, "plausible-looking" formulas, or hardcoded warming rates and present them as a model. The deleted legacy runner did exactly this (see `docs/CURRENT_STATE.md`) — it was **not** cBottle and must not be revived. If a value is not grounded, do not show it.

If you cannot ground a value, the correct behavior is to **not show it** (or show it explicitly labeled as an estimate with stated method and uncertainty). Silence beats a confident lie. This maps to Rams #6 (Honest — no overclaim).

## Tech stack (verified)

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 6, Wouter (routing), TanStack Query, Radix UI + Tailwind (shadcn-style), Leaflet, Chart.js / Recharts, Framer Motion |
| Backend | Express **5** + TypeScript (`tsx` dev, `esbuild` prod bundle) |
| DB | PostgreSQL via Drizzle ORM (`@neondatabase/serverless`) — schema in `shared/schema.ts` |
| Model | Python (`grounded_model.py`) spawned as subprocess; offline CMIP6/IPCC grid reader |
| Other | `@octokit/rest` (GitHub-repo tool) |

## Layout

```
client/          React SPA (pages/, components/, components/ui/, lib/, hooks/)
server/          Express: index.ts (entry), routes.ts (API + SEO), storage.ts, db.ts, vite.ts
shared/          schema.ts — Drizzle tables + Zod insert schemas (single source of truth for DB types)
grounded_model.py  grounded offline forecast engine (reads data/grid.i16.gz + data/manifest.json)
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

- Public Replit state can lag behind Git. Treat the deployed site as unknown until `/api/health`, `/methodology`, `/api/climate-trajectory`, and retired legacy routes are verified live after republish.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **climate** (3854 symbols, 6480 relationships, 168 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/climate/context` | Codebase overview, check index freshness |
| `gitnexus://repo/climate/clusters` | All functional areas |
| `gitnexus://repo/climate/processes` | All execution flows |
| `gitnexus://repo/climate/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
