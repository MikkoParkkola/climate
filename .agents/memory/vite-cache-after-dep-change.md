---
name: stale Vite cache after dep change
description: "Invalid hook call / more than one copy of React" in the fupit dev frontend after a dependency change is usually a stale Vite pre-bundle, not a real React dup.
---

# Stale Vite cache after a dependency change

**Symptom:** after changing dependencies (e.g. merging a branch that swaps
`package-lock.json`, or a partial `npm install`), the dev frontend crashes with
`Warning: Invalid hook call ... more than one copy of React` and
`TypeError: Cannot read properties of null (reading 'useEffect')` inside
`QueryClientProvider` — even though `npm ls react react-dom` shows a single
deduped `react@18.3.1`.

**Cause:** stale Vite pre-bundle cache at `node_modules/.vite/deps` referencing an
old React chunk that no longer matches node_modules. It is NOT a real duplicate
React.

**Fix:** `rm -rf node_modules/.vite` then restart the "Start application"
workflow so Vite re-bundles. No code change needed.

**Why it matters here:** every GitHub pull on fupit/climate changes deps, so this
recurs after merges. Check `npm ls react` first to rule out a true dup, then clear
the cache.
