// Empirical calibration of the sigma-dissimilarity no-analog threshold against
// the REAL analog catalog (MIK-6788). Run: npx tsx scripts/calibrate-sigma-analog.ts
//
// The analytic scale factor for a nearest-neighbour distance is genuinely
// ambiguous (single-draw vs pairwise-difference vs min-over-catalog), so we
// calibrate the threshold from data: every present-day city SHOULD have a good
// present-day analog among the others, so their nearest-neighbour sigma tells us
// what "has an analog" looks like. The no-analog threshold must sit safely above
// that band, or ordinary cities get falsely flagged "no modern equivalent".
import { readFileSync } from "node:fs";
import { findClimateAnalog } from "../client/src/lib/climate-helpers";
import type { AnalogCatalog } from "../client/src/lib/climate-types";

const catalog = JSON.parse(
  readFileSync("client/public/climate-analog-catalog.current.json", "utf-8"),
) as AnalogCatalog;

const sigmas: { name: string; sigma: number; twin: string; label: string; noAnalog: boolean }[] = [];
for (const c of catalog.candidates) {
  const m = findClimateAnalog(
    catalog,
    { name: c.name, lat: c.lat, lng: c.lng, country: c.country, city: c.name },
    2100, // > catalogYear+2 so the city excludes itself and matches a NEIGHBOUR
    {
      monthlyTemps: c.temperature.monthly,
      monthlyPrecip: c.precipitation.monthly,
      avgTemp: c.temperature.annual_mean,
      annualPrecip: c.precipitation.annual_total,
      heatDays: c.extremes.heat_stress_days,
      drought: c.extremes.drought_risk,
      flood: c.extremes.flood_risk,
    },
  );
  if (m) sigmas.push({ name: c.name, sigma: m.sigma, twin: m.candidate.name, label: m.matchLabel, noAnalog: m.noAnalog });
}

sigmas.sort((a, b) => a.sigma - b.sigma);
const vals = sigmas.map((s) => s.sigma).filter(Number.isFinite);
const pct = (p: number) => vals[Math.min(vals.length - 1, Math.floor((p / 100) * vals.length))];
const flagged = sigmas.filter((s) => s.noAnalog);

console.log(`n=${sigmas.length} present-day cities, each matched to its nearest OTHER catalog city.`);
console.log(`sigma distribution: min=${vals[0].toFixed(2)} p50=${pct(50).toFixed(2)} p90=${pct(90).toFixed(2)} p99=${pct(99).toFixed(2)} max=${vals[vals.length - 1].toFixed(2)}`);
console.log(`FALSELY flagged noAnalog (present-day city with no analog — should be ~0): ${flagged.length}/${sigmas.length}`);
if (flagged.length) console.log("  flagged:", flagged.map((f) => `${f.name}(${f.sigma.toFixed(1)}σ)`).join(", "));
console.log("\nmost-isolated present-day cities (highest nearest-neighbour sigma):");
for (const s of sigmas.slice(-6)) console.log(`  ${s.sigma.toFixed(2)}σ  ${s.name} -> ${s.twin} [${s.label}]`);
console.log("\nbest-matched (lowest sigma):");
for (const s of sigmas.slice(0, 4)) console.log(`  ${s.sigma.toFixed(2)}σ  ${s.name} -> ${s.twin} [${s.label}]`);

// Warming sweep: does a progressively-warmer FUTURE climate flag correctly?
// Add +ΔC to every month of a few representative cities and report sigma.
console.log("\n=== warming sweep (target = present city + ΔC on every month) ===");
for (const nm of ["Helsinki", "Mumbai", "Cairo", "London"]) {
  const c = catalog.candidates.find((x) => x.name === nm);
  if (!c) continue;
  const row: string[] = [];
  for (const dC of [1, 2, 3, 4, 6, 10]) {
    const m = findClimateAnalog(
      catalog,
      { name: c.name, lat: c.lat, lng: c.lng, country: c.country, city: c.name },
      2100,
      {
        monthlyTemps: c.temperature.monthly.map((t) => t + dC),
        monthlyPrecip: c.precipitation.monthly,
        avgTemp: c.temperature.annual_mean + dC,
        annualPrecip: c.precipitation.annual_total,
        heatDays: c.extremes.heat_stress_days,
        drought: c.extremes.drought_risk,
        flood: c.extremes.flood_risk,
      },
    );
    const s = m ? (Number.isFinite(m.sigma) ? m.sigma.toFixed(1) : "inf") : "null";
    const flag = m?.noAnalog ? "*" : " ";
    row.push(`+${dC}C:${s}${flag}`);
  }
  console.log(`  ${nm.padEnd(9)} ${row.join("  ")}`);
}
console.log("  (* = flagged no-analog; threshold = 4σ)");

// ── assertions (this doubles as a regression test: npm run smoke:sigma-calib) ──
// The sigma MATCH QUALITY is what we ship: present-day cities must read as
// strong analogs (well-calibrated, no false novelty). The absolute no-analog
// flag is DORMANT with this 45-city monthly-mean catalog (a +10°C future still
// finds a hotter analog < 2σ) — documented, not oversold. Making it meaningful
// needs a larger catalog + extremes/humid-heat dims + interannual variability
// (tracked separately). This test guards the calibration we DO ship.
if (flagged.length !== 0) throw new Error(`present-day false no-analog flags: ${flagged.length} (must be 0)`);
if (!(pct(99) < 2)) throw new Error(`present-day p99 sigma too high (${pct(99).toFixed(2)}), calibration drifted`);
if (!vals.every((v) => v >= 0 && Number.isFinite(v))) throw new Error("non-finite present-day sigma");
console.log("\n✅ calibrate-sigma-analog: present-day cities all read as analogs (0 false flags, p99<2σ)");
