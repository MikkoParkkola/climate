#!/usr/bin/env python3
"""
fetch_extremes.py — the juicer, for climate-extreme indices (risk layer).

Source: CDS "sis-extreme-indices-cmip6" — ETCCDI climate-extreme indices derived
from CMIP6. Risk depends on EXTREMES, not means, so heat/drought/flood indices
come from real extreme statistics, not from our decadal-mean grids. Each index is
a published ETCCDI definition (cited), no magic constants.

Indices fetched (all base-independent, annual), grouped by the risk they feed:
  heat:    TXx   (maximum_value_of_daily_maximum_temperature) — hottest day, degC
           TR    (tropical_nights) — nights >20degC, count/yr (no nighttime relief)
  drought: CDD   (consecutive_dry_days) — longest dry spell, days/yr
  flood:   Rx5day(maximum_5_day_precipitation) — heaviest 5-day total, mm
           R20mm (very_heavy_precipitation_days) — days >=20mm, count/yr

Output (per variable+scenario): out/extreme-<short>__<scenario>.nc
  dims (decade, lat, lon); vars delta_mean, delta_std, n_models  (change vs 1995-2014)
  Same juicer as fetch_reduce.py: download -> reduce to a change field -> delete raw.

Coverage notes (logged, no silent caps):
  - This dataset has NO ssp1_1_9; risk indices cover ssp126/245/370/585 only.
  - Annual indices: one future file (2015-2100) + one historical file (1951-2014)
    per (model, index) — far fewer requests than the monthly main batch.
  - ensemble_member fixed to r1i1p1f1; models needing f2/f3 variants are skipped
    and logged (a gap stays a gap).

Heavy I/O — run on Spark, never Replit/Mac. CPU-light (numpy/xarray/scipy).
"""
import os, sys, glob, zipfile, tempfile, shutil, traceback, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import xarray as xr
import cdsapi

DATASET = "sis-extreme-indices-cmip6"

# CDS index id -> short code used in filenames; risk group in comments.
INDICES = {
    "maximum_value_of_daily_maximum_temperature": "txx",     # heat
    "tropical_nights": "tr",                                  # heat
    "consecutive_dry_days": "cdd",                            # drought
    "maximum_5_day_precipitation": "rx5day",                  # flood
    "very_heavy_precipitation_days": "r20mm",                 # flood
}
# Model -> valid ensemble-member variant for this dataset (from CDS constraints,
# base_independent/yearly/v2_0). Most use r1i1p1f1; cnrm/ukesm use the f2 forcing.
MODEL_VARIANT = {
    "access_cm2": "r1i1p1f1", "access_esm1_5": "r1i1p1f1", "ec_earth3": "r1i1p1f1",
    "gfdl_esm4": "r1i1p1f1", "miroc6": "r1i1p1f1", "mri_esm2_0": "r1i1p1f1",
    "noresm2_lm": "r1i1p1f1", "noresm2_mm": "r1i1p1f1",
    "cnrm_cm6_1": "r1i1p1f2", "ukesm1_0_ll": "r1i1p1f2",
}
ENSEMBLE = list(MODEL_VARIANT)
SCENARIOS = ["ssp1_2_6", "ssp2_4_5", "ssp3_7_0", "ssp5_8_5"]   # no ssp1_1_9 here
HIST_PERIOD = "1850_2014"
FUT_PERIOD = "2015_2100"

BASELINE = list(range(1995, 2015))
DECADES = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
WINDOW = 5

OUT = os.path.join(os.path.dirname(__file__), "out")
GRID_RES = 1.0
MAX_CONCURRENT = int(os.environ.get("CDS_CONCURRENCY", "3"))

_local = threading.local()
def client():
    c = getattr(_local, "client", None)
    if c is None:
        c = _local.client = cdsapi.Client()
    return c

_hdf5_lock = threading.Lock()          # HDF5/netCDF4 not thread-safe; serialize reads
_baseline_cache, _baseline_lock = {}, threading.Lock()


def target_grid():
    half = GRID_RES / 2
    lat = np.arange(-90 + half, 90, GRID_RES)
    lon = np.arange(-180 + half, 180, GRID_RES)
    return lat, lon


def _main_var(ds):
    cands = [v for v in ds.data_vars if not v.endswith("_bnds") and "bnds" not in v]
    return max(cands, key=lambda v: ds[v].ndim)


def fetch_index(model, experiment, index, period):
    """Download one annual extreme-index file (covers the whole period) and return
    an annual-resolved (time,lat,lon) DataArray on the common grid, or None if the
    model/experiment/variant combo has no data. Deletes the raw download."""
    tmp = tempfile.mkdtemp(prefix="ext_", dir=OUT)
    zpath = os.path.join(tmp, "d.zip")
    try:
        req = {
            "variable": index,
            "product_type": "base_independent",
            "model": model,
            "ensemble_member": MODEL_VARIANT[model],
            "experiment": experiment,
            "temporal_aggregation": "yearly",
            "period": period,
            "version": "2_0",
        }
        try:
            client().retrieve(DATASET, req, zpath)
        except Exception as e:
            msg = str(e).lower()
            if any(k in msg for k in ("no data", "not found", "invalid", "no matching")):
                return None
            raise
        try:
            zipfile.ZipFile(zpath).extractall(tmp)
        except zipfile.BadZipFile:
            os.replace(zpath, os.path.join(tmp, "d.nc"))
        ncs = glob.glob(os.path.join(tmp, "*.nc"))
        if not ncs:
            return None
        with _hdf5_lock:
            ds = xr.open_mfdataset(ncs, combine="by_coords") if len(ncs) > 1 else xr.open_dataset(ncs[0])
            da = ds[_main_var(ds)]
            if "time" in da.dims:
                da = da.assign_coords(year=("time", da["time"].dt.year.values))
            if float(da.lon.max()) > 180:
                da = da.assign_coords(lon=(((da.lon + 180) % 360) - 180)).sortby("lon")
            lat, lon = target_grid()
            out = da.interp(lat=lat, lon=lon).load()
            ds.close()
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _years_mean(da, years):
    """Mean over the given calendar years of an annual (time,...) DataArray."""
    yr = da["year"].values if "year" in da.coords else None
    if yr is None:
        return da.mean("time")
    mask = np.isin(yr, years)
    if not mask.any():
        return None
    return da.isel(time=np.where(mask)[0]).mean("time")


def get_baseline(model, index):
    key = (model, index)
    with _baseline_lock:
        if key in _baseline_cache:
            return _baseline_cache[key]
    da = fetch_index(model, "historical", index, HIST_PERIOD)
    base = None if da is None else _years_mean(da, BASELINE)
    with _baseline_lock:
        _baseline_cache[key] = base
    return base


def reduce_scenario(index, scenario, models=ENSEMBLE):
    lat, lon = target_grid()
    bases = {}
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as ex:
        futs = {ex.submit(get_baseline, m, index): m for m in models}
        for f in as_completed(futs):
            m = futs[f]
            try:
                bases[m] = f.result()
            except Exception:
                print(f"  [skip] {m}: baseline error\n{traceback.format_exc()}", flush=True)
                bases[m] = None
    usable = [m for m in models if bases.get(m) is not None]
    for m in models:
        if bases.get(m) is None:
            print(f"  [skip] {m}: no historical baseline for {index}", flush=True)

    futures = {}
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as ex:
        for m in usable:
            futures[ex.submit(fetch_index, m, scenario, index, FUT_PERIOD)] = m
        fut_by_model = {}
        for f in as_completed(futures):
            m = futures[f]
            try:
                fut_by_model[m] = f.result()
            except Exception:
                print(f"  [gap] {m} {scenario} {index}: error", flush=True)
                fut_by_model[m] = None

    stacks = {d: [] for d in DECADES}
    for m in usable:
        fut = fut_by_model.get(m)
        if fut is None:
            print(f"  [gap] {m} {scenario} {index}: no future data", flush=True)
            continue
        for d in DECADES:
            yrs = [y for y in range(d - WINDOW, d + WINDOW + 1) if 2015 <= y <= 2100]
            fmean = _years_mean(fut, yrs)
            if fmean is None:
                continue
            delta = (fmean - bases[m]).values.astype("float32")
            stacks[d].append(delta)

    decs, means, stds, ns = [], [], [], []
    for d in DECADES:
        s = stacks[d]
        if not s:
            continue
        arr = np.stack(s)
        decs.append(d); means.append(np.nanmean(arr, axis=0))
        stds.append(np.nanstd(arr, axis=0)); ns.append(len(s))
    if not decs:
        print(f"  [empty] {index} {scenario}: no usable data", flush=True)
        return None

    ds = xr.Dataset(
        {
            "delta_mean": (("decade", "lat", "lon"), np.stack(means)),
            "delta_std": (("decade", "lat", "lon"), np.stack(stds)),
            "n_models": (("decade",), np.array(ns, dtype="int16")),
        },
        coords={"decade": decs, "lat": lat, "lon": lon},
    )
    ds.attrs.update(index=index, scenario=scenario, baseline="1995-2014",
                    units="index-units (change vs baseline)",
                    source="CDS sis-extreme-indices-cmip6 (ETCCDI, base-independent, annual)",
                    method="annual ETCCDI index, decade mean delta vs 1995-2014; ensemble mean/std")
    return ds


def save(ds, path):
    enc = {v: {"dtype": "int16", "scale_factor": 0.01, "_FillValue": -32768,
               "zlib": True, "complevel": 5} for v in ("delta_mean", "delta_std")}
    tmp = path + ".tmp"
    ds.to_netcdf(tmp, encoding=enc)
    os.replace(tmp, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    test = "--test" in sys.argv
    indices = {"consecutive_dry_days": "cdd"} if test else INDICES
    scenarios = ["ssp2_4_5"] if test else SCENARIOS
    models = ENSEMBLE[:1] if test else ENSEMBLE
    for index, short in indices.items():
        for scenario in scenarios:
            path = os.path.join(OUT, f"extreme-{short}__{scenario}.nc")
            if os.path.exists(path) and not test:
                print(f"[have] {path}", flush=True); continue
            print(f"[run] {index} {scenario}", flush=True)
            try:
                ds = reduce_scenario(index, scenario, models=models)
                if ds is not None:
                    save(ds, path)
                    print(f"[done] {path} ({os.path.getsize(path)/1024:.0f} KB)", flush=True)
            except Exception:
                print(f"[ERROR] {index} {scenario}\n{traceback.format_exc()}", flush=True)


if __name__ == "__main__":
    main()
