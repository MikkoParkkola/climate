// ── User preference store ("Your conditions") ────────────────────────────────
// Shared client-side store for habitability Prefs: localStorage + useSyncExternalStore,
// no prop-drilling (same pattern as use-birth-year). Prefs never hit the server —
// re-scoring is local and instant (see docs/architecture/CUSTOMIZATION_KNOBS.md).
// encode/decodePrefs power the viral share mechanic: a shared URL carries only the
// sender's *deviations* from default, so default prefs keep URLs clean.

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, prefsAreDefault, type Prefs } from "./habitability";

const KEY = "fupit.prefs";
const listeners = new Set<() => void>();

// Compact URL codec — one short key per knob, only non-defaults emitted.
const FIELDS: Array<[keyof Prefs, string]> = [
  ["comfortOptimumC", "co"],
  ["heatSlope", "hs"],
  ["coldSlope", "cs"],
  ["droughtPer", "dp"],
  ["floodPer", "fp"],
];

export function encodePrefs(p: Prefs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, short] of FIELDS) {
    if (p[field] !== DEFAULT_PREFS[field]) out[short] = String(p[field]);
  }
  return out;
}

export function decodePrefs(params: URLSearchParams): Prefs {
  const p: Prefs = { ...DEFAULT_PREFS };
  for (const [field, short] of FIELDS) {
    const raw = params.get(short);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n)) p[field] = n;
    }
  }
  return p;
}

function read(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  // URL wins over localStorage so a shared link reproduces the sender's lens.
  const fromUrl = decodePrefs(new URLSearchParams(window.location.search));
  if (!prefsAreDefault(fromUrl)) return fromUrl;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch { /* ignore corrupt store */ }
  return DEFAULT_PREFS;
}

let current = read();

// Did THIS page load arrive carrying a non-default lens in the URL (a shared link)?
// Captured once at module init — before the deep-link effect calls history.replaceState
// and wipes the query string. Lets us show the "shared custom lens" banner to a recipient
// without false-firing for an owner whose own tuning lives in localStorage (pref-free URL).
const arrivedWithLens =
  typeof window !== "undefined" && !prefsAreDefault(decodePrefs(new URLSearchParams(window.location.search)));

export function arrivedViaSharedLens(): boolean {
  return arrivedWithLens;
}

export function setPrefs(next: Prefs): void {
  current = next;
  if (typeof window !== "undefined") {
    if (prefsAreDefault(next)) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function resetPrefs(): void {
  setPrefs({ ...DEFAULT_PREFS });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePrefs(): [Prefs, (next: Prefs) => void] {
  const prefs = useSyncExternalStore(subscribe, () => current, () => DEFAULT_PREFS);
  return [prefs, setPrefs];
}

// ── Self-check (codec roundtrip). Run: npx tsx client/src/lib/use-prefs.ts
export function _selfCheck(): void {
  // Default prefs emit nothing -> clean URLs.
  if (Object.keys(encodePrefs(DEFAULT_PREFS)).length !== 0) throw new Error("default prefs must encode to nothing");
  // Non-default roundtrips losslessly, and only deviations are emitted.
  const tuned: Prefs = { ...DEFAULT_PREFS, comfortOptimumC: 27, floodPer: 0.4 };
  const enc = encodePrefs(tuned);
  if (Object.keys(enc).length !== 2) throw new Error(`expected 2 encoded keys, got ${JSON.stringify(enc)}`);
  const back = decodePrefs(new URLSearchParams(enc));
  if (back.comfortOptimumC !== 27 || back.floodPer !== 0.4 || back.heatSlope !== DEFAULT_PREFS.heatSlope)
    throw new Error(`roundtrip mismatch: ${JSON.stringify(back)}`);
  // Garbage params are ignored, fall back to defaults.
  const junk = decodePrefs(new URLSearchParams("co=notanumber"));
  if (junk.comfortOptimumC !== DEFAULT_PREFS.comfortOptimumC) throw new Error("junk param should fall back to default");
  console.log(`encoded ${JSON.stringify(enc)} -> decoded co=${back.comfortOptimumC} fp=${back.floodPer}`);
  console.log("\n✅ _selfCheck passed");
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
