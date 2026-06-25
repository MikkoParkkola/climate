---
name: Real-model e2e timeouts
description: Why heavy end-to-end runs against the live climate model time out, and the verification strategy that works instead.
---

The climate features call a slow, rate-limited model (~seconds per run, 10 req/min/IP, max 2 concurrent Python procs → 503 when exceeded). Driving a full browser e2e (the testing skill's `runTest`) through code_execution against these flows overruns the code_execution sandbox's hard 10-minute cap — not because the test fails, but because per-step subagent overhead plus model waits exceed the budget.

**Why:** the timeout is the sandbox limit, not a product bug. Re-running the same heavy e2e just burns another 10 minutes.

**How to apply:** verify in layers instead of one giant e2e —
- data/interpolation correctness: call the live endpoint from code_execution and assert on the JSON (checkpoint fidelity, no NaN, array lengths, sums).
- build/compile correctness: `npm run build` (also compiles the bundled server).
- SEO/head-injection: replicate the transform in a small node script against `dist/public/index.html`.
- runtime render: `screenshot` the routes.
If a real browser e2e is truly needed, keep the plan minimal (few steps, one short wait) or run it outside the code_execution sandbox.
