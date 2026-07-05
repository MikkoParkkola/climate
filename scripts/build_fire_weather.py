#!/usr/bin/env python3
"""Build the grounded fire-weather enrichment artifact from Quilcaille et al. (2023).

Source: Quilcaille, Y. et al. (2023). "Showcasing global fire-weather projections in
  CMIP6 using a fully formulated Canadian Fire Weather Index." Earth System Science Data.
  Data record: ETH Zurich Research Collection, doi:10.3929/ethz-b-000583391
  Code:        doi:10.5281/zenodo.7971275
  License:     CC-BY 4.0 (verbatim from the ETH DSpace record metadata:
               dc.rights.license = "Creative Commons Attribution 4.0 International",
               dc.rights.uri = http://creativecommons.org/licenses/by/4.0/).
               Commercial-safe with attribution; redistribution of derived output allowed.

This is a *regeneration* script, NOT part of `npm run ci`. It needs build-time-only
Python deps that are not app runtime deps:  pip install xarray netCDF4 cftime numpy

It downloads the two annual FWI-indicator archives (extreme-fire-weather days `fwixd`
and fire-season length `fwils`, computed from daily mean relative humidity `hurs`) from
the ETH Research Collection REST API, reduces them on a compute host (Spark), and writes
two committed artifacts:

  data/fire-weather.quilcaille2023.u16.gz   gzipped little-endian Uint16 multi-layer raster
  data/fire-weather.quilcaille2023.json     manifest: grid, scenario map, per-layer index,
                                            attribution, license, method, caveats

Reduction: per scenario (ssp126/245/370/585) and horizon (2030/2050/2080, each a 20-year
window mean), the multi-model ensemble mean of each indicator is computed using
model-democracy (average realizations within a model, then average across models). Values
are stored as round(value * 10) Uint16 (0.1-day precision); FILL (65535) marks cells with
no land/data. No value is invented: a cell or scenario without data resolves to null at
runtime, per the cardinal no-fabricated-science rule.
"""
from __future__ import annotations

import gzip
import json
import re
import time
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np
import xarray as xr

REPO = Path(__file__).resolve().parent.parent
BUILD_DIR = REPO / ".fire-build"

# ETH Research Collection DSpace bitstream content URLs (item 1b12cf29-...).
BITSTREAMS = {
    "fwixd_hurs.zip": "https://www.research-collection.ethz.ch/server/api/core/bitstreams/21ebf431-5c20-4a85-82c6-bb96df91daaa/content",
    "fwils_hurs.zip": "https://www.research-collection.ethz.ch/server/api/core/bitstreams/afeb285b-61cf-41de-88c2-69d3cfcd3322/content",
}

SOURCE_ID = "quilcaille-2023-fire-weather-v1"
ARTIFACT_VERSION = "quilcaille-2023-fwi-annual-hurs-v1"

# Indicators we serve: ETH archive variable name -> (label, units).
INDICATORS = {
    "fwixd": {"label": "Extreme fire-weather days", "units": "days/year"},
    "fwils": {"label": "Fire-season length", "units": "days/year"},
}

# fupit scenario -> Quilcaille experiment_id. All four map directly (native SSP data);
# ssp119 and the over/434/460 experiments are present in the archive but not served.
SCENARIO_MAP = {
    "ssp126": "ssp126",
    "ssp245": "ssp245",
    "ssp370": "ssp370",
    "ssp585": "ssp585",
}
SCENARIO_LABELS = {
    "ssp126": "low (SSP1-2.6)",
    "ssp245": "intermediate (SSP2-4.5)",
    "ssp370": "high (SSP3-7.0)",
    "ssp585": "very high (SSP5-8.5)",
}

YEARS = [2030, 2050, 2080]
WINDOWS = {2030: (2021, 2040), 2050: (2041, 2060), 2080: (2071, 2090)}

SCALE = 0.1  # store round(value / SCALE) as uint16 -> 0.1-day precision
FILL = 65535

# Grid (g025 = 2.5 degrees), confirmed from a sample NetCDF.
NLAT = 72
NLON = 144
DLAT = 2.5
DLON = 2.5
LAT0 = -88.75  # centre of first (southernmost) row, increasing north
LON0 = 1.25  # centre of first column, 0..360 increasing east

FNAME_RE = re.compile(r"^(fwixd|fwils)_ann_(.+?)_(ssp\d+(?:-over)?|historical|ssp\d+)_([^_]+)_g025\.nc$")


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_extracted() -> Path:
    BUILD_DIR.mkdir(exist_ok=True)
    ex = BUILD_DIR / "extracted"
    ex.mkdir(exist_ok=True)
    for fn, url in BITSTREAMS.items():
        zpath = BUILD_DIR / fn
        marker = ex / (fn + ".done")
        if marker.exists():
            continue
        if not zpath.exists() or zpath.stat().st_size < 10_000_000:
            log(f"downloading {fn} ...")
            urllib.request.urlretrieve(url, zpath)  # noqa: S310 (vetted https source)
        log(f"extracting {fn} ...")
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(ex)
        marker.write_text("ok")
    return ex


def collect_files(ex: Path) -> dict[tuple[str, str], dict[str, list[Path]]]:
    """Map (indicator, scenario) -> {model: [realization files]}."""
    out: dict[tuple[str, str], dict[str, list[Path]]] = defaultdict(lambda: defaultdict(list))
    served_scen = set(SCENARIO_MAP.values())
    for nc in ex.rglob("*.nc"):
        m = FNAME_RE.match(nc.name)
        if not m:
            continue
        indicator, model, scenario, _variant = m.groups()
        if indicator not in INDICATORS or scenario not in served_scen:
            continue
        out[(indicator, scenario)][model].append(nc)
    return out


def land_mask() -> np.ndarray:
    """Boolean (NLAT, NLON) land mask for the 2.5-degree cell centres.

    The Quilcaille FWI is computed globally from meteorological fields, so it carries
    physically meaningless values over open ocean (no fuel). We mask ocean cells to FILL
    so that an open-ocean point resolves to null rather than a misleading fire-season
    length; coastal cells whose 2.5-degree centre lands offshore are recovered at runtime
    by the nearest-cell fallback. Uses the global-land-mask package (a NaturalEarth/GLOBE-
    derived land/ocean grid); falls back to all-land if unavailable (logged loudly).
    """
    try:
        from global_land_mask import globe
    except ImportError:
        log("WARNING: global-land-mask not installed; serving all cells (ocean NOT masked)")
        return np.ones((NLAT, NLON), dtype=bool)
    lats = LAT0 + np.arange(NLAT) * DLAT
    lons = LON0 + np.arange(NLON) * DLON
    lons180 = np.where(lons > 180.0, lons - 360.0, lons)
    lat_grid, lon_grid = np.meshgrid(lats, lons180, indexing="ij")
    return globe.is_land(lat_grid, lon_grid)


def window_mean_field(files: list[Path], indicator: str, lo: int, hi: int) -> np.ndarray | None:
    """Model-democracy ensemble mean of the per-year window mean over [lo, hi]."""
    per_model: dict[str, list[np.ndarray]] = defaultdict(list)
    for f in files:
        model = FNAME_RE.match(f.name).group(2)
        try:
            ds = xr.open_dataset(f)
        except Exception as exc:  # noqa: BLE001
            log(f"  skip unreadable {f.name}: {exc}")
            continue
        with ds:
            da = ds[indicator]
            years = ds["time"].dt.year
            sel = da.where((years >= lo) & (years <= hi), drop=True)
            if sel["time"].size == 0:
                continue
            field = sel.mean(dim="time", skipna=True).values.astype(np.float64)
            per_model[model].append(field)
    if not per_model:
        return None
    model_means = [np.nanmean(np.stack(v, axis=0), axis=0) for v in per_model.values()]
    return np.nanmean(np.stack(model_means, axis=0), axis=0)


def main() -> None:
    t_start = time.time()
    ex = ensure_extracted()
    grouped = collect_files(ex)
    if not grouped:
        raise SystemExit("no matching NetCDF files found after extraction")

    indicators = list(INDICATORS)
    scenarios = list(SCENARIO_MAP)
    layers = []
    cells = NLAT * NLON
    raster = np.full(len(indicators) * len(scenarios) * len(YEARS) * cells, FILL, dtype=np.uint16)
    mask = land_mask()
    log(f"land mask: {int(mask.sum())}/{mask.size} cells are land ({round(100 * mask.sum() / mask.size, 1)}%)")

    all_models: set[str] = set()
    realization_count = 0
    layer_idx = 0
    for indicator in indicators:
        for scenario in scenarios:
            exp = SCENARIO_MAP[scenario]
            files_by_model = grouped.get((indicator, exp), {})
            model_files = [f for fs in files_by_model.values() for f in fs]
            all_models.update(files_by_model.keys())
            realization_count += len(model_files)
            log(f"{indicator} {scenario}: {len(files_by_model)} models, {len(model_files)} realizations")
            for year in YEARS:
                lo, hi = WINDOWS[year]
                field = window_mean_field(model_files, indicator, lo, hi) if model_files else None
                offset = layer_idx * cells
                if field is not None:
                    if field.shape != (NLAT, NLON):
                        raise SystemExit(f"unexpected field shape {field.shape} for {indicator} {scenario} {year}")
                    field = np.where(mask, field, np.nan)  # ocean -> null
                    flat = field.reshape(-1)
                    valid = np.isfinite(flat)
                    scaled = np.clip(np.round(flat / SCALE), 0, FILL - 1).astype(np.uint16)
                    cellslice = raster[offset : offset + cells]
                    cellslice[valid] = scaled[valid]
                layers.append({"indicator": indicator, "scenario": scenario, "year": year, "offset": offset})
                layer_idx += 1

    matched = int((raster != FILL).sum())
    log(f"packed {layer_idx} layers; non-fill cells: {matched} ({round(100 * matched / raster.size, 1)}%)")

    raster_path = REPO / "data" / "fire-weather.quilcaille2023.u16.gz"
    with gzip.open(raster_path, "wb", compresslevel=9) as fh:
        fh.write(raster.tobytes(order="C"))
    log(f"wrote {raster_path.relative_to(REPO)} ({raster_path.stat().st_size} bytes gz)")

    manifest = {
        "version": ARTIFACT_VERSION,
        "sourceId": SOURCE_ID,
        "provider": "Quilcaille et al. 2023 (ETH Zurich), CMIP6 Canadian Fire Weather Index",
        "indicator": "fire_weather",
        "indicatorLabel": "Fire-weather indicators (Canadian FWI)",
        "license": "cc-by-4.0",
        "licenseText": (
            "Creative Commons Attribution 4.0 International (CC-BY 4.0). Verbatim from the ETH "
            "Research Collection record metadata: dc.rights.license = 'Creative Commons "
            "Attribution 4.0 International', dc.rights.uri = http://creativecommons.org/licenses/by/4.0/."
        ),
        "attribution": (
            "Fire-weather projections: Quilcaille et al. 2023, CMIP6 Fire Weather Index "
            "(doi:10.3929/ethz-b-000583391, CC-BY 4.0)."
        ),
        "stableUrl": "https://doi.org/10.3929/ethz-b-000583391",
        "downloadUrls": list(BITSTREAMS.values()),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "raster": {
            "file": "fire-weather.quilcaille2023.u16.gz",
            "encoding": "gzip+uint16le",
            "fill": FILL,
            "scale": SCALE,
            "nlat": NLAT,
            "nlon": NLON,
            "dlat": DLAT,
            "dlon": DLON,
            "lat0": LAT0,
            "lon0": LON0,
            "layerCells": cells,
            "order": "per-layer row-major; row 0 at -88.75 increasing north; col 0 at +1.25 (0..360) increasing east",
        },
        "indicators": INDICATORS,
        "scenarioMap": SCENARIO_MAP,
        "scenarioLabels": SCENARIO_LABELS,
        "years": YEARS,
        "windows": {str(y): f"{WINDOWS[y][0]}-{WINDOWS[y][1]}" for y in YEARS},
        "models": sorted(all_models),
        "modelCount": len(all_models),
        "realizationCount": realization_count,
        "humidityInput": "hurs (daily mean relative humidity)",
        "layers": layers,
        "method": (
            "Quilcaille et al. 2023 annual Canadian Fire Weather Index indicators (extreme "
            "fire-weather days and fire-season length), computed from daily mean relative "
            "humidity (hurs), regridded to 2.5 degrees. Per scenario and horizon (2030/2050/2080, "
            "each a 20-year window mean), the multi-model ensemble mean is taken using "
            "model-democracy (realizations averaged within a model, then averaged across models)."
        ),
        "caveats": [
            "Coarse ~250 km (2.5 degree) annual fire-weather trend; indicates fire-conducive weather, not ignition, fuel load, or land management.",
            "Multi-model ensemble mean across CMIP6 models; individual models disagree and the spread is not shown.",
            "Computed from daily mean relative humidity (hurs); afternoon-minimum humidity would give somewhat higher fire-weather values.",
            "Horizons are 20-year window means centred near 2030/2050/2080; intermediate and post-2080 years are shown against the nearest available horizon.",
            "Fire Weather Index measures weather conducive to fire, not actual burned area, emissions, or fire risk to a specific property.",
            "Open-ocean cells are masked out (the index has no meaning without fuel); a point over water returns no fire-weather value rather than a misleading one.",
        ],
    }
    manifest_path = REPO / "data" / "fire-weather.quilcaille2023.json"
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    log(f"wrote {manifest_path.relative_to(REPO)} ({manifest_path.stat().st_size} bytes)")
    log(f"done in {round(time.time() - t_start, 1)}s")


if __name__ == "__main__":
    main()
