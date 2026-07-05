// ── Habitability scoring — exact client port of grounded_model.py::habitability ──
// SINGLE SOURCE OF TRUTH for the constants is grounded_model.py:88-104. This is a
// faithful copy so the score can be recomputed in the browser, instantly, for any
// user preference — no server round-trip (see docs/architecture/CUSTOMIZATION_KNOBS.md).
// The parity contract (default prefs == server score within ε) is enforced by
// _selfCheck() below and the runtime parityDrift() assertion in the hook.

import { categoryFor } from "./climate-helpers";
import type { ProjectionPoint } from "./climate-types";

export const SCORING = {
  COMFORT_PLATEAU_C: 3.0,
  COMFORT_WEIGHT_TEMP: 0.6,
  COMFORT_WEIGHT_PRECIP: 0.4,
  HEAT_NIGHTS_PEN_PER: 0.4,
  HEAT_NIGHTS_PEN_MAX: 25.0,
  WETBULB_PEN_LOW_C: 18.0,
  WETBULB_PEN_HIGH_C: 28.0,
  WETBULB_PEN_MAX: 35.0,
  DROUGHT_PEN_MAX: 25.0,
  FLOOD_PEN_MAX: 25.0,
} as const;

// User-tunable preferences. Defaults are the Python constants, so DEFAULT_PREFS
// reproduces the canonical, citeable server score exactly.
export interface Prefs {
  comfortOptimumC: number; // ideal annual-mean temperature
  heatSlope: number; // comfort points lost per °C above the band
  coldSlope: number; // comfort points lost per °C below the band
  droughtPer: number; // drought penalty per risk point
  floodPer: number; // flood penalty per risk point
}

export const DEFAULT_PREFS: Prefs = {
  comfortOptimumC: 20.0,
  heatSlope: 3.5,
  coldSlope: 3.0,
  droughtPer: 0.25,
  floodPer: 0.25,
};

export function prefsAreDefault(p: Prefs): boolean {
  return (
    p.comfortOptimumC === DEFAULT_PREFS.comfortOptimumC &&
    p.heatSlope === DEFAULT_PREFS.heatSlope &&
    p.coldSlope === DEFAULT_PREFS.coldSlope &&
    p.droughtPer === DEFAULT_PREFS.droughtPer &&
    p.floodPer === DEFAULT_PREFS.floodPer
  );
}

export interface HabitabilityInput {
  meanTemp: number | null | undefined;
  annualPrecip: number | null | undefined;
  heatNights: number | null | undefined; // tropical nights / year
  droughtRisk: number | null | undefined;
  floodRisk: number | null | undefined;
  wetBulbMax?: number | null | undefined;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function habitability(input: HabitabilityInput, prefs: Prefs = DEFAULT_PREFS): number {
  const meanTemp = num(input.meanTemp);
  if (meanTemp === null) return 50.0;
  const optimum = prefs.comfortOptimumC;

  const d = Math.abs(meanTemp - optimum);
  let ts: number;
  if (d <= SCORING.COMFORT_PLATEAU_C) ts = 100.0;
  else if (meanTemp > optimum) ts = 100.0 - (d - SCORING.COMFORT_PLATEAU_C) * prefs.heatSlope;
  else ts = 100.0 - (d - SCORING.COMFORT_PLATEAU_C) * prefs.coldSlope;
  ts = clamp(ts, 0, 100);

  const precip = num(input.annualPrecip);
  let ps: number;
  if (precip === null) ps = 50.0;
  else if (precip >= 600 && precip <= 1200) ps = 100 - Math.abs(precip - 900) / 25;
  else if (precip < 600) ps = Math.max(20, 88 - (600 - precip) / 12);
  else ps = Math.max(20, 88 - (precip - 1200) / 40);
  ps = clamp(ps, 0, 100);

  const base = ts * SCORING.COMFORT_WEIGHT_TEMP + ps * SCORING.COMFORT_WEIGHT_PRECIP;
  const heatPen = Math.min(SCORING.HEAT_NIGHTS_PEN_MAX, (num(input.heatNights) ?? 0) * SCORING.HEAT_NIGHTS_PEN_PER);
  const wetBulb = num(input.wetBulbMax);
  const humidPen =
    wetBulb === null
      ? 0
      : clamp(((wetBulb - SCORING.WETBULB_PEN_LOW_C) / (SCORING.WETBULB_PEN_HIGH_C - SCORING.WETBULB_PEN_LOW_C)) * SCORING.WETBULB_PEN_MAX, 0, SCORING.WETBULB_PEN_MAX);
  const droughtPen = Math.min(SCORING.DROUGHT_PEN_MAX, (num(input.droughtRisk) ?? 0) * prefs.droughtPer);
  const floodPen = Math.min(SCORING.FLOOD_PEN_MAX, (num(input.floodRisk) ?? 0) * prefs.floodPer);

  return clamp(base - heatPen - humidPen - droughtPen - floodPen, 0, 100);
}

export function inputFromPoint(p: ProjectionPoint): HabitabilityInput {
  return {
    meanTemp: p.temperature?.annual_mean,
    annualPrecip: p.precipitation?.annual_total,
    heatNights: p.extremes?.detail?.tropical_nights_per_year,
    droughtRisk: p.extremes?.drought_risk,
    floodRisk: p.extremes?.flood_risk,
    wetBulbMax: p.extremes?.detail?.humid_heat?.max_monthly_mean_wet_bulb_c,
  };
}

// Re-score a whole trajectory for the user's prefs. At default prefs this is the
// identity (same reference) so the canonical grounded score is preserved exactly
// and memoization stays cheap.
export function rescoreTrajectory(points: ProjectionPoint[] | null, prefs: Prefs): ProjectionPoint[] | null {
  if (!points || prefsAreDefault(prefs)) return points;
  return points.map((p) => {
    const score = habitability(inputFromPoint(p), prefs);
    return { ...p, habitability: { ...p.habitability, score, category: categoryFor(score) } };
  });
}

// Runtime parity: largest gap between our default-pref score and the server's
// score across the trajectory. Should be ≤ ε (rounding). The hook logs if not.
export function parityDrift(points: ProjectionPoint[] | null): number {
  if (!points || points.length === 0) return 0;
  let max = 0;
  for (const p of points) {
    const mine = habitability(inputFromPoint(p), DEFAULT_PREFS);
    const theirs = p.habitability?.score;
    if (typeof theirs === "number" && Number.isFinite(theirs)) max = Math.max(max, Math.abs(mine - theirs));
  }
  return max;
}

// ── Self-check (ponytail: one runnable check). Run: npx tsx client/src/lib/habitability.ts
export function _selfCheck(): void {
  const approx = (a: number, b: number, eps = 0.05) => Math.abs(a - b) <= eps;

  // Perfect: optimum temp, ideal rainfall, no hazards -> 100.
  const perfect = habitability({ meanTemp: 20, annualPrecip: 900, heatNights: 0, droughtRisk: 0, floodRisk: 0 });
  if (!approx(perfect, 100)) throw new Error(`perfect expected 100, got ${perfect}`);

  // Hot + hazards (hand-computed against the Python formula):
  // ts = 100-(10-3)*3.5 = 75.5 -> *0.6 = 45.3 ; ps=100 -> *0.4 = 40 ; base=85.3
  // heatPen=min(25,50*0.4)=20 ; drought=min(25,40*0.25)=10 ; flood=20*0.25=5 -> 85.3-35 = 50.3
  const hot = habitability({ meanTemp: 30, annualPrecip: 900, heatNights: 50, droughtRisk: 40, floodRisk: 20 });
  if (!approx(hot, 50.3)) throw new Error(`hot expected 50.3, got ${hot}`);

  // Comfort-optimum knob moves the score: a warm place scores higher for a warm-lover.
  const warmLover = habitability({ meanTemp: 30, annualPrecip: 900, heatNights: 50, droughtRisk: 40, floodRisk: 20 }, { ...DEFAULT_PREFS, comfortOptimumC: 27 });
  if (!(warmLover > hot)) throw new Error(`warm-lover (${warmLover}) should beat default (${hot})`);

  console.log(`perfect=${perfect}  hot=${hot.toFixed(1)}  warmLover=${warmLover.toFixed(1)}`);
  console.log("\n✅ _selfCheck passed");
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
