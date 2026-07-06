// Local mitigation cooling model (MIK-6796) — "what could my city do?".
//
// Deterministic, cited cooling offsets for two levers a city actually controls:
// tree canopy and cool roofs (surface albedo). These are THEORETICAL, LOCAL,
// order-of-magnitude approximations — a screening estimate of what greening and
// reflective surfaces could shave off local air temperature, NOT a measured or
// modeled projection for a specific place. The UI must label them as such
// (DESIGN.md §4 honesty), the same way the risk scores expose their raw basis.
//
// Sources:
// - Tree canopy: Bowler et al. 2010, "Urban greening to cool towns and cities:
//   a systematic review", Landscape and Urban Planning 97(3). Green/tree-shaded
//   urban areas run on the order of ~1 °C cooler than non-green urban fabric
//   (park mean ~0.94 °C; larger for dense canopy). We take ~1.5 °C as the
//   plausible ceiling for a full realistic canopy expansion.
// - Cool roofs (albedo): urban cool-roof / high-albedo studies report local air
//   cooling on the order of ~1 °C at high adoption. We take ~1.0 °C as the
//   ceiling for full cool-roof adoption.
//
// Both are modeled as linear in the adoption fraction (0..1) and additive. That
// is deliberately simple; the real effect saturates and interacts, but for a
// "move the slider, see roughly what it buys" screening tool a linear cited
// ceiling is the honest, defensible choice.

// Cooling (°C) at full adoption of each lever. Positive = degrees removed.
export const MAX_CANOPY_COOLING_C = 1.5; // Bowler et al. 2010
export const MAX_COOL_ROOF_COOLING_C = 1.0; // cool-roof / high-albedo literature

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export interface MitigationResult {
  // Total local cooling in °C (>= 0). Subtract from a projected temperature.
  coolingC: number;
  canopyC: number;
  coolRoofC: number;
  // Fixed provenance string so the UI can show the cited basis inline.
  basis: string;
}

// Cooling from tree-canopy expansion. `canopyFraction` is 0..1 of the plausible
// realistic canopy increase (not absolute canopy cover).
export function canopyCooling(canopyFraction: number): number {
  return clamp01(canopyFraction) * MAX_CANOPY_COOLING_C;
}

// Cooling from cool-roof / high-albedo adoption, 0..1 of full adoption.
export function coolRoofCooling(coolRoofFraction: number): number {
  return clamp01(coolRoofFraction) * MAX_COOL_ROOF_COOLING_C;
}

export function mitigationCooling(canopyFraction: number, coolRoofFraction: number): MitigationResult {
  const canopyC = canopyCooling(canopyFraction);
  const coolRoofC = coolRoofCooling(coolRoofFraction);
  return {
    coolingC: canopyC + coolRoofC,
    canopyC,
    coolRoofC,
    basis: "Theoretical local screening estimate: tree canopy per Bowler et al. 2010; cool roofs per high-albedo urban studies. Not a measured value.",
  };
}

// Apply the mitigation to a projected temperature (°C). Cooling never pushes a
// place below its own baseline in a nonsensical way here — it is a simple
// subtraction; the caller decides how to present the adjusted figure.
export function applyMitigation(projectedTempC: number, canopyFraction: number, coolRoofFraction: number): number {
  return projectedTempC - mitigationCooling(canopyFraction, coolRoofFraction).coolingC;
}

// ── runnable self-check: `npx tsx client/src/lib/mitigation.ts` ──────────────
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function _selfCheck() {
  // Zero adoption → zero cooling.
  assert(mitigationCooling(0, 0).coolingC === 0, "no adoption => no cooling");

  // Full adoption → the cited ceiling, additive.
  const full = mitigationCooling(1, 1);
  assert(
    Math.abs(full.coolingC - (MAX_CANOPY_COOLING_C + MAX_COOL_ROOF_COOLING_C)) < 1e-9,
    `full adoption should equal the summed ceiling, got ${full.coolingC}`,
  );

  // Monotonic in each lever.
  assert(mitigationCooling(0.8, 0).coolingC > mitigationCooling(0.3, 0).coolingC, "canopy monotonic");
  assert(mitigationCooling(0, 0.8).coolingC > mitigationCooling(0, 0.3).coolingC, "cool-roof monotonic");

  // Clamped: out-of-range inputs don't over/under-shoot.
  assert(mitigationCooling(5, 5).coolingC === full.coolingC, "inputs clamp at 1");
  assert(mitigationCooling(-3, -3).coolingC === 0, "negative inputs clamp at 0");

  // applyMitigation subtracts the offset.
  assert(Math.abs(applyMitigation(30, 1, 1) - (30 - full.coolingC)) < 1e-9, "applyMitigation subtracts cooling");

  // Basis string is always present (the honesty label).
  assert(full.basis.length > 0 && /not a measured/i.test(full.basis), "basis must flag it as non-measured");

  console.log(`✅ mitigation _selfCheck passed (full cooling = ${full.coolingC.toFixed(2)}°C)`);
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
