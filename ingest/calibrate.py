#!/usr/bin/env python3
"""
calibrate.py — model consensus vs IPCC-assessed (the "hot model" adjustment).

Raw CMIP6 multi-model means run warmer than the IPCC AR6 *assessed* warming,
because some CMIP6 models have higher climate sensitivity than the observed
record and paleoclimate support (Hausfather et al., Nature 2022). The IPCC
constrained its headline numbers toward observations; we expose both.

This computes a per-(scenario, decade) scaling factor
    k = assessed_global_mean / raw_ensemble_global_mean   (area-weighted)
from the temperature grids produced by fetch_reduce.py and the AR6 SPM.1
anchors, and writes out/calibration.json. The serving layer multiplies the raw
per-cell delta by k to get the IPCC-calibrated value, and shows both + the gap.

Scope: TEMPERATURE ONLY. Precipitation/humidity have no comparable single
assessed anchor, so they are served as raw model consensus + spread, never a
fabricated calibration (cardinal rule: silence beats a confident lie).
"""
import os, json
import numpy as np
import xarray as xr

OUT = os.path.join(os.path.dirname(__file__), "out")

# AR6 WGI SPM Table SPM.1 — best estimate warming (°C vs 1850–1900) at the three
# assessed 20-year periods. Period -> representative decade anchor.
ANCHOR_DECADE = {"2021-2040": 2030, "2041-2060": 2050, "2081-2100": 2090}
AR6_VS_1850 = {  # scenario short -> {period: best_estimate}
    "ssp1_1_9": {"2021-2040": 1.5, "2041-2060": 1.6, "2081-2100": 1.4},
    "ssp1_2_6": {"2021-2040": 1.5, "2041-2060": 1.7, "2081-2100": 1.8},
    "ssp2_4_5": {"2021-2040": 1.5, "2041-2060": 2.0, "2081-2100": 2.7},
    "ssp3_7_0": {"2021-2040": 1.5, "2041-2060": 2.1, "2081-2100": 3.6},
    "ssp5_8_5": {"2021-2040": 1.6, "2041-2060": 2.4, "2081-2100": 4.4},
}
# 1995–2014 (our baseline) is ~0.85 °C above 1850–1900 (AR6). Our grids store
# deltas vs 1995–2014, so subtract this to compare on the same baseline.
BASELINE_OFFSET = 0.85


def assessed_vs_baseline(scenario):
    """AR6 assessed warming vs our 1995–2014 baseline, at the anchor decades."""
    out = {}
    for period, val in AR6_VS_1850[scenario].items():
        out[ANCHOR_DECADE[period]] = round(val - BASELINE_OFFSET, 3)
    return out  # {2030: x, 2050: y, 2090: z}


def raw_global_means(scenario):
    """Area-weighted global-mean raw ensemble ΔT per decade from the grid."""
    path = os.path.join(OUT, f"air-temperature__{scenario}.nc")
    if not os.path.exists(path):
        return None
    ds = xr.open_dataset(path)
    w = np.cos(np.deg2rad(ds.lat))
    means = {}
    for d in ds.decade.values:
        gm = float(ds.delta_mean.sel(decade=d).weighted(w).mean())
        means[int(d)] = round(gm, 3)
    ds.close()
    return means


def calibrate(scenario):
    raw = raw_global_means(scenario)
    if raw is None:
        return None
    assessed_anchors = assessed_vs_baseline(scenario)
    ax = sorted(assessed_anchors)                       # [2030, 2050, 2090]
    ay = [assessed_anchors[a] for a in ax]
    rows = {}
    for d, raw_gm in sorted(raw.items()):
        # interpolate assessed onto this decade (flat-extrapolate past 2090)
        assessed = float(np.interp(d, ax, ay))
        k = assessed / raw_gm if raw_gm != 0 else 1.0
        rows[d] = {
            "raw_global": raw_gm,
            "assessed_global": round(assessed, 3),
            "k": round(k, 4),
            "adjustment": round(assessed - raw_gm, 3),
            "adjustment_pct": round((k - 1.0) * 100, 1),
        }
    return rows


def main():
    scenarios = ["ssp1_1_9", "ssp1_2_6", "ssp2_4_5", "ssp3_7_0", "ssp5_8_5"]
    table = {}
    for sc in scenarios:
        rows = calibrate(sc)
        if rows is not None:
            table[sc] = rows
    meta = {
        "variable": "near_surface_air_temperature",
        "method": "k = AR6 SPM.1 assessed best-estimate / raw ensemble global mean; "
                  "assessed interpolated across anchor decades 2030/2050/2090; "
                  "baseline 1995-2014 (AR6 -0.85C offset from 1850-1900).",
        "scope": "temperature only; precip/humidity served as raw consensus+spread",
        "source": "IPCC AR6 WGI SPM Table SPM.1; Hausfather et al. 2022 Nature",
    }
    out = {"_meta": meta, "factors": table}
    path = os.path.join(OUT, "calibration.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=2)

    # Human-readable summary at 2100 (model consensus vs IPCC-calibrated)
    print(f"wrote {path}\n")
    print("Model consensus vs IPCC-calibrated (global mean ΔT °C vs 1995-2014):")
    print(f"{'scenario':10} {'decade':>6} {'raw':>7} {'IPCC':>7} {'gap':>7} {'adj%':>6}")
    for sc in scenarios:
        if sc not in table:
            continue
        for d in (2050, 2100):
            r = table[sc].get(d)
            if r:
                print(f"{sc:10} {d:>6} {r['raw_global']:>7.2f} {r['assessed_global']:>7.2f} "
                      f"{r['adjustment']:>7.2f} {r['adjustment_pct']:>6.1f}")


if __name__ == "__main__":
    main()
