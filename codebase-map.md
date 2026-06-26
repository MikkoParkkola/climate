---
generated: 2026-06-26T23:10:11Z
skill: codebase-map v0.1
git-commit: a451363
---

# Codebase Map

Auto-generated table of contents for `climate/`. Scan before opening files. Regenerate via `/codebase-map`.

| Folder | Description |
| ------ | ----------- |
| `client/` | React 18 + Vite SPA. Pages (climate-app, comparison, methodology), components, Leaflet map, charts. |
| `server/` | Express 5 + TypeScript API. `routes.ts` (endpoints + SEO + grounded_model spawn), `storage.ts` (cache/DB), `vite.ts` (dev/prod serving). |
| `shared/` | `schema.ts` — Drizzle tables + Zod schemas. Single source of truth for DB types. |
| `ingest/` | Offline pipeline (runs on Spark): fetch CMIP6/AR6/sea-level/ETCCDI → reduce → `build_export.py` packs the compact grid. NOT in the request path. |
| `data/` | Runtime serving data the app reads: the compact grid export (`grid.i16.gz` + `manifest.json`, added at deploy) and `ranking_cities.json`. |
| `docs/` | Persistence layer for plans + architecture. `PLAN.md` (phases + handoff), `architecture/` (ARCHITECTURE, SCIENTIFIC_GROUNDING, RESOLUTION_AND_CBOTTLE). Read before large changes. |
| `scripts/` | Git/build helper scripts (e.g. `post-merge.sh`). |
| `artifacts/` | Mockup sandbox — NOT production. |
| `attached_assets/` | Screenshots and reference images. |
