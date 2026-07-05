#!/usr/bin/env python3
"""Build the grounded AMOC-collapse impact artifact from the NAHosMIP hosing ensemble.

Source: NAHosMIP (North Atlantic Hosing Model Intercomparison) on the CEDA Archive.
  Catalogue: https://catalogue.ceda.ac.uk/uuid/07bc349e42f94117b83e6f8289834eb7
  Data tree: https://dap.ceda.ac.uk/badc/nahosmip/data/
  Licence:   CC-BY-SA-4.0 (public; commercial reuse + redistribution OK with
             attribution + share-alike). See
             https://dap.ceda.ac.uk/badc/nahosmip/00README_catalogue_and_licence.txt
  Design:    Jackson et al. 2023, Geosci. Model Dev., doi:10.5194/gmd-16-1975-2023.

Experiment `u03-hos` = 0.3 Sv North Atlantic freshwater hosing that drives an AMOC
collapse. Of the 8 NAHosMIP models, three publish the full tas/pr/zos/psl set for
u03-hos on CEDA (verified 2026-06-29): EC-Earth3, HadGEM3-GC31-LL, HadGEM3-GC31-MM.

Method (see also data/amoc-collapse.json `method`): per model the collapse-tail anomaly
is the mean of the LAST 30 years of the hosing run (collapsed AMOC state) minus the mean
of the FIRST 20 years (pre-collapse, near-control state) of the SAME run. This is
self-contained in the CC-BY-SA NAHosMIP dataset (no piControl / ESGF dependency) and is
CONSERVATIVE: because hosing forcing starts at year 0, an early-years baseline understates
the full anomaly. zos (dynamic sea level) has its global ocean-area mean removed to isolate
the regional pattern. Fields are regridded to a common 1-degree grid, then reduced to the
multi-model MEAN and across-model SPREAD (standard deviation). Cells with fewer than two
models are left empty (NODATA) — no fabricated fill.

This is a *regeneration* script, not part of `npm run ci`. It needs build-time-only Python
deps that are NOT app runtime deps:  pip install xarray netCDF4 numpy scipy dask
Heavy I/O (~5 GB of NetCDF); intended to run on a compute host, not in CI.

What it produces (committed to data/):
  data/amoc-collapse.i16.gz   gzipped little-endian Int16 layer stack (9 layers x 180 x 360)
  data/amoc-collapse.json     manifest: grid, layers (name/unit/scale), models, method, caveats
"""
from __future__ import annotations

import glob
import gzip
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import xarray as xr
from scipy.interpolate import griddata
from scipy.spatial import cKDTree

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".nahosmip-build"
RAW = BUILD_DIR / "raw"

CEDA = "https://dap.ceda.ac.uk/badc/nahosmip/data/post-cmip6/NAHosMIP"

# Per-model download URLs (only tas/pr/psl in Amon, zos in Omon for u03-hos) and the
# baseline (first 20 yr) and collapsed (last 30 yr) windows, selected by time-coordinate
# year so file gaps (HadGEM3-GC31-MM is fetched non-contiguously) are handled safely.
MODELS = {
    "EC-Earth3": {
        "base": (1850, 1869), "coll": (1920, 1949),
        "files": {
            "tas": [f"{CEDA}/EC-Earth-Consortium/EC-Earth3/u03-hos/r1i1p1f1/Amon/tas/gr/v202501/tas_Amon_EC-Earth3_hos-u03-hos_185001-194912.nc"],
            "pr":  [f"{CEDA}/EC-Earth-Consortium/EC-Earth3/u03-hos/r1i1p1f1/Amon/pr/gr/v202501/pr_Amon_EC-Earth3_hos-u03-hos_185001-194912.nc"],
            "psl": [f"{CEDA}/EC-Earth-Consortium/EC-Earth3/u03-hos/r1i1p1f1/Amon/psl/gr/v202501/psl_Amon_EC-Earth3_hos-u03-hos_185001-194912.nc"],
            "zos": [f"{CEDA}/EC-Earth-Consortium/EC-Earth3/u03-hos/r1i1p1f1/Omon/zos/gn/v202501/zos_Omon_EC-Earth3_hos-u03-hos_185001-194912.nc"],
        },
    },
    "HadGEM3-GC31-LL": {
        "base": (2050, 2069), "coll": (2120, 2149),
        "files": {
            "tas": [f"{CEDA}/Met-Office/HadGEM3-GC31-LL/u03-hos/r1i1p1f1/Amon/tas/gn/v202501/tas_Amon_HadGEM3-GC31-LL_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-209912", "210001-211312", "211401-214912"]],
            "pr":  [f"{CEDA}/Met-Office/HadGEM3-GC31-LL/u03-hos/r1i1p1f1/Amon/pr/gn/v202501/pr_Amon_HadGEM3-GC31-LL_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-209912", "210001-211312", "211401-214912"]],
            "psl": [f"{CEDA}/Met-Office/HadGEM3-GC31-LL/u03-hos/r1i1p1f1/Amon/psl/gn/v202501/psl_Amon_HadGEM3-GC31-LL_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-209912", "210001-211312", "211401-214912"]],
            "zos": [f"{CEDA}/Met-Office/HadGEM3-GC31-LL/u03-hos/r1i1p1f1/Omon/zos/gn/v202501/zos_Omon_HadGEM3-GC31-LL_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-211312", "211401-214912"]],
        },
    },
    "HadGEM3-GC31-MM": {
        "base": (2050, 2069), "coll": (2120, 2149),
        "files": {
            "tas": [f"{CEDA}/Met-Office/HadGEM3-GC31-MM/u03-hos/r1i1p1f1/Amon/tas/gn/v202501/tas_Amon_HadGEM3-GC31-MM_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-206912", "211001-212912", "213001-214912"]],
            "pr":  [f"{CEDA}/Met-Office/HadGEM3-GC31-MM/u03-hos/r1i1p1f1/Amon/pr/gn/v202501/pr_Amon_HadGEM3-GC31-MM_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-206912", "211001-212912", "213001-214912"]],
            "psl": [f"{CEDA}/Met-Office/HadGEM3-GC31-MM/u03-hos/r1i1p1f1/Amon/psl/gn/v202501/psl_Amon_HadGEM3-GC31-MM_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-206912", "211001-212912", "213001-214912"]],
            "zos": [f"{CEDA}/Met-Office/HadGEM3-GC31-MM/u03-hos/r1i1p1f1/Omon/zos/gn/v202501/zos_Omon_HadGEM3-GC31-MM_u03-hos_r1i1p1f1_gn_{p}.nc" for p in ["205001-206912", "211001-212912", "213001-214912"]],
        },
    },
}

# Common 1-degree target grid, row-major, first row at +89.5 decreasing south.
NLAT, NLON = 180, 360
DLAT = DLON = 1.0
LAT0, LON0 = 89.5, -179.5
NODATA = -32768
TLAT = LAT0 - np.arange(NLAT) * DLAT
TLON = LON0 + np.arange(NLON) * DLON
TLON2D, TLAT2D = np.meshgrid(TLON, TLAT)

SOURCE_ID = "nahosmip-amoc-collapse-v1"
ARTIFACT_VERSION = "nahosmip-u03-hos-collapse-anomaly-v1"


def log(m: str) -> None:
    print(m, flush=True)


def ensure_downloads() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for model, cfg in MODELS.items():
        for var, urls in cfg["files"].items():
            for url in urls:
                dest = RAW / Path(url).name
                if dest.exists() and dest.stat().st_size > 0:
                    continue
                log(f"downloading {dest.name} ...")
                urllib.request.urlretrieve(url, dest)  # noqa: S310 (vetted https CEDA source)


def window_mean(ds, vname, y0, y1):
    yr = ds["time"].dt.year.values
    idx = np.nonzero((yr >= y0) & (yr <= y1))[0]
    if idx.size == 0:
        raise RuntimeError(f"no months in {y0}-{y1}")
    return ds[vname].isel(time=idx).mean("time")


def to_m180(da):
    lon = ((da["lon"].values + 180) % 360) - 180
    return da.assign_coords(lon=lon).sortby("lon")


def regrid_atmos(da):
    return to_m180(da).interp(lat=TLAT, lon=TLON, method="linear").values


def area_mean(field2d, lat2d):
    w = np.cos(np.deg2rad(lat2d))
    m = np.isfinite(field2d)
    return float(np.sum(field2d[m] * w[m]) / np.sum(w[m]))


def regrid_curvi(anom2d, lat2d, lon2d, max_deg=1.5):
    lon2d = ((lon2d + 180) % 360) - 180
    fin = np.isfinite(anom2d)
    pts = np.column_stack([lon2d[fin].ravel(), lat2d[fin].ravel()])
    val = anom2d[fin].ravel()
    for shift in (-360.0, 360.0):  # periodic continuity across the dateline
        edge = np.abs(pts[:, 0]) > 150
        pts = np.vstack([pts, np.column_stack([pts[edge, 0] + shift, pts[edge, 1]])])
        val = np.concatenate([val, val[edge]])
    g = griddata(pts, val, (TLON2D, TLAT2D), method="linear")
    # Mask cells far from any ocean source point so the global-ocean convex hull does not
    # bleed dynamic sea level onto deep land. Coastal land cells (within ~max_deg of ocean)
    # keep the adjacent ocean value; deep interior becomes NaN -> NODATA (never fabricated).
    dist, _ = cKDTree(pts).query(np.column_stack([TLON2D.ravel(), TLAT2D.ravel()]))
    flat = g.ravel()
    flat[dist > max_deg] = np.nan
    return flat.reshape(g.shape)


def files_for(var, model):
    return sorted(str(RAW / Path(u).name) for u in MODELS[model]["files"][var])


def reduce_var(var, conv):
    res = {}
    for model, cfg in MODELS.items():
        try:
            ds = xr.open_mfdataset(files_for(var, model), combine="by_coords", use_cftime=True)
            base = window_mean(ds, var, *cfg["base"]).load()
            coll = window_mean(ds, var, *cfg["coll"]).load()
            anom = coll - base
            if var == "zos":
                lat2d = (ds["latitude"] if "latitude" in ds else ds["lat"]).values
                lon2d = (ds["longitude"] if "longitude" in ds else ds["lon"]).values
                a = anom.values
                if lat2d.ndim == 1:
                    lon2d, lat2d = np.meshgrid(lon2d, lat2d)
                a = a - area_mean(a, lat2d)
                g = regrid_curvi(a, lat2d, lon2d) * 100.0  # m -> cm
            else:
                g = conv(regrid_atmos(anom))
            res[model] = g
            ds.close()
            log(f"  {var} {model}: ok")
        except Exception as e:  # noqa: BLE001 partial-but-correct: skip a failing model/var
            log(f"  {var} {model}: FAIL {e}")
    return res


def pr_percent(pr_mmday):
    out = {}
    for model, cfg in MODELS.items():
        if model not in pr_mmday:
            continue
        ds = xr.open_mfdataset(files_for("pr", model), combine="by_coords", use_cftime=True)
        baseg = regrid_atmos(window_mean(ds, "pr", *cfg["base"]).load() * 86400.0)
        with np.errstate(invalid="ignore", divide="ignore"):
            out[model] = np.where(baseg > 0.05, pr_mmday[model] / baseg * 100.0, np.nan)
        ds.close()
    return out


def stack_mean_spread(res):
    if not res:
        return None, None
    arr = np.stack(list(res.values()))
    cnt = np.sum(np.isfinite(arr), axis=0)
    with np.errstate(invalid="ignore"):
        mean = np.nanmean(arr, axis=0)
        spread = np.nanstd(arr, axis=0)
    mean[cnt < 2] = np.nan
    spread[cnt < 2] = np.nan
    return mean, spread


def pack(field, scale):
    out = np.full((NLAT, NLON), NODATA, dtype=np.int16)
    if field is None:
        return out
    m = np.isfinite(field)
    out[m] = np.clip(np.round(field[m] * scale), -32767, 32767).astype(np.int16)
    return out


def main() -> None:
    t0 = time.time()
    ensure_downloads()
    tas = reduce_var("tas", lambda g: g)               # K diff == degC
    pr_mmday = reduce_var("pr", lambda g: g * 86400.0)  # mm/day
    psl = reduce_var("psl", lambda g: g / 100.0)        # Pa -> hPa
    zos = reduce_var("zos", None)                        # cm, handled inside
    prp = pr_percent(pr_mmday)

    tas_m, tas_s = stack_mean_spread(tas)
    pr_m, pr_s = stack_mean_spread(pr_mmday)
    prp_m, _ = stack_mean_spread(prp)
    zos_m, zos_s = stack_mean_spread(zos)
    psl_m, psl_s = stack_mean_spread(psl)

    layers = [
        ("tas_mean", "degC", 100, tas_m), ("tas_spread", "degC", 100, tas_s),
        ("pr_mean", "mm/day", 100, pr_m), ("pr_pct", "%", 10, prp_m), ("pr_spread", "mm/day", 100, pr_s),
        ("zos_mean", "cm", 10, zos_m), ("zos_spread", "cm", 10, zos_s),
        ("psl_mean", "hPa", 100, psl_m), ("psl_spread", "hPa", 100, psl_s),
    ]
    blob = bytearray()
    meta_layers = []
    for i, (name, unit, scale, field) in enumerate(layers):
        blob += pack(field, scale).tobytes(order="C")
        meta_layers.append({"name": name, "unit": unit, "scale": scale, "index": i})

    raster_path = REPO / "data" / "amoc-collapse.i16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(bytes(blob))
    log(f"wrote {raster_path.relative_to(REPO)} ({len(blob)} bytes raw)")

    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "NAHosMIP (North Atlantic Hosing Model Intercomparison)",
        "experiment": "u03-hos: 0.3 Sv North Atlantic freshwater hosing (AMOC-collapse driver)",
        "license": "CC-BY-SA-4.0",
        "licenseText": "NAHosMIP data are released under CC-BY-SA-4.0 (attribution + share-alike).",
        "attribution": (
            "AMOC-collapse impact profile: NAHosMIP 0.3 Sv hosing ensemble "
            "(Jackson et al. 2023, Geosci. Model Dev., doi:10.5194/gmd-16-1975-2023), "
            "models EC-Earth3, HadGEM3-GC31-LL, HadGEM3-GC31-MM. Licensed CC-BY-SA-4.0."
        ),
        "stableUrl": "https://catalogue.ceda.ac.uk/uuid/07bc349e42f94117b83e6f8289834eb7",
        "doi": "10.5194/gmd-16-1975-2023",
        "models": list(MODELS.keys()),
        "modelCount": len(MODELS),
        "baselineWindowYears": 20,
        "collapsedWindowYears": 30,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "grid": {
            "file": "amoc-collapse.i16.gz", "encoding": "gzip+int16le", "nodata": NODATA,
            "nlat": NLAT, "nlon": NLON, "dlat": DLAT, "dlon": DLON, "lat0": LAT0, "lon0": LON0,
            "order": "row-major; row 0 at +89.5 decreasing south; col 0 at -179.5 increasing east",
        },
        "layers": meta_layers,
        "method": (
            "Per model, the collapse-tail anomaly is the mean of the last 30 years of the u03-hos "
            "hosing run (collapsed AMOC state) minus the mean of the first 20 years (pre-collapse, "
            "near-control state), regridded to a 1-degree grid. zos (dynamic sea level) has its "
            "global ocean-area mean removed to isolate the regional pattern. Values are the "
            "multi-model MEAN across the available models; spread is the across-model standard "
            "deviation. Cells with fewer than 2 models are left empty (no fabricated fill)."
        ),
        "caveats": [
            "This is the LOW-PROBABILITY, HIGH-IMPACT AMOC-collapse tail, NOT the central forecast and NOT tied to any single SSP or calendar year.",
            "Baseline is the first 20 years of the hosing run (not piControl); because freshwater forcing begins at year 0, this conservatively UNDERSTATES the full collapse anomaly.",
            "Idealised 0.3 Sv hosing experiments designed to force collapse (Jackson et al. 2023); they bound the response pattern, not its real-world probability or timing.",
            "Only models publishing tas/pr/zos/psl for u03-hos on CEDA are included (EC-Earth3, HadGEM3-GC31-LL, HadGEM3-GC31-MM); a 3-model ensemble, so the spread is indicative not exhaustive.",
            "Regridded to 1 degree; coastal sea-level and small-scale features are smoothed.",
        ],
    }
    manifest_path = REPO / "data" / "amoc-collapse.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    log(f"wrote {manifest_path.relative_to(REPO)}")
    log(f"done in {round(time.time() - t0, 1)}s")


if __name__ == "__main__":
    main()
