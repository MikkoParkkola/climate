#!/usr/bin/env python3
"""
baseline_extremes.py — present-day (1995-2014) absolute climatology of the 5 ETCCDI
extreme indices, for serve-time absolute risk thresholds.

The risk decision (serve-time absolute thresholds) needs the ABSOLUTE future index
value = baseline_absolute + modeled_delta, scored against a cited threshold (e.g.
hottest-day TXx vs 35 degC). fetch_extremes.py exports only the *delta*; this exports
the historical absolute ensemble mean it is relative to.

Self-consistent with fetch_extremes (same dataset, models, variants, grid): future
absolute = this baseline + that delta = the model's absolute extreme. Labeled as a
model climatology, same honesty caveat as baseline_monthly.py.

Output (per index): out/baseline-extreme-<short>.nc
  dims (lat, lon); var clim  (absolute index units), int16 + zlib.

Reuses fetch_extremes.py machinery. Run on Spark, detached.
"""
import os, sys, traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import xarray as xr

import fetch_extremes as fx   # INDICES, MODEL_VARIANT, ENSEMBLE, HIST_PERIOD, fetch_index, _years_mean, target_grid


def reduce_index(index, short, models=None):
    models = models or fx.ENSEMBLE
    lat, lon = fx.target_grid()
    stacks = []
    with ThreadPoolExecutor(max_workers=fx.MAX_CONCURRENT) as ex:
        futs = {ex.submit(fx.fetch_index, m, "historical", index, fx.HIST_PERIOD): m
                for m in models}
        for f in as_completed(futs):
            m = futs[f]
            try:
                da = f.result()
            except Exception:
                print(f"  [skip] {m}: {traceback.format_exc().splitlines()[-1]}", flush=True)
                continue
            if da is None:
                print(f"  [gap] {m}: no historical {index}", flush=True); continue
            clim = fx._years_mean(da, fx.BASELINE)
            if clim is not None:
                stacks.append(np.asarray(clim.values, dtype="float32"))
    if not stacks:
        print(f"  [empty] {index}: no usable baseline", flush=True)
        return None
    mean = np.nanmean(np.stack(stacks), axis=0)     # (lat, lon)
    ds = xr.Dataset({"clim": (("lat", "lon"), mean)},
                    coords={"lat": lat, "lon": lon})
    ds.attrs.update(index=index, baseline="1995-2014", n_models=len(stacks),
                    source="CMIP6 ETCCDI historical ensemble mean (MODEL baseline)",
                    note="absolute baseline for serve-time risk thresholds; model bias caveat")
    return ds


def save(ds, path):
    # float32, NOT int16+scale 0.01: absolute ETCCDI indices exceed 327 (CDD/TR up to 365
    # days; Rx5day >327 mm in the wet tropics), overflowing int16 at 0.01 scale and wrapping
    # negative. float32 is lossless; build_export.py re-quantizes adaptively for the blob.
    enc = {"clim": {"dtype": "float32", "_FillValue": float("nan"),
                    "zlib": True, "complevel": 5}}
    tmp = path + ".tmp"
    ds.to_netcdf(tmp, encoding=enc)
    os.replace(tmp, path)


def main():
    os.makedirs(fx.OUT, exist_ok=True)
    test = "--test" in sys.argv
    indices = {"consecutive_dry_days": "cdd"} if test else fx.INDICES
    models = fx.ENSEMBLE[:1] if test else fx.ENSEMBLE
    for index, short in indices.items():
        path = os.path.join(fx.OUT, f"baseline-extreme-{short}.nc")
        if os.path.exists(path) and not test:
            print(f"[have] {path}", flush=True); continue
        print(f"[run] baseline-extreme {index}", flush=True)
        try:
            ds = reduce_index(index, short, models=models)
            if ds is not None:
                save(ds, path)
                print(f"[done] {path} ({os.path.getsize(path)/1024:.0f} KB)", flush=True)
        except Exception:
            print(f"[ERROR] {index}\n{traceback.format_exc()}", flush=True)


if __name__ == "__main__":
    main()
