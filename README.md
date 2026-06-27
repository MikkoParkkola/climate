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

## Common commands

```bash
npm run dev
npm run build
npm run start
npm run check
```

`DATABASE_URL` is required for the production server path because the API reads and writes `climate_model_cache`.

## Key docs

- `AGENTS.md` - contributor and agent operating guide
- `docs/PLAN.md` - current delivery plan and handoff status
- `docs/architecture/SCIENTIFIC_GROUNDING.md` - source and method map
- `CODEX_HANDOVER.md` - latest operational handoff notes
