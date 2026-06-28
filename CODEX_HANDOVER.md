# CODEX HANDOVER - fupit grounded serving

**Updated:** 2026-06-28.

This file is an operational handoff for agents working on the `climate` repo. Historical
fabricated-engine notes were collapsed into `docs/CURRENT_STATE.md` and `docs/PLAN.md`; treat this
file as the current handoff only.

## Current status

- Grounded engine is in code: `grounded_model.py` reads compact CMIP6/IPCC artifacts in `data/`
  and emits the existing React JSON contract.
- The fabricated legacy runner has been removed.
- Legacy location-id projection routes return HTTP 410.
- Cache rows are versioned by scenario, cache version, and source-registry version.
- A source registry artifact exists at `data/source-registry.json`.
- Curated-city and Natural Earth population-place rankings are served from static artifacts, not live Python loops.
- Local production-style validation passes with a throwaway Postgres database.

## Local validation already proven

Run from `/Users/mikko/github/climate`:

```bash
npm run ci
```

The current local validation covers:

- TypeScript check.
- Artifact validation before build.
- Production build.
- Cache envelope smoke.
- Ranking artifact smoke, including the Natural Earth population-place catalog.
- Five-city grounded model smoke.
- Annual trajectory audit.

Additional Postgres-backed local smoke has proven:

- `GET /api/health` returns the expected engine/cache/source-registry metadata.
- `GET /api/source-registry` returns registry version `source-registry-v1`.
- `GET /api/climate/global-rankings` returns curated and Natural Earth population-place rankings
  for supported metric/year/scenario slices and 404s unsupported slices.
- `POST /api/climate-trajectory` for Helsinki 2050 works for `ssp245` and `ssp585`.
- Repeated `ssp245` smoke returns a cache hit while `ssp585` remains a separate cache row.
- Invalid year/scenario requests return 400.
- `/methodology` renders from the built server.
- Retired legacy projection routes return 410.

## Still externally blocked

These require live Replit/prod database access:

1. Republish the Replit Autoscale deployment from the current branch/main.
2. In the production Replit shell, confirm the cache purge target:

```bash
npm run db:purge-model-cache:dry-run
```

3. Immediately after republish, purge old fabricated cache rows from production Postgres:

```bash
FUPIT_CONFIRM_CACHE_PURGE=TRUNCATE_CLIMATE_MODEL_CACHE npm run db:purge-model-cache
```

Do not use raw SQL unless the guarded script cannot run. If raw SQL is required, execute only
`TRUNCATE climate_model_cache;` against production Postgres and record the row count before and
after. The guarded script is preferred because it fails closed when `DATABASE_URL` is missing and
requires the explicit confirmation token above.

4. Run `npm run verify:live` against the public URL:

```bash
FUPIT_REQUIRE_FRESH=1 npm run verify:live
```

5. Capture layered screenshot evidence:

```bash
npm run screenshots:capture -- --base https://fupit.com --include-single --out artifacts/release-screenshots
```

6. Manually smoke:

```bash
curl -s https://fupit.com/api/health | python3 -m json.tool
curl -s -XPOST https://fupit.com/api/climate-trajectory \
  -H 'content-type: application/json' \
  -d '{"coordinates":{"lat":60.17,"lng":24.94},"years":[2050],"scenario":"ssp245"}' \
  | python3 -m json.tool | head -80
```

The first post-purge smoke should use a fresh land coordinate plus `FUPIT_REQUIRE_FRESH=1` when
running `npm run verify:live`, so cache state cannot hide stale deployment behavior.

## Do not regress

- No fabricated climate values.
- No `cbottle_runner.py` resurrection.
- Express 5 catch-all paths must use `/{*any}`, not `*`.
- Do not run a full browser e2e against the real model; verify in layers: API JSON, build, and
  screenshots.
- Fixed catalogs are allowed only for bounded features such as rankings, examples, and climate
  twins. Any-location forecasts must not depend on a city list.
- No enrichment or ranking metric may ship without a source-registry row and license/method review.
