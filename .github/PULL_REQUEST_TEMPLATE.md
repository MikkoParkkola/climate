## Summary

Describe the user-visible change and why it is needed.

## Science And Data Integrity

- [ ] No fabricated or unregistered climate values were introduced.
- [ ] New visible metrics, rankings, analogs, enrichments, or exported fields
      have source-registry coverage.
- [ ] Methodology, limitations, and missing-data behavior were updated when
      behavior changed.

## Validation

List the checks you ran:

```text
npm run check
npm run build
npm run audit:public
npm run ci
```

## Release Notes

Call out deployment, cache, migration, or source-artifact steps needed after
merge. If production cache behavior changes, state how stale rows are rejected or
purged.
