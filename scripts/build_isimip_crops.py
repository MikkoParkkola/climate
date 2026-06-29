#!/usr/bin/env python3
"""Build the grounded crop-yield artifact from ISIMIP GGCMI phase 3 (ISIMIP3b).

Source: ISIMIP3b GGCMI phase 3 agriculture sector, yield output (rainfed, default CO2).
  Portal:  https://data.isimip.org/ (sector=agriculture, simulation_round=ISIMIP3b)
  Files:   https://files.isimip.org/ISIMIP3b/OutputData/agriculture/...
  License: CC0 1.0 Universal Public Domain Dedication. Verbatim from the ISIMIP data API
           per-dataset rights field: rights = "CC0 1.0 Universal Public Domain Dedication",
           rights_uri = https://creativecommons.org/publicdomain/zero/1.0/. Public domain;
           ISIMIP requests citation as good practice (not a license condition).

This is a *regeneration* script, NOT part of `npm run ci`. Build-time-only deps:
  pip install xarray netCDF4 cftime numpy

It reduces the rainfed (noirr), default-CO2 GGCMI3b yield projections for four staple crops
(maize, soybean, rice, winter wheat) to a compact 0.5-degree lookup grid. For each crop and
scenario (ssp126/ssp370/ssp585), it computes the multi-member ensemble-mean percentage change
in annual yield at 2030/2050/2080 (20-year window means) relative to a 2015-2034 baseline,
using model-democracy (GCMs averaged within a crop model, then crop models averaged). Cells
with negligible baseline yield (crop not grown) resolve to null.

Outputs (committed to data/):
  data/crop-yield.isimip-ggcmi.u16.gz   gzipped little-endian Uint16 multi-layer raster
  data/crop-yield.isimip-ggcmi.json      manifest: grid, scenario map, per-layer index, etc.

ssp245 is not in the GGCMI3b core protocol and returns null by design (freshwater precedent).
"""
from __future__ import annotations

import gzip
import json
import re
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import xarray as xr

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".crop-build"
STAGING = BUILD_DIR / ".staging"

SOURCE_ID = "isimip-ggcmi-phase3-yield-v1"
ARTIFACT_VERSION = "isimip3b-ggcmi-yield-noirr-default-v1"

# ISIMIP crop code -> (display name, netcdf var infix). noirr = rainfed.
CROPS = {
    "mai": "Maize",
    "soy": "Soybean",
    "ri1": "Rice",
    "wwh": "Wheat (winter)",
}

SCENARIO_MAP = {"ssp126": "ssp126", "ssp245": None, "ssp370": "ssp370", "ssp585": "ssp585"}
SCENARIO_LABELS = {"ssp126": "low (SSP1-2.6)", "ssp370": "high (SSP3-7.0)", "ssp585": "very high (SSP5-8.5)"}
YEARS = [2030, 2050, 2080]
WINDOWS = {2030: (2021, 2040), 2050: (2041, 2060), 2080: (2071, 2090)}
BASELINE = (2015, 2034)
BASELINE_MIN_YIELD = 0.1  # t/ha; below this the crop is treated as not grown -> null

# 0.5-degree global grid (confirmed from an ISIMIP file at build time).
NLAT = 360
NLON = 720
DLAT = 0.5
DLON = 0.5
LAT0 = 89.75  # centre of first (northernmost) row, decreasing south
LON0 = -179.75  # centre of first (westernmost) column

# Yield % change stored as round((clamp(pct,-100,500)+100)*100) -> 0..60000; fill 65535.
PCT_MIN = -100.0
PCT_MAX = 500.0
PCT_OFFSET = 100.0
PCT_SCALE = 100.0
FILL = 65535

FNAME_RE = re.compile(
    r"^([a-z0-9]+)_([a-z0-9\-]+)_w5e5_(ssp\d+)_2015soc_default_yield-([a-z0-9]+)-noirr_global_annual-gs_\d+_\d+\.nc$"
)


def log(msg: str) -> None:
    print(msg, flush=True)


def collect() -> dict[tuple[str, str], dict[str, list[Path]]]:
    """(crop, scenario) -> {crop_model: [files across GCMs]}."""
    out: dict[tuple[str, str], dict[str, list[Path]]] = defaultdict(lambda: defaultdict(list))
    for nc in STAGING.glob("*.nc"):
        m = FNAME_RE.match(nc.name)
        if not m:
            continue
        model, _gcm, scenario, crop = m.groups()
        if crop in CROPS and scenario in {v for v in SCENARIO_MAP.values() if v}:
            out[(crop, scenario)][model].append(nc)
    return out


def var_name(ds: xr.Dataset, crop: str) -> str:
    for cand in (f"yield-{crop}-noirr", f"yield_{crop}_noirr", "yield"):
        if cand in ds.data_vars:
            return cand
    # fall back to the single data var
    return list(ds.data_vars)[0]


def member_pct_change(f: Path, crop: str) -> np.ndarray | None:
    try:
        ds = xr.open_dataset(f, decode_times=True)
    except Exception:  # noqa: BLE001
        try:
            ds = xr.open_dataset(f, decode_times=False)
        except Exception as exc:  # noqa: BLE001
            log(f"  unreadable {f.name}: {exc}")
            return None
    with ds:
        v = var_name(ds, crop)
        da = ds[v]
        years = ds["time"].dt.year if np.issubdtype(ds["time"].dtype, np.datetime64) else None
        if years is None:
            # decode_times=False: assume annual starting 2015
            yrs = 2015 + np.arange(ds["time"].size)
            years = xr.DataArray(yrs, dims=["time"], coords={"time": ds["time"]})
        def wmean(lo: int, hi: int) -> np.ndarray:
            sel = da.where((years >= lo) & (years <= hi), drop=True)
            return sel.mean(dim="time", skipna=True).values.astype(np.float64)
        base = wmean(*BASELINE)
        out = np.full((len(YEARS), NLAT, NLON), np.nan, dtype=np.float64)
        if base.shape != (NLAT, NLON):
            log(f"  unexpected shape {base.shape} for {f.name}")
            return None
        ok = np.isfinite(base) & (base > BASELINE_MIN_YIELD)
        for i, y in enumerate(YEARS):
            fut = wmean(*WINDOWS[y])
            with np.errstate(invalid="ignore", divide="ignore"):
                pct = np.where(ok, (fut - base) / base * 100.0, np.nan)
            out[i] = pct
        return out


def ensemble(files_by_model: dict[str, list[Path]], crop: str) -> np.ndarray | None:
    """Model-democracy ensemble-mean % change, shape (len(YEARS), NLAT, NLON)."""
    model_means = []
    for model, files in files_by_model.items():
        members = [m for m in (member_pct_change(f, crop) for f in files) if m is not None]
        if not members:
            continue
        model_means.append(np.nanmean(np.stack(members, axis=0), axis=0))
    if not model_means:
        return None
    return np.nanmean(np.stack(model_means, axis=0), axis=0)


def main() -> None:
    t_start = time.time()
    grouped = collect()
    if not grouped:
        raise SystemExit("no ISIMIP yield NetCDF files found in staging")

    crops = list(CROPS)
    scenarios = [s for s in SCENARIO_MAP if SCENARIO_MAP[s]]
    cells = NLAT * NLON
    layers = []
    raster = np.full(len(crops) * len(scenarios) * len(YEARS) * cells, FILL, dtype=np.uint16)
    all_models: set[str] = set()
    member_count = 0

    layer_idx = 0
    for crop in crops:
        for scenario in scenarios:
            files_by_model = grouped.get((crop, scenario), {})
            all_models.update(files_by_model.keys())
            member_count += sum(len(v) for v in files_by_model.values())
            log(f"{crop} {scenario}: {len(files_by_model)} models, {sum(len(v) for v in files_by_model.values())} members")
            field = ensemble(files_by_model, crop) if files_by_model else None
            for i, year in enumerate(YEARS):
                offset = layer_idx * cells
                if field is not None:
                    flat = field[i].reshape(-1)
                    valid = np.isfinite(flat)
                    clamped = np.clip(flat, PCT_MIN, PCT_MAX)
                    scaled = np.clip(np.round((clamped + PCT_OFFSET) * PCT_SCALE), 0, FILL - 1).astype(np.uint16)
                    cellslice = raster[offset : offset + cells]
                    cellslice[valid] = scaled[valid]
                layers.append({"crop": crop, "scenario": scenario, "year": year, "offset": offset})
                layer_idx += 1

    matched = int((raster != FILL).sum())
    log(f"packed {layer_idx} layers; non-fill cells: {matched} ({round(100 * matched / raster.size, 2)}%)")

    raster_path = REPO / "data" / "crop-yield.isimip-ggcmi.u16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(raster.tobytes(order="C"))
    log(f"wrote {raster_path.relative_to(REPO)} ({raster_path.stat().st_size} bytes gz)")

    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "ISIMIP3b GGCMI phase 3 (PIK / crop-model intercomparison)",
        "indicator": "crop_yield",
        "indicatorLabel": "Crop-yield change (rainfed staple crops)",
        "license": "cc0-1.0",
        "licenseText": (
            "CC0 1.0 Universal Public Domain Dedication. Verbatim from the ISIMIP data API "
            "per-dataset rights field: 'CC0 1.0 Universal Public Domain Dedication', "
            "rights_uri https://creativecommons.org/publicdomain/zero/1.0/. ISIMIP requests "
            "citation as good practice."
        ),
        "attribution": (
            "Crop-yield projections: ISIMIP3b GGCMI phase 3 (Jagermeyr et al.; "
            "ISIMIP, https://data.isimip.org/), CC0 1.0."
        ),
        "stableUrl": "https://data.isimip.org/",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "raster": {
            "file": "crop-yield.isimip-ggcmi.u16.gz",
            "encoding": "gzip+uint16le",
            "fill": FILL,
            "pctOffset": PCT_OFFSET,
            "pctScale": PCT_SCALE,
            "nlat": NLAT,
            "nlon": NLON,
            "dlat": DLAT,
            "dlon": DLON,
            "lat0": LAT0,
            "lon0": LON0,
            "layerCells": cells,
            "order": "per-layer row-major; row 0 at +89.75 decreasing south; col 0 at -179.75 increasing east",
        },
        "crops": CROPS,
        "scenarioMap": SCENARIO_MAP,
        "scenarioLabels": SCENARIO_LABELS,
        "years": YEARS,
        "windows": {str(y): f"{WINDOWS[y][0]}-{WINDOWS[y][1]}" for y in YEARS},
        "baselinePeriod": f"{BASELINE[0]}-{BASELINE[1]}",
        "models": sorted(all_models),
        "modelCount": len(all_models),
        "memberCount": member_count,
        "irrigation": "rainfed (noirr)",
        "co2": "default (with CO2 fertilization)",
        "layers": layers,
        "method": (
            "ISIMIP3b GGCMI phase 3 rainfed (noirr), default-CO2 yield output for maize, "
            "soybean, rice, and winter wheat. Per crop and scenario, the multi-member "
            "ensemble-mean percentage change in annual yield at 2030/2050/2080 (20-year "
            "window means) relative to a 2015-2034 baseline, using model-democracy (GCMs "
            "averaged within a crop model, then crop models averaged). Cells with negligible "
            "baseline yield are treated as not-grown and return null."
        ),
        "caveats": [
            "Model-ensemble crop signal at 0.5 degrees, not a field-level or farm-level yield forecast.",
            "Rainfed (no irrigation) and with default CO2 fertilization, whose real-world strength is uncertain; irrigated yields would respond differently.",
            "Holds 2015 land use and management fixed; adaptation, new cultivars, fertiliser, pests, and policy are not represented.",
            "Percentage change versus a 2015-2034 baseline; cells where the crop is barely grown return no value.",
            "ssp245 is not in the GGCMI3b core protocol and returns no value by design.",
            "Ensemble mean across a small set of crop models and GCMs; model disagreement is real and not shown here.",
        ],
    }
    manifest_path = REPO / "data" / "crop-yield.isimip-ggcmi.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    log(f"wrote {manifest_path.relative_to(REPO)} ({manifest_path.stat().st_size} bytes)")
    log(f"done in {round(time.time() - t_start, 1)}s")


if __name__ == "__main__":
    main()
