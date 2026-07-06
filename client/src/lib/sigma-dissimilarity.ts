// Sigma-dissimilarity for climate-analog ("climate twin") novelty detection.
//
// Method: Mahony et al. 2017, "A closer look at novel climates" — the basis of
// the Fitzpatrick/UMCES "Future Urban Climates" analog tool. A Mahalanobis
// distance between two climates is converted to a percentile of the chi
// distribution (degrees of freedom = the number of INDEPENDENT climate
// dimensions), then expressed as the equivalent number of standard deviations
// of a 1-D normal — the "sigma dissimilarity".
//
// Why it matters here: it gives fupit an honest novelty flag. Above ~4 sigma a
// location's future climate has NO present-day equivalent, so the right answer
// is "no modern analog exists", not a forced nearest-city twin. That is the
// blank-not-guess ethos made quantitative (DESIGN.md §4).

// > this many sigma → no present-day analog (novel climate). Mahony's ">4σ".
export const SIGMA_NO_ANALOG = 4;
// ≤ this many sigma → a strong analog.
export const SIGMA_STRONG = 2;

export type AnalogMatchLabel = "strong" | "moderate" | "weak" | "none";

// lgamma via Lanczos approximation (g=7). Accurate to ~1e-13 for x > 0.
function lgamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Regularized lower incomplete gamma P(a, x). Numerical Recipes: series for
// x < a+1, continued fraction (for Q = 1-P) otherwise.
function gammp(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 300; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gln) * h;
  return 1 - q;
}

// CDF of the chi-square distribution with k degrees of freedom.
export function chiSquareCdf(x: number, k: number): number {
  return gammp(k / 2, x / 2);
}

// Inverse standard-normal CDF (probit), Acklam's rational approximation
// (|error| < 1.15e-9 in the central region).
export function probit(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// Sigma dissimilarity of a Mahalanobis distance D under a chi distribution with
// `dof` degrees of freedom. Returns Infinity for distances beyond numerical
// range (i.e. extreme novelty).
export function sigmaDissimilarity(D: number, dof: number): number {
  if (!(D >= 0) || !(dof > 0)) return 0;
  const p = chiSquareCdf(D * D, dof);
  if (p >= 1) return Infinity;
  const sigma = probit((1 + p) / 2);
  return Number.isFinite(sigma) ? Math.max(0, sigma) : Infinity;
}

// Effective degrees of freedom of a set of standardized vectors (the
// "participation ratio", trace(C)^2 / ||C||_F^2 of their covariance C).
// The raw monthly climate dimensions are highly correlated (adjacent months
// move together), so treating each as an independent dof would badly overstate
// the chi degrees of freedom and under-flag novelty. This collapses them to the
// number of effectively-independent climate gradients. `rows` are already
// standardized (mean 0, unit variance per column) — the caller does that.
export function effectiveDof(rows: number[][], dims: number): number {
  const n = rows.length;
  if (n === 0 || dims === 0) return Math.max(1, dims);
  let trace = 0;
  let fro = 0;
  for (let i = 0; i < dims; i++) {
    for (let j = i; j < dims; j++) {
      let cij = 0;
      for (let r = 0; r < n; r++) cij += rows[r][i] * rows[r][j];
      cij /= n;
      if (i === j) {
        trace += cij;
        fro += cij * cij;
      } else {
        fro += 2 * cij * cij; // symmetric: count (i,j) and (j,i)
      }
    }
  }
  if (fro <= 0) return Math.max(1, dims);
  const keff = (trace * trace) / fro;
  return Math.max(1, Math.min(dims, keff));
}

// Bucket a sigma value into a human label. > SIGMA_NO_ANALOG (or non-finite)
// means there is no modern equivalent.
export function analogLabel(sigma: number): AnalogMatchLabel {
  if (!Number.isFinite(sigma) || sigma > SIGMA_NO_ANALOG) return "none";
  if (sigma <= SIGMA_STRONG) return "strong";
  if (sigma <= 3) return "moderate";
  return "weak";
}

// ── runnable self-check: `npx tsx client/src/lib/sigma-dissimilarity.ts` ──────
function approx(got: number, want: number, tol: number, msg: string) {
  if (Math.abs(got - want) > tol) {
    throw new Error(`${msg}: got ${got}, want ${want} (±${tol})`);
  }
}

export function _selfCheck() {
  // chiSquareCdf against known values (df=1: CDF(1)=0.6827, CDF(3.841)=0.95).
  approx(chiSquareCdf(1, 1), 0.6827, 5e-3, "chi2cdf(1,1)");
  approx(chiSquareCdf(3.8415, 1), 0.95, 2e-3, "chi2cdf(3.8415,1)");
  // df=2: CDF(x)=1-exp(-x/2); CDF(2)=0.6321.
  approx(chiSquareCdf(2, 2), 1 - Math.exp(-1), 2e-3, "chi2cdf(2,2)");

  // probit against known quantiles.
  approx(probit(0.5), 0, 1e-6, "probit(0.5)");
  approx(probit(0.975), 1.959964, 1e-4, "probit(0.975)");
  approx(probit(0.8413447), 1.0, 1e-4, "probit(0.8413)");

  // Consistency: for k=1, sigmaDissimilarity(D,1) === D (a 1-D z-score is its
  // own sigma). p = chi2cdf(D^2,1) = 2Φ(D)-1, then probit((1+p)/2)=probit(Φ(D))=D.
  approx(sigmaDissimilarity(1, 1), 1, 1e-4, "sigma(1,1)==1");
  approx(sigmaDissimilarity(2, 1), 2, 1e-4, "sigma(2,1)==2");
  approx(sigmaDissimilarity(3.5, 1), 3.5, 1e-4, "sigma(3.5,1)==3.5");

  // Monotonic in D.
  if (!(sigmaDissimilarity(5, 8) > sigmaDissimilarity(3, 8))) {
    throw new Error("sigma must increase with distance");
  }

  // Novelty gate: a distance that lands at the 0.99997-percentile of chi(k) is
  // ~4 sigma. Build D so chi2cdf(D^2,k)=2Φ(4)-1 → D^2 = qchisq(that, k).
  const kNov = 6;
  // find D where sigma≈4 by bisection, then assert it flags no-analog just above.
  let lo = 0;
  let hi = 30;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (sigmaDissimilarity(mid, kNov) < SIGMA_NO_ANALOG) lo = mid;
    else hi = mid;
  }
  const dAt4 = hi;
  if (analogLabel(sigmaDissimilarity(dAt4 * 1.05, kNov)) !== "none") {
    throw new Error("expected 'none' (no analog) just past the 4σ boundary");
  }
  if (analogLabel(sigmaDissimilarity(dAt4 * 0.6, kNov)) === "none") {
    throw new Error("a clearly-inside distance must NOT be 'none'");
  }

  // effectiveDof: independent columns → dof≈dims; a duplicated column halves the
  // independent count of that pair.
  const indep = [
    [1, 1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, 1],
    [1, -1, 1], [-1, 1, 1], [1, 1, -1], [-1, -1, -1],
  ];
  approx(effectiveDof(indep, 3), 3, 0.4, "effectiveDof independent≈3");
  const dup = indep.map((r) => [r[0], r[0], r[2]]); // col0==col1 (perfectly correlated)
  if (!(effectiveDof(dup, 3) < 2.6)) {
    throw new Error(`duplicated column should drop dof below 2.6, got ${effectiveDof(dup, 3)}`);
  }

  console.log("✅ sigma-dissimilarity _selfCheck passed");
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  _selfCheck();
}
