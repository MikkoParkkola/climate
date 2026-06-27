# fupit climate projections

Public web app for exploring future climate and habitability projections for any location on Earth through 2100.

## Science rule

Every number served to users must trace to real CMIP6/IPCC model output or another documented authoritative dataset. Do not add heuristic coefficients, plausible-looking formulas, or fallback projections unless they are explicitly labeled and documented.

## Stack

- React 18 + Vite client in `client/`
- Express 5 + TypeScript server in `server/`
- PostgreSQL via Drizzle schema in `shared/schema.ts`
- Offline Python projection engine in `grounded_model.py`
- Compact grounded grid in `data/grid.i16.gz` with metadata in `data/manifest.json`
- WorldClim v2.1 observed baseline overlay in `data/worldclim10m.i16.gz`

## Common commands

```bash
npm run dev
npm run build
npm run start
npm run check
npm run verify:live
```

`DATABASE_URL` is required for the production server path because the API reads and writes `climate_model_cache`.
`npm run verify:live` checks the public deployment by default; set `FUPIT_BASE_URL=http://localhost:5000` for a local built server, `FUPIT_SKIP_TRAJECTORY=1` when that local server has no Postgres, or `FUPIT_REQUIRE_FRESH=1` with a new land coordinate to prove a post-purge forecast was generated instead of read from cache.

## Key docs

- `AGENTS.md` - contributor and agent operating guide
- `CONTRIBUTING.md` - contribution rules and validation checklist
- `docs/PLAN.md` - current delivery plan and handoff status
- `docs/PRODUCT_REQUIREMENTS.md` - educational/research product requirements and public-launch criteria
- `docs/VALIDATION_REPORT.md` - generated trajectory validation report and unresolved hindcast gap
- `docs/architecture/TECHNICAL_DESIGN.md` - Replit-scale serving architecture and performance targets
- `docs/architecture/SCIENTIFIC_GROUNDING.md` - source and method map
- `CODEX_HANDOVER.md` - latest operational handoff notes

## License

Code is released under the MIT License. Source datasets may have separate
licenses and attribution requirements; see `data/source-registry.json` and
`docs/architecture/SCIENTIFIC_GROUNDING.md` before redistributing derived data.
