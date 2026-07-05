import assert from "node:assert/strict";
import {
  RATE_LIMIT_BURST,
  PROJECTION_LRU_MAX,
  checkRateLimit,
  __resetRateLimiter,
  lruGet,
  lruSet,
  lruSize,
  projectionCacheKey,
  __resetProjectionCache,
} from "../server/runtime-cache";

// ── Token-bucket rate limiter ────────────────────────────────────────────────
__resetRateLimiter();
const ip = "203.0.113.7";
const t0 = 1_000_000;

// A full burst is allowed back-to-back at a fixed instant.
for (let i = 0; i < RATE_LIMIT_BURST; i++) {
  assert.equal(checkRateLimit(ip, t0), true, `burst token ${i + 1} should be allowed`);
}
// One past the burst, with no time elapsed, is rejected.
assert.equal(checkRateLimit(ip, t0), false, "request past burst with no refill must be rejected");

// After 1s the bucket refills 2 tokens (120/min), so a couple more get through.
assert.equal(checkRateLimit(ip, t0 + 1_000), true, "first refilled token after 1s");
assert.equal(checkRateLimit(ip, t0 + 1_000), true, "second refilled token after 1s");
assert.equal(checkRateLimit(ip, t0 + 1_000), false, "third request exceeds 1s refill");

// Distinct IPs have independent buckets.
assert.equal(checkRateLimit("198.51.100.9", t0), true, "fresh IP gets its own burst");

// A long idle window refills back to the full burst (no overflow beyond burst).
assert.equal(checkRateLimit(ip, t0 + 3_600_000), true, "token available after long idle");

// ── LRU projection cache ─────────────────────────────────────────────────────
__resetProjectionCache();

// Key includes MODEL_CACHE_VERSION so a version bump invalidates entries.
const k = projectionCacheKey(60.17, 24.94, 2050, "ssp245");
assert.ok(k.includes("60.17") && k.includes("ssp245"), "cache key encodes location + scenario");

assert.equal(lruGet(k), undefined, "cold cache misses");
lruSet(k, { score: 42 });
assert.deepEqual(lruGet(k), { score: 42 }, "warm cache returns stored value");

// undefined is never stored (would be indistinguishable from a miss).
lruSet("ignore-me", undefined);
assert.equal(lruGet("ignore-me"), undefined, "undefined is not cached");

// Bounded: inserting past the cap evicts the oldest and never exceeds the cap.
__resetProjectionCache();
for (let i = 0; i < PROJECTION_LRU_MAX + 25; i++) {
  lruSet(`key-${i}`, i);
}
assert.equal(lruSize(), PROJECTION_LRU_MAX, "LRU size is capped");
assert.equal(lruGet("key-0"), undefined, "oldest entry evicted past cap");
assert.equal(lruGet(`key-${PROJECTION_LRU_MAX + 24}`), PROJECTION_LRU_MAX + 24, "newest entry retained");

console.log("runtime-cache smoke passed (token-bucket + bounded LRU)");
