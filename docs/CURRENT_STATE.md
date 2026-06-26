# Current State — honest baseline (2026-06-26)

A factual snapshot of what exists today, so plans build on truth, not the README's aspirations. Update when reality changes.

## The headline: the "model" is not a model

`cbottle_runner.py` (2,053 LOC) is named after NVIDIA's cBottle climate model and its comments cite "CBottle atmospheric physics" and "IPCC AR6" — but it contains **none of that**. It is a deterministic heuristic built from ~20 hand-picked constants.

Evidence (`cbottle_runner.py`):

```python
# calculate_temperature_anomaly()  (line ~505)
acceleration_factor = 1 + (years_ahead / 50.0) * 0.3   # invented "30% over 50y"
if not is_coastal(latitude, longitude):
    base_warming_rate *= 1.3                            # invented "continental x1.3"
return base_warming_rate * acceleration_factor * (years_ahead / 10.0)

# get_regional_warming_rate()  — labeled "based on IPCC AR6", actually magic numbers
if abs_lat > 60: return 0.4    # Arctic

# calculate_precipitation_anomaly()  — hardcoded +/- 1-2% per decade by latitude band
```

Confirmed by inspection:
- **No** `torch`, `onnx`, Earth2Studio, NVIDIA API call, model weights, or diffusion code. Imports are only `sys, json, os, numpy, xarray, datetime, traceback`.
- The single outbound call is a NOAA weather-station lookup for the present-day baseline (`https://www.ncdc.noaa.gov/cdo-web/api/v2/stations`).
- The docstring admits it: *"Since Earth2Studio requires local installation and model weights, this implements the core climate downscaling logic."*

**Implication:** every projection currently served is fabricated and labeled as science. This is the central problem the new plan fixes. Until then, treat all served climate numbers as untrustworthy.

## What IS real and worth keeping

- **App shell & UX**: React SPA, comparison, global rankings, sea-level map, CSV/PDF export, Leaflet maps — solid, reusable.
- **Serving infrastructure**: rate limiting, bounded Python concurrency + queue, and `climate_model_cache` (rounded lat/lng/year grid, lossless JSON). The **cache-and-serve pattern is exactly right** for the real plan; only the thing producing the cached values changes.
- **DB schema** (`shared/schema.ts`): tables for locations, projections, comparisons, model cache, users. Field set is reasonable; may need additions (scenario id, uncertainty bounds, provenance).
- **SEO/SPA head injection**, security guardrails, and the project-local memory notes.

## API surface (server/routes.ts, 1,703 LOC)

`/api/locations/search`, `/api/climate-projection`, `/api/climate-trajectory`, `/api/climate/global-rankings`, `/api/projections/*`, `/api/user/keys`, `/api/user/comparisons`, `/api/export/csv/*`, `/api/climate/export-comparison`, plus prod-only `/` and `/comparison` SEO handlers.

## Drift / cleanup

- `threat_model.md` cites `server/routes-simple.ts` as production — file does not exist; live routes are `server/routes.ts`. Stale.
- `conflict_area.txt` (root, ~7KB) — leftover merge-conflict artifact.
- README absent at repo root.
- **`npm run check` (tsc) does NOT pass on a clean checkout** — pre-existing, not introduced by current work. Errors are confined to **unrouted orphan pages** and loose types: `climate-dashboard.tsx` / `comprehensive-climate-report.tsx` / `enhanced-climate-dashboard.tsx` import a non-existent `@/components/habitability-ranking` (the real file is `habitability-ranking-refactored.tsx`); `sea-level-map.tsx` imports missing `react-leaflet`; `multi-location-comparison.tsx` + `api-key-manager.tsx` use loose `{}` types; `server/routes.ts:264` Date→string; `server/vite.ts:50` ServerOptions. **`npm run build` (Vite) is green** because only `/` and `/comparison` (→ `climate-app`, `climate-comparison`) reach the bundle. Treat build as the ship gate until tsc is cleaned up (own ticket; likely Phase 6).

