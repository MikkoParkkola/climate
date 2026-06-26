#!/usr/bin/env python3
"""
fetch_reduce.py — the juicer.

Download CMIP6 climate data, reduce each piece to a compact *change* field
(delta vs the 1995-2014 baseline), average across the model ensemble, and write
a tiny compressed result. Raw downloads are deleted the moment they're reduced,
so disk never piles up.

Output (per variable+scenario): out/<variable>__<scenario>.nc
  dims (decade, lat, lon); vars delta_mean, delta_std, n_models
  int16-quantized + zlib-compressed.

Method = delta / change-factor downscaling (see docs/architecture/ARCHITECTURE.md):
we store only the modeled CHANGE; the app adds it to real local observed climate
at query time. Coarse stored grid is fine because local sharpness comes from the
observed baseline, not from here.

Checkpointed: an existing complete output file is skipped, so the batch resumes.
Heavy job — run detached on Spark, never Replit/Mac.
"""
import os, sys, glob, json, zipfile, tempfile, shutil, traceback
import numpy as np
import xarray as xr
import cdsapi

# ── Config ───────────────────────────────────────────────────────────────────
ENSEMBLE = [  # 10 established CMIP6 models, broad institutional/geographic spread
    "access_cm2", "cesm2", "cmcc_esm2", "cnrm_cm6_1", "ec_earth3",
    "gfdl_esm4", "miroc6", "mri_esm2_0", "noresm2_lm", "ukesm1_0_ll",
]
SCENARIOS = ["ssp1_1_9", "ssp1_2_6", "ssp2_4_5", "ssp3_7_0", "ssp5_8_5"]
VARIABLES = [  # CDS name -> short code used in filenames; NetCDF var auto-detected
    "near_surface_air_temperature",
    "precipitation",
    "near_surface_relative_humidity",
]
# ratio (%) change for fluxes like precip; difference for everything else
RATIO_VARS = {"precipitation"}

BASELINE = list(range(1995, 2015))          # 20-yr present-day reference
DECADES = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
WINDOW = 5                                    # +/- years around each decade anchor
ALL_MONTHS = [f"{m:02d}" for m in range(1, 13)]

OUT = os.path.join(os.path.dirname(__file__), "out")
GRID_RES = 1.0                               # stored grid resolution (degrees)

_client = None
def client():
    global _client
    if _client is None:
        _client = cdsapi.Client()
    return _client


def target_grid():
    half = GRID_RES / 2
    lat = np.arange(-90 + half, 90, GRID_RES)
    lon = np.arange(-180 + half, 180, GRID_RES)
    return lat, lon


def _main_var(ds):
    """Pick the science variable (largest-dims data var, not a *_bnds)."""
    cands = [v for v in ds.data_vars if not v.endswith("_bnds") and "bnds" not in v]
    return max(cands, key=lambda v: ds[v].ndim)


def fetch_climatology(model, experiment, variable, years):
    """Download monthly data for `years`, return a (lat,lon) time-mean on the
    common grid. Returns None if the model/experiment/variable combo has no data.
    Deletes the raw download before returning."""
    tmp = tempfile.mkdtemp(prefix="cmip6_", dir=OUT)
    zpath = os.path.join(tmp, "d.zip")
    try:
        req = {
            "temporal_resolution": "monthly",
            "experiment": experiment,
            "variable": variable,
            "model": model,
            "year": [str(y) for y in years],
            "month": ALL_MONTHS,
        }
        try:
            client().retrieve("projections-cmip6", req, zpath)
        except Exception as e:
            msg = str(e).lower()
            if "no data" in msg or "not found" in msg or "invalid" in msg:
                return None
            raise
        try:
            zipfile.ZipFile(zpath).extractall(tmp)
        except zipfile.BadZipFile:
            os.replace(zpath, os.path.join(tmp, "d.nc"))
        ncs = glob.glob(os.path.join(tmp, "*.nc"))
        if not ncs:
            return None
        ds = xr.open_mfdataset(ncs, combine="by_coords") if len(ncs) > 1 else xr.open_dataset(ncs[0])
        da = ds[_main_var(ds)].mean("time")
        # normalize longitude 0..360 -> -180..180 then regrid to common grid
        if float(da.lon.max()) > 180:
            da = da.assign_coords(lon=(((da.lon + 180) % 360) - 180)).sortby("lon")
        lat, lon = target_grid()
        out = da.interp(lat=lat, lon=lon).load()
        ds.close()
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)   # discard raw, always


def reduce_scenario(variable, scenario, models=ENSEMBLE, decades=DECADES):
    lat, lon = target_grid()
    is_ratio = variable in RATIO_VARS
    # accumulate per-decade stacks of model deltas
    stacks = {d: [] for d in decades}
    for model in models:
        base = fetch_climatology(model, "historical", variable, BASELINE)
        if base is None:
            print(f"  [skip] {model}: no historical baseline", flush=True)
            continue
        for d in decades:
            yrs = [y for y in range(d - WINDOW, d + WINDOW + 1) if 2015 <= y <= 2100]
            fut = fetch_climatology(model, scenario, variable, yrs)
            if fut is None:
                print(f"  [gap] {model} {scenario} {d}: no data", flush=True)
                continue
            delta = (fut / base - 1.0) * 100.0 if is_ratio else (fut - base)
            stacks[d].append(delta.values.astype("float32"))
        print(f"  [ok] {model}", flush=True)

    decs, means, stds, ns = [], [], [], []
    for d in decades:
        s = stacks[d]
        if not s:
            continue
        arr = np.stack(s)                         # (n_models, lat, lon)
        decs.append(d)
        means.append(np.nanmean(arr, axis=0))
        stds.append(np.nanstd(arr, axis=0))
        ns.append(len(s))
    if not decs:
        print(f"  [empty] {variable} {scenario}: no usable data", flush=True)
        return None

    ds = xr.Dataset(
        {
            "delta_mean": (("decade", "lat", "lon"), np.stack(means)),
            "delta_std": (("decade", "lat", "lon"), np.stack(stds)),
            "n_models": (("decade",), np.array(ns, dtype="int16")),
        },
        coords={"decade": decs, "lat": lat, "lon": lon},
    )
    ds.attrs.update(variable=variable, scenario=scenario, baseline="1995-2014",
                    units="percent" if is_ratio else "absolute",
                    method="delta vs 1995-2014; ensemble mean/std")
    return ds


def save(ds, path):
    enc = {}
    for v in ("delta_mean", "delta_std"):
        enc[v] = {"dtype": "int16", "scale_factor": 0.01, "_FillValue": -32768, "zlib": True, "complevel": 5}
    tmp = path + ".tmp"
    ds.to_netcdf(tmp, encoding=enc)
    os.replace(tmp, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    test = "--test" in sys.argv
    variables = ["near_surface_air_temperature"] if test else VARIABLES
    scenarios = ["ssp2_4_5"] if test else SCENARIOS
    models = ENSEMBLE[:2] if test else ENSEMBLE
    decades = [2050] if test else DECADES
    for variable in variables:
        for scenario in scenarios:
            short = variable.replace("near_surface_", "").replace("_", "-")
            path = os.path.join(OUT, f"{short}__{scenario}.nc")
            if os.path.exists(path) and not test:
                print(f"[have] {path}", flush=True); continue
            print(f"[run] {variable} {scenario}", flush=True)
            try:
                ds = reduce_scenario(variable, scenario, models=models, decades=decades)
                if ds is not None:
                    save(ds, path)
                    sz = os.path.getsize(path)
                    print(f"[done] {path} ({sz/1024:.0f} KB)", flush=True)
            except Exception:
                print(f"[ERROR] {variable} {scenario}\n{traceback.format_exc()}", flush=True)


if __name__ == "__main__":
    main()
