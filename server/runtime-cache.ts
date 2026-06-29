// In-process runtime caches for viral-scale serving of the deterministic,
// immutable grounded-grid forecast. Two independent concerns live here:
//
//   1. A per-IP token-bucket rate limiter — replaces the legacy 10/min fixed
//      window that guarded the now-removed Python subprocess. The in-process
//      Node grid engine projects a trajectory in ~1 ms, so the cap exists only
//      to blunt abuse, not to protect a slow worker. Burst + steady refill lets
//      a real user (and any CDN-missed page load) sail through while a scripted
//      flood still hits a ceiling.
//
//   2. An LRU cache of grounded projections keyed by
//      (latKey, lngKey, year, scenario, MODEL_CACHE_VERSION). It sits in front
//      of Postgres so hot locations never pay the DB round-trip. The model
//      version is baked into the key, so a model bump silently invalidates every
//      entry (old keys are simply never read again and age out).
//
// Both structures are bounded so a viral spike across many distinct IPs or
// locations cannot grow memory without limit.

import { MODEL_CACHE_VERSION } from "./model-cache-version";

// ── Token-bucket rate limiter ────────────────────────────────────────────────
// Tunables are named constants so the policy is auditable in one place.
export const RATE_LIMIT_BURST = 60; // tokens available immediately per IP
export const RATE_LIMIT_REFILL_PER_MIN = 120; // tokens replenished per minute per IP
// Cap on tracked IPs so a flood of distinct source addresses cannot grow the map
// without bound; idle (fully refilled) buckets are pruned first.
export const RATE_LIMIT_MAX_TRACKED_IPS = 50_000;

const REFILL_PER_MS = RATE_LIMIT_REFILL_PER_MIN / 60_000;

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

function pruneBuckets(now: number): void {
  // Drop fully-refilled (idle) buckets first — they carry no state worth keeping.
  const idle: string[] = [];
  buckets.forEach((b, ip) => {
    const refilled = Math.min(RATE_LIMIT_BURST, b.tokens + (now - b.updatedAt) * REFILL_PER_MS);
    if (refilled >= RATE_LIMIT_BURST) idle.push(ip);
  });
  for (const ip of idle) {
    if (buckets.size <= RATE_LIMIT_MAX_TRACKED_IPS) return;
    buckets.delete(ip);
  }
  // Still over the cap (all buckets active): evict oldest-touched until under.
  while (buckets.size > RATE_LIMIT_MAX_TRACKED_IPS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

// Returns true if the request is allowed (a token was consumed), false if the
// bucket is empty and the request should be rejected (HTTP 429).
export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  let bucket = buckets.get(ip);
  if (!bucket) {
    if (buckets.size >= RATE_LIMIT_MAX_TRACKED_IPS) pruneBuckets(now);
    bucket = { tokens: RATE_LIMIT_BURST, updatedAt: now };
    buckets.set(ip, bucket);
  } else {
    const elapsed = now - bucket.updatedAt;
    if (elapsed > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_BURST, bucket.tokens + elapsed * REFILL_PER_MS);
      bucket.updatedAt = now;
    }
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

// Test/diagnostic hook — reset internal state between smoke assertions.
export function __resetRateLimiter(): void {
  buckets.clear();
}

// ── LRU projection cache ─────────────────────────────────────────────────────
// Map preserves insertion order; re-inserting on read makes it a recency list.
export const PROJECTION_LRU_MAX = 50_000;

const lru = new Map<string, unknown>();

export function projectionCacheKey(
  latKey: number,
  lngKey: number,
  year: number,
  scenario: string,
): string {
  return `${MODEL_CACHE_VERSION}|${latKey}|${lngKey}|${year}|${scenario}`;
}

export function lruGet(key: string): unknown | undefined {
  if (!lru.has(key)) return undefined;
  const value = lru.get(key);
  // Refresh recency: delete + re-set moves the key to the most-recent position.
  lru.delete(key);
  lru.set(key, value);
  return value;
}

export function lruSet(key: string, value: unknown): void {
  if (value === undefined) return;
  if (lru.has(key)) lru.delete(key);
  lru.set(key, value);
  while (lru.size > PROJECTION_LRU_MAX) {
    const oldest = lru.keys().next().value;
    if (oldest === undefined) break;
    lru.delete(oldest);
  }
}

export function lruSize(): number {
  return lru.size;
}

export function __resetProjectionCache(): void {
  lru.clear();
}
