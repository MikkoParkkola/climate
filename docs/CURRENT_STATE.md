# Current State - grounded baseline (2026-06-27)

A factual snapshot of what exists today, so plans build on truth instead of old README
aspirations or historical handoff notes.

## Headline

The fabricated legacy runner has been removed. The serving path now uses `grounded_model.py`,
an offline CMIP6/IPCC grid reader backed by compact artifacts in `data/`.

The app is locally validated with a production build and a Postgres-backed endpoint smoke.
Public Replit readiness is still an operational state to verify after republish and production
cache purge/version-guard proof.

## Grounded serving stack

- `grounded_model.py` reads `data/grid.i16.gz`, `data/manifest.json`, and the observed baseline
  artifacts with numpy/gzip only.
- `server/routes.ts` calls `grounded_model.py` for trajectory fills, serves precomputed ranking
  artifacts, exposes `GET /api/source-registry`, and returns 410 for retired legacy projection
  routes.
- `climate_model_cache` identity includes rounded coordinates, year, scenario, cache version, and
  source-registry version. Old unwrapped or mismatched rows are treated as misses and purged by
  the startup guard.
- `data/source-registry.json` is the source/license registry for served artifacts.
- `data/rankings.curated-cities.json` powers `/rankings` and `GET /api/climate/global-rankings`.
  It is a bounded curated-city ranking artifact, not a complete global city/country ranking.
- `client/public/climate-analog-catalog.current.json` powers the bounded climate-twin
  communication feature and is included in artifact validation.

## What is real and worth keeping

- React/Vite app shell, comparison flow, source/methodology pages, SEO/static handlers, and
  shareable UI scaffolding.
- The comparison flow has an explicit scenario selector and a sticky year slider that no longer
  reuses the single-location header offset.
- Express 5 API with request validation, rate limits, bounded Python concurrency for the launch
  bridge, and a durable Postgres response cache.
- Drizzle schema in `shared/schema.ts` as the database type source of truth.
- The cache-and-serve pattern, with stricter cache identity and version guards.
- Public methodology and source-trail direction: every visible number must map to a registered
  source and method, or be suppressed.
- Public repo hygiene now excludes tracked Replit mockup sandboxes and pasted local assets.

## API surface

Production-relevant surfaces include:

- `GET /api/health`
- `GET /api/source-registry`
- `POST /api/climate-trajectory`
- `POST /api/climate-projection`
- `GET /api/climate/global-rankings`
- `GET /methodology`
- `GET /rankings`
- `GET /data-quality`
- `GET /`, `GET /comparison`, and static SPA assets

Retired location-id legacy projection routes return 410 so they cannot serve old fabricated
payloads after deployment.

## Current local validation

Local validation on 2026-06-27:

- `npm run ci` passes.
- Production build passes.
- Postgres-backed local smoke proves `/api/climate-trajectory` returns the required Helsinki
  2050 contract for multiple scenarios with monthly arrays of length 12 and no nulls in required
  fields.
- Cache isolation proves the same coordinate/year stores separate `ssp245` and `ssp585` rows.
- `/methodology` renders from the built server.
- `/rankings` renders from the built server and the ranking API returns bounded top-10 rows with
  catalog caveats.
- `/data-quality` renders from the built server.
- `npm run validate:artifacts` verifies ranking slices, the current climate-twin analog catalog,
  registered source rows, and trajectory-audit coverage.
- `npm run smoke:comparison-layout` guards the comparison slider offset and scenario propagation.
- `npm run screenshots:capture` captures desktop/mobile PNG evidence for layered launch checks
  using local Chrome headless; use `--include-single` only on a host with `DATABASE_URL`.
- Legacy projection routes return HTTP 410.
- `LICENSE` and `CONTRIBUTING.md` are present.

## Remaining launch blockers

- Replit autoscale must be republished from the current code.
- Production `climate_model_cache` must be truncated, or live startup/version-guard proof must show
  all incompatible rows are rejected and removed.
- `npm run verify:live` and manual live smoke must pass against the public URL after republish.
- Browser screenshots should be captured against the live republished app for desktop/mobile home,
  single-location, comparison, rankings, methodology, and data-quality once the deployed build is current.

## Known future work

- Port the grid reader from Python to Node behind `CLIMATE_GRID_ENGINE=node` and keep Python as a
  fallback for one release after parity tests pass.
- Replace curated-city rankings with licensed population-center/country artifacts when catalog
  and license review are complete.
- Add freshwater, biodiversity, agriculture, fire-weather, infrastructure, and AMOC/context
  enrichments only after source/license registry approval.
- Publish a hindcast/validation report.
