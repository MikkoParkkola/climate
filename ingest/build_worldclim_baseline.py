#!/usr/bin/env python3
"""Build the compact observed monthly baseline used by grounded_model.py.

Source: WorldClim v2.1 current climate, 10 arc-minute monthly average
temperature and precipitation, 1970-2000. The runtime artifact is intentionally
simple: byte-shuffled int16 layers plus a small JSON manifest, read with only
numpy/gzip/json at serve time.
"""
from __future__ import annotations

import gzip
import json
import os
import re
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

DATASETS = {
    "temperature": {
        "url": "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_tavg.zip",
        "zip": "wc2.1_10m_tavg.zip",
        "member_re": r"wc2\.1_10m_tavg_(\d{2})\.tif$",
        "unit": "degC",
        "scale": 0.01,
    },
    "precipitation": {
        "url": "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_prec.zip",
        "zip": "wc2.1_10m_prec.zip",
        "member_re": r"wc2\.1_10m_prec_(\d{2})\.tif$",
        "unit": "mm/month",
        "scale": 0.1,
    },
}

FILL = -32768
MONTHS = list(range(1, 13))
SOURCE = (
    "WorldClim v2.1 current conditions, 10 arc-minute monthly climatology "
    "(1970-2000); Fick & Hijmans 2017"
)


def shuffle_i16(arr: np.ndarray) -> bytes:
    """Match data/grid.i16.gz byte shuffle: all low bytes, then all high bytes."""
    u = arr.astype("<i2", copy=False).view(np.uint8).reshape(-1, 2)
    return u[:, 0].tobytes() + u[:, 1].tobytes()


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    print(f"download {url} -> {dest}")
    urllib.request.urlretrieve(url, tmp)
    tmp.replace(dest)


def members(zip_path: Path, pattern: str) -> list[tuple[int, str]]:
    rx = re.compile(pattern)
    out: list[tuple[int, str]] = []
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            match = rx.search(name)
            if match:
                out.append((int(match.group(1)), name))
    out.sort()
    months = [month for month, _ in out]
    if months != MONTHS:
        raise RuntimeError(f"{zip_path} has months {months}, expected {MONTHS}")
    return out


def nodata_value(image: Image.Image) -> float | None:
    raw = image.tag_v2.get(42113)
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def read_grid_metadata(image: Image.Image) -> dict[str, float | int]:
    pixel_scale = image.tag_v2.get(33550)
    tiepoint = image.tag_v2.get(33922)
    if not pixel_scale or not tiepoint:
        raise RuntimeError("GeoTIFF missing ModelPixelScaleTag or ModelTiepointTag")
    dlon = float(pixel_scale[0])
    dlat = -float(pixel_scale[1])
    lon_corner = float(tiepoint[3])
    lat_corner = float(tiepoint[4])
    width, height = image.size
    return {
        "lat0": lat_corner + dlat / 2.0,
        "lon0": lon_corner + dlon / 2.0,
        "dlat": dlat,
        "dlon": dlon,
        "nlat": int(height),
        "nlon": int(width),
    }


def pack_dataset(
    zip_path: Path,
    pattern: str,
    layer: str,
    unit: str,
    scale: float,
    out_raw,
    offset: int,
    grid: dict[str, float | int] | None,
) -> tuple[dict[str, float | int], dict[str, object], int]:
    start = offset
    first_grid = grid
    months_i16: list[np.ndarray] = []
    with zipfile.ZipFile(zip_path) as zf:
        for month, name in members(zip_path, pattern):
            with zf.open(name) as fh:
                image = Image.open(fh)
                if first_grid is None:
                    first_grid = read_grid_metadata(image)
                arr = np.asarray(image, dtype=np.float32)
                nodata = nodata_value(image)
                mask = ~np.isfinite(arr)
                if nodata is not None:
                    if nodata < -1e20:
                        mask |= arr < -1e20
                    else:
                        mask |= arr == nodata
                valid = arr[~mask]
                if valid.size == 0:
                    raise RuntimeError(f"{name} has no valid cells")
                encoded_valid = np.rint(valid / scale)
                if np.nanmax(encoded_valid) > 32767 or np.nanmin(encoded_valid) < -32767:
                    raise RuntimeError(f"{name} overflows int16 at scale {scale}")
                i16 = np.full(arr.shape, FILL, dtype="<i2")
                i16[~mask] = encoded_valid.astype("<i2")
                months_i16.append(i16)
                print(
                    f"packed {layer} month={month:02d} "
                    f"min={float(np.nanmin(valid)):.2f} max={float(np.nanmax(valid)):.2f}"
                )
    assert first_grid is not None
    stack = np.stack(months_i16, axis=0)
    payload = shuffle_i16(stack)
    out_raw.write(payload)
    offset += len(payload)
    layer_entry = {
        "layer": "observed-baseline",
        "scenario": layer,
        "var": "clim",
        "unit": unit,
        "months": MONTHS,
        "scale": scale,
        "fill": FILL,
        "shape": [12, int(first_grid["nlat"]), int(first_grid["nlon"])],
        "offset": start,
        "bytes": offset - start,
        "source": SOURCE,
    }
    return first_grid, layer_entry, offset


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    cache = repo / "ingest" / "cache" / "worldclim"
    data_dir = repo / "data"
    for spec in DATASETS.values():
        download(str(spec["url"]), cache / str(spec["zip"]))

    data_dir.mkdir(parents=True, exist_ok=True)
    raw_fd, raw_path = tempfile.mkstemp(prefix="worldclim10m.", suffix=".i16", dir=data_dir)
    os.close(raw_fd)
    raw_file = Path(raw_path)
    manifest_path = data_dir / "worldclim10m.manifest.json"
    binary_path = data_dir / "worldclim10m.i16.gz"

    layers: list[dict[str, object]] = []
    grid: dict[str, float | int] | None = None
    offset = 0
    try:
        with raw_file.open("wb") as out_raw:
            for layer, spec in DATASETS.items():
                grid, entry, offset = pack_dataset(
                    cache / str(spec["zip"]),
                    str(spec["member_re"]),
                    layer,
                    str(spec["unit"]),
                    float(spec["scale"]),
                    out_raw,
                    offset,
                    grid,
                )
                layers.append(entry)

        with raw_file.open("rb") as src, binary_path.open("wb") as compressed:
            with gzip.GzipFile(filename="", mode="wb", fileobj=compressed, mtime=0) as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    dst.write(chunk)

        manifest = {
            "format": "fupit-worldclim-observed-baseline-v1",
            "encoding": "int16",
            "shuffle": "low-bytes-then-high-bytes",
            "grid": grid,
            "fill": FILL,
            "binary": binary_path.name,
            "decoded_bytes": offset,
            "layers": layers,
            "source": {
                "name": "WorldClim v2.1 current conditions",
                "period": "1970-2000",
                "resolution": "10 arc-minutes",
                "variables": ["monthly average temperature", "monthly precipitation"],
                "urls": {layer: spec["url"] for layer, spec in DATASETS.items()},
                "citation": "Fick, S.E. and Hijmans, R.J. (2017), International Journal of Climatology",
            },
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"wrote {binary_path} ({binary_path.stat().st_size / 1024 / 1024:.1f} MiB)")
        print(f"wrote {manifest_path}")
    finally:
        raw_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
