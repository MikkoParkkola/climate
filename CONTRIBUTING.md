# Contributing

fupit welcomes contributions that improve public climate understanding without
weakening scientific traceability.

## Non-negotiable Rule

Do not add climate numbers, risk scores, ranking dimensions, analogs, or
enrichments unless every visible value maps to a registered source and a
documented method. If a field is not grounded, suppress it or mark it unavailable
with a clear reason.

## Before Changing Code

1. Read `docs/PRODUCT_REQUIREMENTS.md` for the product scope and launch criteria.
2. Check `docs/architecture/SCIENTIFIC_GROUNDING.md` for the relevant source
   and method.
3. Keep changes scoped. Do not mix science, UI, deployment, and cleanup changes
   unless the change requires it.
4. Do not commit local screenshots, generated scratch files, Replit pasted
   artifacts, or private deployment material.

## Validation

Run the smallest relevant check while developing, then run the canonical local
suite before handoff:

```bash
npm run check
npm run build
npm run audit:public
npm run smoke:comparison-layout
npm run validate:artifacts
npm run ci
```

For live release verification, run `npm run verify:live` against the deployed
URL after Replit is republished and production cache state is proven safe.

## Data And Sources

New datasets need a source-registry row before they can appear in UI, API
responses, rankings, exports, or share cards. The row must document provider,
version, citation, license, reuse limits, resolution, variables, transformation
method, uncertainty handling, and missing-data behavior.

## Pull Request Checklist

- [ ] No fabricated or unregistered climate values were introduced.
- [ ] API responses include scenario, method/cache version, and source receipt
      where applicable.
- [ ] Cache keys or cache guards prevent wrong-scenario and stale-version reuse.
- [ ] UI copy avoids "safe city", "climate haven", and broad winner/loser claims.
- [ ] Tests or smoke scripts cover the changed behavior.
- [ ] Public docs were updated if behavior, methodology, or launch status changed.
