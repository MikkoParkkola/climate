// ── Optional birth year — shared, client-side only ───────────────────────────
// Lives in localStorage and a module store so the landing page and the result
// hook stay in sync WITHOUT prop-drilling through the app shell. It is never
// sent to the server: the personal-lifetime framing is computed in the browser.

import { useSyncExternalStore } from "react";

const KEY = "fupit.birthYear";
const listeners = new Set<() => void>();

function read(): number | null {
  if (typeof window === "undefined") return null;
  const n = Number(window.localStorage.getItem(KEY));
  return Number.isFinite(n) && n > 1900 ? n : null;
}

let current = read();

export function setBirthYear(v: number | null): void {
  const next = v && Number.isFinite(v) ? v : null;
  if (typeof window !== "undefined") {
    if (next) window.localStorage.setItem(KEY, String(next));
    else window.localStorage.removeItem(KEY);
  }
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useBirthYear(): [number | null, (v: number | null) => void] {
  const birthYear = useSyncExternalStore(subscribe, () => current, () => null);
  return [birthYear, setBirthYear];
}
