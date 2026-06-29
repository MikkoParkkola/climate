#!/usr/bin/env python3
"""Build the grounded Freshwater (water-stress) enrichment artifact from WRI Aqueduct 4.0.

Source: WRI Aqueduct 4.0 Current and Future Global Water Risk Atlas.
  Download: https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip
  Docs:     https://www.wri.org/data/aqueduct-global-maps-40-data (doi:10.46830/writn.23.00061)
  License:  Attribution-only. WRI verbatim: "The WRI datasets are available without
            restriction on use or distribution. WRI does request that the user give
            proper attribution." Commercial-safe with attribution.

This is a *regeneration* script, not part of `npm run ci`. It needs build-time-only
Python deps that are NOT app runtime deps:  pip install pyogrio shapely numpy

What it produces (committed to data/):
  data/freshwater-stress.aqueduct40.u16.gz   gzipped little-endian Uint16 basin-index raster
  data/freshwater-stress.aqueduct40.json      manifest: grid, legend, per-basin categories,
                                              scenario map, license, attribution, caveats

The raster stores, per 0.1-degree cell, the index (into manifest.basins) of the Aqueduct
HydroBASINS sub-basin whose polygon contains the cell centre, or NO_BASIN (65535) if none.
Point-in-polygon is done here at build time; runtime lookup is an O(1) grid index +
table read. This is a sub-basin PRIORITIZATION screen, not a local guarantee.
"""
from __future__ import annotations

import gzip
import json
import time
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from shapely import STRtree, from_wkb, points
from pyogrio.raw import read as ogr_read

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".aqueduct-build"
ZIP_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip"
ZIP_PATH = BUILD_DIR / "aqueduct.zip"

# 0.1-degree global grid, row-major, first row at +90 (top) decreasing south.
DLAT = 0.1
DLON = 0.1
NLON = round(360 / DLON)  # 3600
NLAT = round(180 / DLAT)  # 1800
LAT0 = 90.0 - DLAT / 2.0  # centre of first (northernmost) row
LON0 = -180.0 + DLON / 2.0  # centre of first (westernmost) column
NO_BASIN = 65535

SOURCE_ID = "wri-aqueduct-40-water-stress-v1"
ARTIFACT_VERSION = "aqueduct-4-0-future-annual-y2023m07d05"

# Aqueduct future scenario triplets -> human label. ssp245 has no Aqueduct match.
SCENARIOS = {"opt": "optimistic", "bau": "business-as-usual", "pes": "pessimistic"}
YEARS = [2030, 2050, 2080]
YEAR_CODE = {2030: "30", 2050: "50", 2080: "80"}

# Water-stress category legend (verbatim Aqueduct labels), category int -> label.
LEGEND = {
    "-1": "Arid and low water use",
    "0": "Low (<10%)",
    "1": "Low-medium (10-20%)",
    "2": "Medium-high (20-40%)",
    "3": "High (40-80%)",
    "4": "Extremely high (>80%)",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_gdb() -> Path:
    BUILD_DIR.mkdir(exist_ok=True)
    gdb = next(BUILD_DIR.glob("extracted/**/*.gdb"), None)
    if gdb is not None:
        return gdb
    if not ZIP_PATH.exists():
        log(f"downloading {ZIP_URL} ...")
        urllib.request.urlretrieve(ZIP_URL, ZIP_PATH)  # noqa: S310 (vetted https source)
    log("extracting GDB ...")
    with zipfile.ZipFile(ZIP_PATH) as zf:
        members = [m for m in zf.namelist() if ".gdb/" in m]
        zf.extractall(BUILD_DIR / "extracted", members)
    gdb = next(BUILD_DIR.glob("extracted/**/*.gdb"), None)
    if gdb is None:
        raise SystemExit("Aqueduct GDB not found after extraction")
    return gdb


def num(value) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(f) else f


def main() -> None:
    t_start = time.time()
    gdb = ensure_gdb()
    log(f"reading {gdb} ...")

    ws_cols: list[str] = []
    for scen in SCENARIOS:
        for yr in YEARS:
            base = f"{scen}{YEAR_CODE[yr]}_ws_x"
            ws_cols += [f"{base}_c", f"{base}_s", f"{base}_r"]
    columns = ["pfaf_id", *ws_cols]

    out = ogr_read(gdb, layer="future_annual", columns=columns, read_geometry=True)
    meta, geom_wkb, field_data = out[0], out[-2], out[-1]
    field_index = {name: i for i, name in enumerate(meta["fields"])}
    n_features = len(geom_wkb)
    log(f"features: {n_features}")
    if n_features >= NO_BASIN:
        raise SystemExit(f"basin count {n_features} exceeds Uint16 raster capacity")

    pfaf = field_data[field_index["pfaf_id"]]

    # Build per-basin category/score/raw table (compact, derive labels at runtime).
    basins = []
    for i in range(n_features):
        cats: dict[str, list[int | None]] = {}
        scores: dict[str, list[float | None]] = {}
        raws: dict[str, list[float | None]] = {}
        for scen in SCENARIOS:
            c_list: list[int | None] = []
            s_list: list[float | None] = []
            r_list: list[float | None] = []
            for yr in YEARS:
                base = f"{scen}{YEAR_CODE[yr]}_ws_x"
                c = num(field_data[field_index[f"{base}_c"]][i])
                s = num(field_data[field_index[f"{base}_s"]][i])
                r = num(field_data[field_index[f"{base}_r"]][i])
                c_list.append(None if c is None else int(round(c)))
                s_list.append(None if s is None else round(s, 2))
                r_list.append(None if r is None else round(r, 4))
            cats[scen] = c_list
            scores[scen] = s_list
            raws[scen] = r_list
        pid = num(pfaf[i])
        basins.append(
            {
                "pfaf_id": None if pid is None else int(round(pid)),
                "c": cats,
                "s": scores,
                "r": raws,
            }
        )

    log("building spatial index ...")
    geoms = from_wkb(geom_wkb)
    tree = STRtree(geoms)

    log(f"rasterizing {NLAT}x{NLON} = {NLAT * NLON} cells at {DLAT} degrees ...")
    raster = np.full(NLAT * NLON, NO_BASIN, dtype=np.uint16)
    lons = LON0 + np.arange(NLON) * DLON
    t_r = time.time()
    for row in range(NLAT):
        lat = LAT0 - row * DLAT
        pts = points(lons, np.full(NLON, lat))
        # query returns [[query_idx...],[geom_idx...]] for intersecting pairs
        q = tree.query(pts, predicate="intersects")
        if q.shape[1]:
            base = row * NLON
            # First listed basin wins for any cell matched more than once (basins partition land).
            for qi, gi in zip(q[0], q[1]):
                cell = base + int(qi)
                if raster[cell] == NO_BASIN:
                    raster[cell] = gi
        if row % 200 == 0:
            log(f"  row {row}/{NLAT}  ({round(time.time() - t_r, 1)}s)")

    matched = int((raster != NO_BASIN).sum())
    log(f"matched land cells: {matched} ({round(100 * matched / raster.size, 1)}%)")

    raster_path = REPO / "data" / "freshwater-stress.aqueduct40.u16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(raster.tobytes(order="C"))
    raster_bytes = raster_path.stat().st_size
    log(f"wrote {raster_path.relative_to(REPO)} ({raster_bytes} bytes gz)")

    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "World Resources Institute (WRI) Aqueduct 4.0",
        "indicator": "water_stress",
        "indicatorLabel": "Water stress (annual withdrawal / available supply)",
        "license": "attribution",
        "licenseText": (
            "WRI datasets are available without restriction on use or distribution. "
            "WRI requests proper attribution."
        ),
        "attribution": (
            "Water-stress projections: WRI Aqueduct 4.0 (Kuzma et al. 2023, doi:10.46830/writn.23.00061)."
        ),
        "stableUrl": "https://www.wri.org/data/aqueduct-global-maps-40-data",
        "downloadUrl": ZIP_URL,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "raster": {
            "file": "freshwater-stress.aqueduct40.u16.gz",
            "encoding": "gzip+uint16le",
            "noBasin": NO_BASIN,
            "nlat": NLAT,
            "nlon": NLON,
            "dlat": DLAT,
            "dlon": DLON,
            "lat0": LAT0,
            "lon0": LON0,
            "order": "row-major; row 0 at +90 decreasing south; col 0 at -180 increasing east",
        },
        "legend": LEGEND,
        "scenarioMap": {
            "ssp126": "opt",
            "ssp370": "bau",
            "ssp585": "pes",
            "ssp245": None,
        },
        "scenarioLabels": SCENARIOS,
        "years": YEARS,
        "method": (
            "WRI Aqueduct 4.0 future-annual water-stress category for the HydroBASINS "
            "sub-basin whose polygon contains the queried point, rasterized to a 0.1-degree "
            "grid at build time. Water stress is annual water withdrawal divided by available "
            "renewable surface-plus-groundwater supply, classed into Aqueduct's standard bands."
        ),
        "caveats": [
            "Aqueduct is a sub-basin PRIORITIZATION screen, not a local or parcel-level water guarantee (WRI's own caveat).",
            "Values are per HydroBASINS sub-basin; everyone in a basin shares one category regardless of local supply, storage, piping, or demand.",
            "Future scenarios are 2030/2050/2080 under SSP-RCP combinations; intermediate and post-2080 years are shown against the nearest available Aqueduct horizon.",
            "ssp245 (current-policy reference) has no exact Aqueduct scenario and returns no water-stress value by design.",
            "Rasterized to 0.1 degrees, so points near sub-basin boundaries may resolve to an adjacent basin.",
            "Covers water stress only; not drought, flood, water quality, sanitation access, or seasonal variability.",
        ],
        "basinCount": n_features,
        "basins": basins,
    }
    manifest_path = REPO / "data" / "freshwater-stress.aqueduct40.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    manifest_bytes = manifest_path.stat().st_size
    log(f"wrote {manifest_path.relative_to(REPO)} ({manifest_bytes} bytes)")
    log(f"done in {round(time.time() - t_start, 1)}s")


if __name__ == "__main__":
    main()
