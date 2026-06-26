#!/usr/bin/env python3
"""
fetch_sealevel.py — reduce IPCC AR6 regional sea-level projections to our grid.

Source: IPCC AR6 Sea Level Projections, Garner et al. 2021, Zenodo 5914710
        (DOI 10.5281/zenodo.5914710), file ar6-regional-confidence.zip.
        Regional RELATIVE sea level, *medium confidence*, WITH the AR6 background
        land-process rates (vertical land motion) — the number a person standing
        on a specific coast actually experiences. Component "total".

Why "total" + regional + VLM: relative (not global-mean) sea level is what floods
a coast; land subsidence/uplift can dominate locally (e.g. Jakarta vs a stable
craton differ by meters). We keep the headline median plus the 17th/83rd
percentiles (AR6 "likely" range) — never a bare number without its uncertainty.

Method (same juicer as fetch_reduce.py): the AR6 archive is downloaded + unzipped
once (sealevel_raw/), we read only the per-scenario "total" files, pull the median
+ likely range at our decade anchors, and regrid the AR6 point locations onto the
common 1-degree grid. Output is tiny; the raw archive can be deleted after.

Output (per scenario): out/sealevel__<scenario>.nc
  dims (decade, lat, lon); vars rise_median, rise_low, rise_high  (metres vs 2005)
  int16-quantized + zlib (cm precision via scale_factor).

AR6 baseline is 1995-2014 (epoch ~2005); we keep that as-is and document it — the
serving layer states the reference year. NaN where AR6 has no location (open
ocean far from the gridded coastal product) — a gap stays a gap.

Heavy I/O — run on Spark, never Replit/Mac. Reducing is CPU-light (numpy/scipy).
"""
import os, sys, glob, traceback
import numpy as np
import xarray as xr
from scipy.interpolate import griddata
from scipy.spatial import cKDTree

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out")
RAW = os.path.join(HERE, "sealevel_raw")   # where ar6-regional-confidence.zip is unzipped

# CDS-style scenario id used across the pipeline -> AR6 file scenario token.
SCENARIO_TOKEN = {
    "ssp1_1_9": "ssp119", "ssp1_2_6": "ssp126", "ssp2_4_5": "ssp245",
    "ssp3_7_0": "ssp370", "ssp5_8_5": "ssp585",
}
DECADES = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
GRID_RES = 1.0
# AR6 likely range = 17th-83rd percentile; median = 50th.
Q_MED, Q_LOW, Q_HIGH = 0.5, 0.17, 0.83


def target_grid():
    half = GRID_RES / 2
    lat = np.arange(-90 + half, 90, GRID_RES)
    lon = np.arange(-180 + half, 180, GRID_RES)
    return lat, lon


def find_total_file(token):
    """Locate the 'total' medium-confidence regional file for a scenario inside the
    unzipped AR6 archive. Glob-based so the exact archive nesting doesn't matter."""
    # Want the projection MAGNITUDES ("values"), not the per-year "rates" sibling,
    # at medium confidence. tlim* (temperature-target) dirs are excluded by the
    # ssp-specific token.
    pats = [
        f"**/medium_confidence/{token}/total_{token}_medium_confidence_values.nc",
        f"**/total_{token}_medium_confidence_values.nc",
        f"**/*total*{token}*medium_confidence*values*.nc",
    ]
    for p in pats:
        hits = [h for h in sorted(glob.glob(os.path.join(RAW, p), recursive=True))
                if "rates" not in os.path.basename(h)]
        if hits:
            return hits[0]
    return None


def _coord(ds, *names):
    for n in names:
        if n in ds.variables or n in ds.coords:
            return ds[n]
    return None


def _main_var(ds):
    """The sea-level data variable: 'sea_level_change' if present, else the
    largest-dims non-bounds data var."""
    if "sea_level_change" in ds.data_vars:
        return "sea_level_change"
    cands = [v for v in ds.data_vars if "bnds" not in v and "bound" not in v]
    return max(cands, key=lambda v: ds[v].ndim)


def _to_metres(da):
    """AR6 regional files are in mm. Normalize to metres; pass through if already m."""
    units = str(da.attrs.get("units", "")).lower()
    if units in ("m", "metre", "meter", "metres", "meters"):
        return da
    return da / 1000.0  # default + explicit AR6 mm case


def reduce_scenario(cds_scn):
    token = SCENARIO_TOKEN[cds_scn]
    path = find_total_file(token)
    if path is None:
        print(f"  [gap] no AR6 total file for {token}", flush=True)
        return None
    ds = xr.open_dataset(path)
    var = _main_var(ds)
    da = _to_metres(ds[var])

    qc = _coord(ds, "quantiles", "quantile", "percentile")
    years = _coord(ds, "years", "year", "time")
    lat_pts = _coord(ds, "lat", "latitude")
    lon_pts = _coord(ds, "lon", "longitude")
    if any(x is None for x in (qc, years, lat_pts, lon_pts)):
        print(f"  [ERROR] {token}: missing coord(s) "
              f"q={qc is not None} y={years is not None} "
              f"lat={lat_pts is not None} lon={lon_pts is not None}", flush=True)
        ds.close()
        return None

    qv = np.asarray(qc.values, dtype=float)
    if qv.max() > 1.5:            # percentile 0..100 -> fraction
        qv = qv / 100.0

    def qsel(da_, qwant):
        i = int(np.argmin(np.abs(qv - qwant)))
        return da_.isel({qc.name: i})

    yv = np.asarray(years.values, dtype=float)
    lat_t, lon_t = target_grid()
    LON, LAT = np.meshgrid(lon_t, lat_t)        # (nlat, nlon)
    src_lat = np.asarray(lat_pts.values, dtype=float).ravel()
    src_lon = np.asarray(lon_pts.values, dtype=float).ravel()
    src_lon = ((src_lon + 180) % 360) - 180     # normalize to -180..180

    # AR6 gives sea level only at ~66k ocean/coastal locations. Interpolating onto a
    # full grid would smear values across continents — a confident inland sea-level
    # number is a lie (cardinal rule). Mask any grid cell with no AR6 source point
    # within ~1.5 deg (~165 km) so deep-inland cells stay NaN (= "not applicable").
    # ponytail: degree-space distance, anisotropic toward the poles but fine for a
    # coarse coastal/ocean mask; switch to haversine if pole accuracy ever matters.
    finite_src = np.isfinite(src_lat) & np.isfinite(src_lon)
    tree = cKDTree(np.column_stack([src_lon[finite_src], src_lat[finite_src]]))
    dist, _ = tree.query(np.column_stack([LON.ravel(), LAT.ravel()]))
    too_far = (dist.reshape(LON.shape) > 1.5)

    out = {k: [] for k in ("rise_median", "rise_low", "rise_high")}
    decs = []
    for d in DECADES:
        if d < yv.min() or d > yv.max():
            continue
        decs.append(d)
        for key, q in (("rise_median", Q_MED), ("rise_low", Q_LOW), ("rise_high", Q_HIGH)):
            sl = qsel(da, q)
            # interpolate decade in time, take point values, grid onto common grid
            vals = sl.interp({years.name: d}).values.ravel()
            ok = np.isfinite(vals)
            grid = griddata((src_lon[ok], src_lat[ok]), vals[ok], (LON, LAT),
                            method="linear")
            grid[too_far] = np.nan       # drop inland cells with no nearby AR6 data
            out[key].append(grid.astype("float32"))
    ds.close()
    if not decs:
        print(f"  [empty] {token}: no overlapping decades", flush=True)
        return None

    res = xr.Dataset(
        {k: (("decade", "lat", "lon"), np.stack(v)) for k, v in out.items()},
        coords={"decade": decs, "lat": lat_t, "lon": lon_t},
    )
    res.attrs.update(
        variable="relative_sea_level", scenario=token, units="m",
        reference="1995-2014 (epoch ~2005)", confidence="medium",
        range="median + 17th/83rd percentile (AR6 likely)",
        source="IPCC AR6 Sea Level Projections (Garner et al. 2021, Zenodo 5914710); "
               "FACTS; regional total RSL incl. background land motion",
        method="AR6 regional quantiles, decade-interpolated, regridded to 1deg",
    )
    return res


def save(ds, path):
    enc = {v: {"dtype": "int16", "scale_factor": 0.01, "_FillValue": -32768,
               "zlib": True, "complevel": 5} for v in ds.data_vars}
    tmp = path + ".tmp"
    ds.to_netcdf(tmp, encoding=enc)
    os.replace(tmp, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    if not os.path.isdir(RAW):
        sys.exit(f"raw AR6 dir not found: {RAW} — unzip ar6-regional-confidence.zip there first")
    for cds_scn in SCENARIO_TOKEN:
        path = os.path.join(OUT, f"sealevel__{cds_scn}.nc")
        if os.path.exists(path):
            print(f"[have] {path}", flush=True); continue
        print(f"[run] sealevel {cds_scn}", flush=True)
        try:
            ds = reduce_scenario(cds_scn)
            if ds is not None:
                save(ds, path)
                print(f"[done] {path} ({os.path.getsize(path)/1024:.0f} KB)", flush=True)
        except Exception:
            print(f"[ERROR] sealevel {cds_scn}\n{traceback.format_exc()}", flush=True)


if __name__ == "__main__":
    main()
