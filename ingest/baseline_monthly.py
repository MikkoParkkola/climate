#!/usr/bin/env python3
"""
baseline_monthly.py — monthly present-day climatology (1995-2014) for the serving
layer's absolute values.

The grid deltas (fetch_reduce.py) are annual *changes*. The app's contract needs
absolute MONTHLY temperature + precipitation (seasonal cycle, min/max, amplitude).
This builds the baseline those deltas are added to: the CMIP6 historical ensemble
mean, grouped by calendar month, over 1995-2014.

HONESTY: this is a MODEL historical climatology, not an observational product.
Model absolute values carry biases (a few °C / tens of % locally) that the delta
does not. v1 ships this, clearly labeled; observed bias-correction (ERA5/WorldClim)
is a planned upgrade. The *change* signal — the product's actual claim — stays
observation-constrained via the IPCC calibration layer. Documented in
docs/architecture/SCIENTIFIC_GROUNDING.md.

Output (per variable): out/baseline-<short>.nc
  dims (month, lat, lon); var clim  (absolute: degC for temp, mm/month precip, % RH)
  int16-quantized + zlib. Same juicer: download -> reduce -> delete raw.

Reuses fetch_reduce.py (same ensemble, grid, CDS client, HDF5 lock).
Run on Spark, detached. I/O-bound on the CDS queue.
"""
import os, sys, glob, zipfile, tempfile, shutil, traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import xarray as xr

import fetch_reduce as fr   # ENSEMBLE, target_grid, _main_var, client, _hdf5_lock, OUT

BASELINE = list(range(1995, 2015))
ALL_MONTHS = [f"{m:02d}" for m in range(1, 13)]
# CDS variable -> (short filename code, output unit handling)
VARIABLES = {
    "near_surface_air_temperature": "temperature",   # K -> degC
    "precipitation": "precipitation",                # kg m-2 s-1 -> mm/month
    "near_surface_relative_humidity": "humidity",    # % (passthrough)
}
SECONDS_PER_DAY = 86400
DAYS_IN_MONTH = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])


def fetch_monthly_clim(model, variable):
    """Historical monthly climatology for one model: (12, lat, lon) on the common
    grid, calendar-month means over BASELINE. None if the model lacks the data."""
    tmp = tempfile.mkdtemp(prefix="base_", dir=fr.OUT)
    zpath = os.path.join(tmp, "d.zip")
    try:
        req = {
            "temporal_resolution": "monthly", "experiment": "historical",
            "variable": variable, "model": model,
            "year": [str(y) for y in BASELINE], "month": ALL_MONTHS,
        }
        try:
            fr.client().retrieve("projections-cmip6", req, zpath)
        except Exception as e:
            msg = str(e).lower()
            if any(k in msg for k in ("no data", "not found", "invalid")):
                return None
            raise
        try:
            zipfile.ZipFile(zpath).extractall(tmp)
        except zipfile.BadZipFile:
            os.replace(zpath, os.path.join(tmp, "d.nc"))
        ncs = glob.glob(os.path.join(tmp, "*.nc"))
        if not ncs:
            return None
        with fr._hdf5_lock:
            ds = xr.open_mfdataset(ncs, combine="by_coords") if len(ncs) > 1 else xr.open_dataset(ncs[0])
            da = ds[fr._main_var(ds)]
            clim = da.groupby("time.month").mean("time")          # (month, lat, lon)
            if float(clim.lon.max()) > 180:
                clim = clim.assign_coords(lon=(((clim.lon + 180) % 360) - 180)).sortby("lon")
            lat, lon = fr.target_grid()
            out = clim.interp(lat=lat, lon=lon).load()
            ds.close()
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def reduce_variable(variable, short, models=None):
    models = models or fr.ENSEMBLE
    lat, lon = fr.target_grid()
    stacks = []
    with ThreadPoolExecutor(max_workers=fr.MAX_CONCURRENT) as ex:
        futs = {ex.submit(fetch_monthly_clim, m, variable): m for m in models}
        for f in as_completed(futs):
            m = futs[f]
            try:
                r = f.result()
            except Exception:
                print(f"  [skip] {m}: {traceback.format_exc().splitlines()[-1]}", flush=True)
                continue
            if r is None:
                print(f"  [gap] {m}: no historical {variable}", flush=True); continue
            stacks.append(r.values.astype("float32"))
    if not stacks:
        print(f"  [empty] {variable}: no usable data", flush=True)
        return None
    arr = np.stack(stacks)                       # (n_models, 12, lat, lon)
    clim = np.nanmean(arr, axis=0)               # ensemble mean -> (12, lat, lon)

    # unit conversions to the app's serving units
    if short == "temperature":
        clim = clim - 273.15                                   # K -> degC
        unit = "degC"
    elif short == "precipitation":
        clim = clim * SECONDS_PER_DAY * DAYS_IN_MONTH[:, None, None]  # kg/m2/s -> mm/month
        unit = "mm/month"
    else:
        unit = "percent"

    ds = xr.Dataset(
        {"clim": (("month", "lat", "lon"), clim)},
        coords={"month": list(range(1, 13)), "lat": lat, "lon": lon},
    )
    ds.attrs.update(variable=variable, baseline="1995-2014", unit=unit, n_models=len(stacks),
                    source="CMIP6 historical ensemble monthly climatology (MODEL baseline)",
                    note="model absolute values carry bias; observed bias-correction planned")
    return ds


def save(ds, path):
    # float32, NOT int16+scale 0.01: absolute monthly precip in monsoon regions exceeds
    # 327 mm/month, which overflows int16 at 0.01 scale and wraps to NEGATIVE precip
    # (bug caught at Mumbai: Jul = -267 mm). float32 is lossless across the full range;
    # build_export.py re-quantizes with an adaptive per-array scale for the compact blob.
    enc = {"clim": {"dtype": "float32", "_FillValue": float("nan"),
                    "zlib": True, "complevel": 5}}
    tmp = path + ".tmp"
    ds.to_netcdf(tmp, encoding=enc)
    os.replace(tmp, path)


def main():
    os.makedirs(fr.OUT, exist_ok=True)
    test = "--test" in sys.argv
    variables = {"near_surface_air_temperature": "temperature"} if test else VARIABLES
    models = fr.ENSEMBLE[:2] if test else fr.ENSEMBLE
    for variable, short in variables.items():
        path = os.path.join(fr.OUT, f"baseline-{short}.nc")
        if os.path.exists(path) and not test:
            print(f"[have] {path}", flush=True); continue
        print(f"[run] baseline {variable}", flush=True)
        try:
            ds = reduce_variable(variable, short, models=models)
            if ds is not None:
                save(ds, path)
                print(f"[done] {path} ({os.path.getsize(path)/1024:.0f} KB)", flush=True)
        except Exception:
            print(f"[ERROR] {variable}\n{traceback.format_exc()}", flush=True)


if __name__ == "__main__":
    main()
