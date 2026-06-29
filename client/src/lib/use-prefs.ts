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
