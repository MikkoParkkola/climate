#!/usr/bin/env python3
"""Build the grounded NASA NEX-GDDP-CMIP6 enrichment artifact (closes three gaps).

Source: NASA NCCS Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6).
  DOI:     10.7917/OFSG3345
  Bucket:  s3://nex-gddp-cmip6  (AWS Open Data; public, no credentials)
  License: CC0 1.0 Universal Public Domain Dedication (blanket, AWS Open Data registry).
  Data:    daily tas/tasmax/tasmin/hurs, 0.25 deg (~25 km), 1950-2100, all 4 SSPs.

This is a *regeneration* script, NOT part of `npm run ci`. Build-time-only deps:
  pip install xarray netCDF4 numpy   (h5netcdf optional)

One representative model (ACCESS-CM2, r1i1p1f1) is reduced — NEX-GDDP ships per-model files
(no published ensemble mean), and the full archive is tens of TB, so a single complete model is
the disciplined choice for a regional screen. One streaming pass over the daily files yields all
three signals' indices, packed into the int16 grid format the Node engine already reads.

Indices (per cell x scenario x 10yr-window, window-mean per year unless noted):
  humid_heat:   tw_gt28 / tw_gt31 / tw_gt35 = days/yr with daily-mean wet-bulb above the
                threshold. Wet-bulb via Stull (2011), DOI 10.1175/JAMC-D-11-0143.1 (published
                formula, not invented), from daily tas + hurs.
  cold_season:  frost_days (tasmin<0), ice_days (tasmax<0), tnn (window-minimum tasmin, degC),
                cold_spell_days (days/yr inside runs of >=6 consecutive frost days). The first
                three are WMO ETCCDI indices; cold_spell_days is a fixed-threshold (0 degC, 6-day)
                cold-spell screen, NOT the percentile-based WMO CSDI (documented as such).
  infrastructure (degree-days): cdd18 / hdd18 = cooling / heating degree-days per yr, base 18 degC,
                from daily tas.

Streaming, resumable: each (scenario, window) reduces to .nex-build/parts/<scenario>_<window>.npz
and is skipped if already present, so a stalled run resumes without re-downloading. `pack` then
combines the parts into data/nex-gddp.{u16.gz,json}. Files are downloaded one at a time to a temp
path, read, then deleted (bounded disk).
"""
from __future__ import annotations

import gzip
import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import xarray as xr

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".nex-build"
PARTS = BUILD_DIR / "parts"
PARTS.mkdir(parents=True, exist_ok=True)

S3 = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com/"
NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"

MODEL = "ACCESS-CM2"
VARIANT = "r1i1p1f1"
GRID = "gn"

SOURCE_ID = "nasa-nex-gddp-cmip6-v1"
ARTIFACT_VERSION = "nex-gddp-cmip6-access-cm2-screen-v1"

# fupit ssp id -> NEX-GDDP scenario folder. All four are present (no nulls).
SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"]
# 5-year climatological windows. Absolute physical counts are stored (no anomaly), so no baseline
# reduction is needed. A short 5-year window (vs the 20-30 yr climate-normal ideal) is the
# disciplined choice given a ~5 MB/s single transatlantic S3 link; it is honest as a regional
# screen (see caveats) and lets a full all-SSP window land within budget.
WINDOWS = [("2030", 2028, 2032), ("2050", 2048, 2052), ("2080", 2078, 2082)]
WINDOW_LEN = "5-year"
# Concurrent per-year variable downloads: single-stream S3 over a transatlantic link is
# window-size-limited (~4 MB/s); fetching the four variables in parallel multiplies throughput.
DL_WORKERS = 4

# Indicator pack scheme. counts/degree-days store the rounded value directly (uint16, 0..65534);
# tnn stores round((degC + 100) * 100). fill = 65535 = ocean / no-data / window not built.
FILL = 65535
TNN_OFFSET = 100.0
TNN_SCALE = 100.0
INDICATORS = ["tw_gt28", "tw_gt31", "tw_gt35", "frost_days", "ice_days", "tnn", "cold_spell_days", "cdd18", "hdd18"]


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def list_year_keys(scenario: str, var: str) -> dict[int, str]:
    """year -> S3 key for a (scenario, var). historical files carry a _vN suffix."""
    prefix = f"NEX-GDDP-CMIP6/{MODEL}/{scenario}/{VARIANT}/{var}/"
    out: dict[int, str] = {}
    token = None
    while True:
        url = S3 + "?list-type=2&prefix=" + urllib.parse.quote(prefix) + "&max-keys=1000"
        if token:
            url += "&continuation-token=" + urllib.parse.quote(token)
        root = ET.fromstring(urllib.request.urlopen(url, timeout=60).read())
        for e in root.findall(NS + "Contents"):
            key = e.find(NS + "Key").text
            base = key.rsplit("/", 1)[-1]
            if not base.endswith(".nc"):
                continue
            # ..._gn_YYYY.nc  or  ..._gn_YYYY_v2.0.nc
            parts = base[:-3].split("_")
            yr = None
            for p in parts:
                if len(p) == 4 and p.isdigit():
                    yr = int(p)
            if yr is not None:
                out[yr] = key
        if root.find(NS + "IsTruncated").text == "true":
            token = root.find(NS + "NextContinuationToken").text
        else:
            break
    return out


def download(key: str, dst: Path) -> None:
    url = S3 + urllib.parse.quote(key)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                expected = int(r.headers.get("Content-Length", "0"))
                with open(dst, "wb") as fh:
                    while True:
                        chunk = r.read(1 << 20)
                        if not chunk:
                            break
                        fh.write(chunk)
            # guard against truncated/corrupt transfers (the HDF-error culprit)
            if expected and dst.stat().st_size != expected:
                raise IOError(f"size {dst.stat().st_size} != Content-Length {expected}")
            return
        except Exception as exc:  # noqa: BLE001
            log(f"  retry {attempt} for {key.rsplit('/',1)[-1]}: {exc}")
            dst.unlink(missing_ok=True)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"download failed: {key}")


def stull_wetbulb(t_c: np.ndarray, rh: np.ndarray) -> np.ndarray:
    """Stull (2011) wet-bulb approximation, degC. t_c in degC, rh in % (clipped to a valid range)."""
    rh = np.clip(rh, 1.0, 100.0)
    return (
        t_c * np.arctan(0.151977 * np.sqrt(rh + 8.313659))
        + np.arctan(t_c + rh)
        - np.arctan(rh - 1.676331)
        + 0.00391838 * np.power(rh, 1.5) * np.arctan(0.023101 * rh)
        - 4.686035
    )


def fetch_file(key: str, tmp: Path) -> Path:
    """Download one year-file to tmp (with integrity check + retry), return its path.
    Network-only; safe to call from worker threads (no HDF5 access here)."""
    dst = tmp / key.rsplit("/", 1)[-1]
    download(key, dst)
    return dst


def read_var(path: Path, var: str, key: str, tmp: Path) -> np.ndarray:
    """Open a downloaded netCDF (MAIN THREAD ONLY — HDF5 is not thread-safe) and return the daily
    array (time, lat, lon) as float32. Re-downloads once if the file is corrupt, then deletes it."""
    last: Exception | None = None
    for attempt in range(2):
        try:
            with xr.open_dataset(path) as ds:
                name = var if var in ds.data_vars else list(ds.data_vars)[0]
                arr = ds[name].values.astype(np.float32)
            path.unlink(missing_ok=True)
            return arr
        except Exception as exc:  # noqa: BLE001
            last = exc
            log(f"  reread {path.name} (attempt {attempt}): {exc}")
            path.unlink(missing_ok=True)
            if attempt == 0:
                download(key, path)
    raise RuntimeError(f"unreadable after retry: {key}: {last}")


def count_spell_days(frost: np.ndarray, min_run: int = 6) -> np.ndarray:
    """Per cell, count days that belong to a run of >= min_run consecutive frost days.
    frost: (time, lat, lon) boolean. Returns (lat, lon) int.

    runlen[d] = length of the consecutive-frost run ending at day d (forward pass). Then a
    backward pass propagates the run-end length to every day in the run, so `full[d]` is the
    full length of the run containing day d. A day is in a qualifying spell iff it is a frost
    day in a run of length >= min_run."""
    t = frost.shape[0]
    runlen = np.zeros(frost.shape, dtype=np.int32)
    run = np.zeros(frost.shape[1:], dtype=np.int32)
    for d in range(t):
        run = np.where(frost[d], run + 1, 0)
        runlen[d] = run
    full = np.zeros(frost.shape, dtype=np.int32)
    full[t - 1] = runlen[t - 1]
    for d in range(t - 2, -1, -1):
        # for a frost day mid-run, the full run length equals the next day's full length;
        # at a run end (next day not frost) it is this day's runlen.
        full[d] = np.where(frost[d + 1], full[d + 1], runlen[d]) * frost[d]
    spell_mask = frost & (full >= min_run)
    return spell_mask.sum(axis=0).astype(np.int32)


def reduce_window(scenario: str, label: str, y0: int, y1: int) -> None:
    out = PARTS / f"{scenario}_{label}.npz"
    if out.exists():
        log(f"skip {scenario}/{label} (exists)")
        return
    src_scen = "historical" if label == "baseline" else scenario
    keys = {v: list_year_keys(src_scen, v) for v in ("tas", "tasmax", "tasmin", "hurs")}
    years = [y for y in range(y0, y1 + 1) if all(y in keys[v] for v in keys)]
    if not years:
        log(f"WARN no complete years for {scenario}/{label}")
        return
    log(f"reduce {scenario}/{label}: {len(years)} yrs ({years[0]}-{years[-1]})")

    nyr = len(years)
    acc = None  # dict of accumulators, lazily shaped from first file
    tnn = None
    with tempfile.TemporaryDirectory(dir=BUILD_DIR) as td:
        tmp = Path(td)
        for yi, y in enumerate(years):
            # Download the four variables in parallel (network I/O), then open them sequentially
            # in this thread — HDF5/netCDF4 is NOT thread-safe, so reads must be serialized.
            with ThreadPoolExecutor(max_workers=DL_WORKERS) as ex:
                paths = {v: ex.submit(fetch_file, keys[v][y], tmp) for v in keys}
                pmap = {v: paths[v].result() for v in keys}
            tas = read_var(pmap["tas"], "tas", keys["tas"][y], tmp) - 273.15
            tasmax = read_var(pmap["tasmax"], "tasmax", keys["tasmax"][y], tmp) - 273.15
            tasmin = read_var(pmap["tasmin"], "tasmin", keys["tasmin"][y], tmp) - 273.15
            hurs = read_var(pmap["hurs"], "hurs", keys["hurs"][y], tmp)
            shape = tas.shape[1:]
            if acc is None:
                acc = {k: np.zeros(shape, np.float64) for k in INDICATORS if k != "tnn"}
                tnn = np.full(shape, np.inf, np.float64)
            tw = stull_wetbulb(tas, hurs)
            acc["tw_gt28"] += (tw > 28).sum(axis=0)
            acc["tw_gt31"] += (tw > 31).sum(axis=0)
            acc["tw_gt35"] += (tw > 35).sum(axis=0)
            frost = tasmin < 0
            acc["frost_days"] += frost.sum(axis=0)
            acc["ice_days"] += (tasmax < 0).sum(axis=0)
            acc["cold_spell_days"] += count_spell_days(frost)
            acc["cdd18"] += np.clip(tas - 18.0, 0, None).sum(axis=0)
            acc["hdd18"] += np.clip(18.0 - tas, 0, None).sum(axis=0)
            tnn = np.minimum(tnn, tasmin.min(axis=0))
            log(f"  {scenario}/{label} {y} done ({yi+1}/{nyr})")

    res = {k: (acc[k] / nyr).astype(np.float32) for k in acc}
    res["tnn"] = np.where(np.isfinite(tnn), tnn, np.nan).astype(np.float32)
    np.savez_compressed(out, **res)
    log(f"wrote {out.name}")


def load_grid_geom() -> dict:
    """Read lat/lon from one file to record exact grid geometry (orientation-agnostic)."""
    keys = list_year_keys("historical", "tas")
    y = sorted(keys)[0]
    with tempfile.TemporaryDirectory(dir=BUILD_DIR) as td:
        dst = Path(td) / "g.nc"
        download(keys[y], dst)
        with xr.open_dataset(dst) as ds:
            lat = ds["lat"].values.astype(float)
            lon = ds["lon"].values.astype(float)
    return {"lat": lat, "lon": lon}


def pack() -> None:
    geom = load_grid_geom()
    lat, lon = geom["lat"], geom["lon"]
    nlat, nlon = len(lat), len(lon)
    # store row 0 = northernmost; detect ascending lat and flip in the lookup via lat0/dlat sign.
    lat_asc = lat[1] > lat[0]
    dlat = abs(lat[1] - lat[0])
    dlon = abs(lon[1] - lon[0])
    lat0 = lat.max()  # northernmost cell centre; rows increase southward
    # lon: NEX-GDDP is 0..360; store lon0 and width so the lookup can wrap/shift.
    lon0 = lon.min()
    lon_is_360 = lon.max() > 180.0

    windows = WINDOWS
    cells = nlat * nlon
    layers = []
    raster = np.full(len(INDICATORS) * len(SCENARIOS) * len(windows) * cells, FILL, dtype=np.uint16)

    li = 0
    built = []
    for ind in INDICATORS:
        for scen in SCENARIOS:
            for (label, _y0, _y1) in windows:
                offset = li * cells
                part = PARTS / f"{scen}_{label}.npz"
                if part.exists():
                    with np.load(part) as z:
                        if ind in z:
                            field = z[ind].astype(np.float64)
                            if lat_asc:
                                field = field[::-1, :]  # flip so row 0 = north
                            flat = field.reshape(-1)
                            valid = np.isfinite(flat)
                            if ind == "tnn":
                                scaled = np.clip(np.round((flat + TNN_OFFSET) * TNN_SCALE), 0, FILL - 1)
                            else:
                                scaled = np.clip(np.round(flat), 0, FILL - 1)
                            cellslice = raster[offset:offset + cells]
                            cellslice[valid] = scaled[valid].astype(np.uint16)
                            built.append((scen, label))
                layers.append({"indicator": ind, "scenario": scen, "window": label, "offset": offset})
                li += 1

    matched = int((raster != FILL).sum())
    log(f"packed {li} layers; built parts: {sorted(set(built))}; non-fill {matched} ({100*matched/raster.size:.1f}%)")

    raster_path = REPO / "data" / "nex-gddp.u16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(raster.tobytes(order="C"))
    log(f"wrote {raster_path.name} ({raster_path.stat().st_size} bytes gz)")

    built_windows = sorted({lbl for (_s, lbl) in built})
    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "NASA NCCS Earth Exchange (NEX-GDDP-CMIP6)",
        "model": MODEL,
        "variant": VARIANT,
        "license": "cc0-1.0",
        "licenseText": (
            "CC0 1.0 Universal Public Domain Dedication. NEX-GDDP-CMIP6 is published as public "
            "domain on the AWS Open Data registry (s3://nex-gddp-cmip6); NASA requests citation "
            "as good practice. DOI 10.7917/OFSG3345."
        ),
        "attribution": (
            "Daily climate projections: NASA NEX-GDDP-CMIP6 (Thrasher et al.; NASA NCCS Earth "
            "Exchange), DOI 10.7917/OFSG3345, CC0 1.0. Wet-bulb via Stull (2011), DOI "
            "10.1175/JAMC-D-11-0143.1."
        ),
        "stableUrl": "https://doi.org/10.7917/OFSG3345",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "raster": {
            "file": "nex-gddp.u16.gz",
            "encoding": "gzip+uint16le",
            "fill": FILL,
            "tnnOffset": TNN_OFFSET,
            "tnnScale": TNN_SCALE,
            "nlat": int(nlat),
            "nlon": int(nlon),
            "dlat": float(dlat),
            "dlon": float(dlon),
            "lat0": float(lat0),
            "lon0": float(lon0),
            "lon360": bool(lon_is_360),
            "layerCells": int(cells),
            "order": "per-layer row-major; row 0 = northernmost; lon0 increasing east",
        },
        "indicators": INDICATORS,
        "scenarios": SCENARIOS,
        "windows": [w[0] for w in windows],
        "windowYears": {w[0]: f"{w[1]}-{w[2]}" for w in windows},
        "builtWindows": built_windows,
        "baselinePeriod": "absolute counts (no baseline anomaly)",
        "wetBulbThresholds": [28, 31, 35],
        "degreeDayBaseC": 18,
        "layers": layers,
        "method": (
            "NASA NEX-GDDP-CMIP6 daily downscaled projections (~25 km), single model "
            f"{MODEL}/{VARIANT}. Per scenario and {WINDOW_LEN} window: humid-heat exceedance days "
            "(daily-mean wet-bulb via Stull 2011 above 28/31/35 degC), ETCCDI cold indices "
            "(frost days, ice days, window-minimum tasmin) plus a fixed-threshold cold-spell "
            "screen, and base-18 degC cooling/heating degree-days, all as window-mean per year "
            "(tasmin minimum for TNn)."
        ),
        "caveats": [
            "~25 km downscaled CMIP6 projection; wet-bulb via the Stull (2011) approximation from "
            "daily-mean temperature and humidity - a regional humidity-heat screen, not measured "
            "WBGT (which also depends on sun and wind).",
            "Single representative model (ACCESS-CM2), not a multi-model ensemble; model spread is "
            "real and not shown here.",
            "Cold-spell days use a fixed 0 degC, 6-day-run threshold (a cold-spell screen), not the "
            "WMO percentile-based Cold Spell Duration Index.",
            "Degree-days use a base of 18 degC and daily mean temperature; real building energy use "
            "depends on local construction, behaviour, and equipment.",
            f"Counts are window-mean days per year over a {WINDOW_LEN} period; individual years vary.",
        ],
    }
    (REPO / "data" / "nex-gddp.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    log(f"wrote nex-gddp.json")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("reduce", "all"):
        # Window-major across all four SSPs so an early stall still yields a complete cross-scenario
        # product. Mid-century (2050) first, then end-century, then near-term.
        order = [w for label in ("2050", "2080", "2030") for w in WINDOWS if w[0] == label]
        for (label, y0, y1) in order:
            for scen in SCENARIOS:
                reduce_window(scen, label, y0, y1)
    if cmd in ("pack", "all"):
        pack()


if __name__ == "__main__":
    main()
