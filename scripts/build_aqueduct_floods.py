#!/usr/bin/env python3
"""Build the grounded riverine flood-exposure artifact from WRI Aqueduct Floods.

Source: WRI Aqueduct Floods (Ward et al. 2020), riverine inundation hazard maps.
  Download: http://wri-projects.s3.amazonaws.com/AqueductFloodTool/download/v2/
  Docs:     https://www.wri.org/data/aqueduct-floods-hazard-maps
  License:  WRI Open Data Commitment (same family as Aqueduct 4.0 water risk, already
            cleared for the freshwater artifact): WRI datasets are available without
            restriction on use or distribution; WRI requests proper attribution.

This is a *regeneration* script, NOT part of `npm run ci`. Build-time-only deps:
  pip install rasterio numpy

It reduces the ~1 km (30 arc-sec) global riverine inundation-depth GeoTIFFs for the
1-in-100-year return period (rp00100) to a compact 0.1-degree lookup grid (the same grid
convention as the freshwater artifact). For each scenario (RCP4.5 -> ssp245, RCP8.5 ->
ssp585) and horizon (2030/2050/2080), it computes the 5-GCM ensemble-mean inundation
depth at native resolution, then per coarse cell stores two indicators:

  * floodedFraction   - fraction of the ~10 km cell in the modeled 1-in-100-year river
                        floodplain (depth > 5 cm). A regional flood-exposure screen.
  * meanFloodDepth    - mean modeled depth (metres) over the flooded pixels of the cell.

Outputs (committed to data/):
  data/flood-river.aqueduct.u16.gz   gzipped little-endian Uint16 multi-layer raster
  data/flood-river.aqueduct.json      manifest: grid, scenario map, per-layer index,
                                      attribution, license, method, caveats

ssp126 and ssp370 have no matching Aqueduct RCP and return null by design (the freshwater
precedent): no value is ever invented.
"""
from __future__ import annotations

import gzip
import json
import time
from pathlib import Path

import numpy as np
import rasterio

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".flood-build"
STAGING = BUILD_DIR / ".staging"

SOURCE_ID = "wri-aqueduct-floods-riverine-v1"
ARTIFACT_VERSION = "aqueduct-floods-v2-riverine-rp100-v1"

MODELS = ["00000NorESM1-M", "0000GFDL-ESM2M", "0000HadGEM2-ES", "00IPSL-CM5A-LR", "MIROC-ESM-CHEM"]
RETURN_PERIOD = "rp00100"

# fupit scenario -> Aqueduct RCP. ssp126 and ssp370 have no Aqueduct match.
SCENARIO_MAP = {
    "ssp126": None,
    "ssp245": "rcp4p5",
    "ssp370": None,
    "ssp585": "rcp8p5",
}
SCENARIO_LABELS = {"rcp4p5": "RCP4.5 (mapped to SSP2-4.5)", "rcp8p5": "RCP8.5 (mapped to SSP5-8.5)"}
YEARS = [2030, 2050, 2080]

# 0.1-degree global grid, identical convention to the freshwater artifact.
DLAT = 0.1
DLON = 0.1
NLON = round(360 / DLON)  # 3600
NLAT = round(180 / DLAT)  # 1800
LAT0 = 90.0 - DLAT / 2.0  # centre of first (northernmost) row
LON0 = -180.0 + DLON / 2.0  # centre of first (westernmost) column
BLOCK = 12  # 0.1 deg / (30 arc-sec) = 12 fine pixels per coarse cell

FLOOD_THRESHOLD_M = 0.05  # >5 cm counts as flooded (avoids sub-cm model noise)
FILL = 65535
FRAC_SCALE = 0.001  # floodedFraction stored as round(frac / 0.001) in 0..1000
DEPTH_SCALE = 0.01  # meanFloodDepth stored as round(depth_m / 0.01) -> cm, cap ~655 m

INDICATORS = {
    "floodedFraction": {"label": "Flooded-area fraction (1-in-100-year river flood)", "units": "fraction", "scale": FRAC_SCALE},
    "meanFloodDepth": {"label": "Mean river-flood depth over flooded area", "units": "m", "scale": DEPTH_SCALE},
}


def log(msg: str) -> None:
    print(msg, flush=True)


def ensemble_mean_depth(rcp: str, year: int) -> np.ndarray:
    """5-GCM ensemble-mean inundation depth (metres) at native 30 arc-sec resolution."""
    acc = np.zeros((NLAT * BLOCK, NLON * BLOCK), dtype=np.float32)
    used = 0
    for model in MODELS:
        path = STAGING / f"inunriver_{rcp}_{model}_{year}_{RETURN_PERIOD}.tif"
        if not path.exists():
            log(f"  MISSING {path.name}")
            continue
        with rasterio.open(path) as ds:
            a = ds.read(1)
            if a.shape != acc.shape:
                raise SystemExit(f"unexpected tif shape {a.shape} for {path.name}")
            # nodata (-9999) and negatives -> 0 (no flood); depth is in metres.
            np.maximum(a, 0.0, out=a)
            acc += a
            used += 1
    if used == 0:
        raise SystemExit(f"no GCM tifs for {rcp} {year}")
    acc /= used
    return acc


def reduce_to_grid(depth: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Block-reduce a native-resolution depth field to (floodedFraction, meanFloodDepth)."""
    mask = depth > FLOOD_THRESHOLD_M
    blk_mask = mask.reshape(NLAT, BLOCK, NLON, BLOCK)
    flooded_px = blk_mask.sum(axis=(1, 3)).astype(np.float64)
    fraction = flooded_px / (BLOCK * BLOCK)
    depth_sum = (depth * mask).reshape(NLAT, BLOCK, NLON, BLOCK).sum(axis=(1, 3), dtype=np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean_depth = np.where(flooded_px > 0, depth_sum / flooded_px, np.nan)
    return fraction, mean_depth


def pack_layer(raster: np.ndarray, offset: int, field: np.ndarray, scale: float) -> None:
    flat = field.reshape(-1)
    valid = np.isfinite(flat) & (flat > 0)
    scaled = np.clip(np.round(flat / scale), 0, FILL - 1).astype(np.uint16)
    cellslice = raster[offset : offset + NLAT * NLON]
    cellslice[valid] = scaled[valid]


def main() -> None:
    t_start = time.time()
    indicators = list(INDICATORS)
    scenarios = [s for s in SCENARIO_MAP if SCENARIO_MAP[s]]
    cells = NLAT * NLON
    layers = []
    raster = np.full(len(indicators) * len(scenarios) * len(YEARS) * cells, FILL, dtype=np.uint16)

    layer_idx = 0
    # Compute the two reduced fields once per (scenario, year), then pack both indicators.
    reduced: dict[tuple[str, int], tuple[np.ndarray, np.ndarray]] = {}
    for scenario in scenarios:
        rcp = SCENARIO_MAP[scenario]
        for year in YEARS:
            log(f"reducing {scenario} ({rcp}) {year} ...")
            depth = ensemble_mean_depth(rcp, year)
            reduced[(scenario, year)] = reduce_to_grid(depth)
            del depth

    for indicator in indicators:
        scale = INDICATORS[indicator]["scale"]
        for scenario in scenarios:
            for year in YEARS:
                fraction, mean_depth = reduced[(scenario, year)]
                field = fraction if indicator == "floodedFraction" else mean_depth
                offset = layer_idx * cells
                pack_layer(raster, offset, field, scale)
                layers.append({"indicator": indicator, "scenario": scenario, "year": year, "offset": offset})
                layer_idx += 1

    matched = int((raster != FILL).sum())
    log(f"packed {layer_idx} layers; non-fill cells: {matched} ({round(100 * matched / raster.size, 2)}%)")

    raster_path = REPO / "data" / "flood-river.aqueduct.u16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(raster.tobytes(order="C"))
    log(f"wrote {raster_path.relative_to(REPO)} ({raster_path.stat().st_size} bytes gz)")

    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "World Resources Institute (WRI) Aqueduct Floods",
        "indicator": "flood_river",
        "indicatorLabel": "Riverine flood exposure (1-in-100-year)",
        "license": "attribution",
        "licenseText": (
            "WRI datasets are available without restriction on use or distribution. "
            "WRI requests proper attribution (WRI Open Data Commitment)."
        ),
        "attribution": (
            "Riverine flood hazard: WRI Aqueduct Floods (Ward et al. 2020), "
            "https://www.wri.org/data/aqueduct-floods-hazard-maps."
        ),
        "stableUrl": "https://www.wri.org/data/aqueduct-floods-hazard-maps",
        "downloadUrl": "http://wri-projects.s3.amazonaws.com/AqueductFloodTool/download/v2/",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "returnPeriod": "1-in-100-year",
        "raster": {
            "file": "flood-river.aqueduct.u16.gz",
            "encoding": "gzip+uint16le",
            "fill": FILL,
            "nlat": NLAT,
            "nlon": NLON,
            "dlat": DLAT,
            "dlon": DLON,
            "lat0": LAT0,
            "lon0": LON0,
            "layerCells": cells,
            "floodThresholdM": FLOOD_THRESHOLD_M,
            "order": "per-layer row-major; row 0 at +90 decreasing south; col 0 at -180 increasing east",
        },
        "indicators": INDICATORS,
        "scenarioMap": SCENARIO_MAP,
        "scenarioLabels": SCENARIO_LABELS,
        "years": YEARS,
        "models": MODELS,
        "modelCount": len(MODELS),
        "layers": layers,
        "method": (
            "WRI Aqueduct Floods v2 riverine inundation-depth maps for the 1-in-100-year "
            "return period, 5-GCM ensemble-mean at native ~1 km (30 arc-sec) resolution, "
            "block-reduced to a 0.1-degree (~10 km) lookup grid. Per cell we store the "
            "fraction of the cell in the modeled floodplain (depth > 5 cm) and the mean "
            "modeled depth over the flooded pixels. RCP4.5 is served as ssp245 and RCP8.5 "
            "as ssp585; ssp126 and ssp370 have no Aqueduct match and return null."
        ),
        "caveats": [
            "Modeled regional river-flood hazard coarsened from WRI's ~1 km maps to ~10 km cells; a screen, not a property-level guarantee.",
            "Depends on the assumed flood-protection standard in the underlying model; real local defenses, drainage, and channel works are not represented.",
            "1-in-100-year return period only; more frequent or rarer floods are not shown here.",
            "Riverine flooding only; coastal storm-surge flooding is a separate layer not yet included.",
            "RCP4.5 is mapped to ssp245 and RCP8.5 to ssp585; ssp126 and ssp370 have no matching Aqueduct scenario and return no value.",
            "Flooded-area fraction is a cell-level area statistic, not a statement that any specific address floods.",
        ],
    }
    manifest_path = REPO / "data" / "flood-river.aqueduct.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    log(f"wrote {manifest_path.relative_to(REPO)} ({manifest_path.stat().st_size} bytes)")
    log(f"done in {round(time.time() - t_start, 1)}s")


if __name__ == "__main__":
    main()
