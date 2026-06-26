#!/usr/bin/env python3
"""
build_export.py — pack the validated grids into one compact binary for Option C.

Option C serving: the Node app loads ONE binary + manifest into memory at startup
and interpolates per request — no Postgres for the grid, no Python subprocess.

Reads everything in out/:
  - air-temperature/precipitation/relative-humidity__<scn>.nc  (delta_mean, delta_std)
  - sealevel__<scn>.nc                                          (rise_median/low/high)
  - extreme-<idx>__<scn>.nc                                     (delta_mean, delta_std)
  - calibration.json                                            (temperature hot-model k)

Emits (to export/):
  - grid.i16        concatenated int16 little-endian arrays (one per layer-variable)
  - manifest.json   {grid meta, layers[], calibration} — byte offsets, per-array scale

Encoding: each array is (ndecade, nlat, nlon) flattened C-order, int16 with a
per-array scale = max(abs)/32000 (auto, lossless to ~5 significant digits for our
ranges). NaN -> fill -32768 (a gap stays a gap; Node skips fills). The lat/lon grid
is implicit + identical for every layer (1deg, lat -89.5..89.5, lon -179.5..179.5),
stored once in the manifest. Decades are per-array (some scenarios skip some).

Self-check: after writing, re-reads the binary and compares sample cells back to the
source NetCDF within the array's scale tolerance. Fails loudly if any drift.
"""
import os, sys, glob, json, struct, gzip
import numpy as np
import xarray as xr

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out")
EXP = os.path.join(HERE, "export")
FILL = -32768

# filename short var -> (layer key, public variable id list it carries)
CMIP6_VARS = {"delta_mean": "mean", "delta_std": "std"}
SEALEVEL_VARS = {"rise_median": "median", "rise_low": "low", "rise_high": "high"}
SCENARIO_ID = {"ssp1_1_9": "ssp119", "ssp1_2_6": "ssp126", "ssp2_4_5": "ssp245",
               "ssp3_7_0": "ssp370", "ssp5_8_5": "ssp585"}
VARIABLE_ID = {"air-temperature": "temperature", "precipitation": "precipitation",
               "relative-humidity": "humidity"}


def encode(arr, scale):
    """float (ndecade,nlat,nlon) -> shuffled int16 bytes at a FIXED scale. NaN -> FILL.
    Fixed (not auto) scale matches source NetCDF precision — honest (ensemble spread
    dwarfs sub-0.01-unit precision) and compresses well. Byte-SHUFFLE (all low bytes
    then all high bytes) precedes gzip, same trick HDF5 uses: it groups the near-
    constant sign/high bytes so DEFLATE exploits spatial smoothness (cuts size ~2x).
    Node reverses the shuffle after gunzip (see manifest 'shuffle': true)."""
    a = np.asarray(arr, dtype="float64")
    finite = np.isfinite(a)
    q = np.full(a.shape, FILL, dtype="<i2")
    q[finite] = np.clip(np.round(a[finite] / scale), -32000, 32000).astype("<i2")
    b = q.tobytes(order="C")
    pairs = np.frombuffer(b, dtype=np.uint8).reshape(-1, 2)   # [lo,hi] per int16
    return pairs.T.reshape(-1).tobytes()                       # all lo..., all hi...


def unshuffle_i16(buf):
    """Reverse encode()'s byte-shuffle -> int16 LE array. Mirror of the Node decoder."""
    u = np.frombuffer(buf, dtype=np.uint8)
    half = u.size // 2
    pairs = np.empty((half, 2), dtype=np.uint8)
    pairs[:, 0] = u[:half]; pairs[:, 1] = u[half:]
    return pairs.reshape(-1).view("<i2")


# Fixed quantization scale per layer kind (units in comments).
def scale_for(layer, unit):
    if layer == "sealevel":
        return 0.001          # metres -> 1 mm precision
    return 0.01               # degC / percent / days / mm -> 0.01-unit precision


def file_arrays(path):
    """Yield (layer, scenario, role, unit, src, axis_key, axis_vals, float_array) for
    the data vars of one grid file. axis_key is 'decades' (projections) or 'months'
    (baseline climatology)."""
    base = os.path.basename(path)[:-3]
    ds = xr.open_dataset(path)
    # baseline climatology files: baseline-<var>.nc, dims (month,lat,lon), var 'clim'
    if base.startswith("baseline-"):
        short = base[len("baseline-"):]
        months = [int(m) for m in ds.month.values]
        unit = str(ds.attrs.get("unit", "absolute"))
        src = str(ds.attrs.get("source", ""))
        yield "baseline", short, "clim", unit, src, "months", months, ds["clim"].values
        ds.close()
        return
    short, cds_scn = base.split("__")
    scenario = SCENARIO_ID.get(cds_scn, cds_scn)
    decades = [int(d) for d in ds.decade.values]
    if short == "sealevel":
        layer, varmap, unit = "sealevel", SEALEVEL_VARS, "m"
    elif short.startswith("extreme-"):
        layer, varmap = short, CMIP6_VARS
        unit = str(ds.attrs.get("units", "index"))
    else:
        layer, varmap = VARIABLE_ID.get(short, short), CMIP6_VARS
        unit = str(ds.attrs.get("units", "absolute"))
    src = str(ds.attrs.get("source", ds.attrs.get("method", "")))
    for ncvar, role in varmap.items():
        if ncvar in ds.variables:
            yield layer, scenario, role, unit, src, "decades", decades, ds[ncvar].values
    ds.close()


def main():
    os.makedirs(EXP, exist_ok=True)
    paths = sorted(glob.glob(os.path.join(OUT, "*__*.nc")) +
                   glob.glob(os.path.join(OUT, "baseline-*.nc")))
    if not paths:
        sys.exit(f"no grids in {OUT}")
    # grid meta from the first projection file (identical across all)
    proj0 = next(p for p in paths if "__" in os.path.basename(p))
    ds0 = xr.open_dataset(proj0)
    lat = ds0.lat.values; lon = ds0.lon.values
    grid = {"nlat": int(lat.size), "nlon": int(lon.size),
            "lat0": float(lat[0]), "lon0": float(lon[0]),
            "dlat": float(lat[1] - lat[0]), "dlon": float(lon[1] - lon[0])}
    ds0.close()

    bin_path = os.path.join(EXP, "grid.i16.gz")
    layers, offset = [], 0
    chunks = []
    for path in paths:
        for layer, scenario, role, unit, src, axis_key, axis_vals, arr in file_arrays(path):
            scale = scale_for(layer, unit)
            buf = encode(arr, scale)
            chunks.append(buf)
            layers.append({
                "layer": layer, "scenario": scenario, "var": role, "unit": unit,
                axis_key: axis_vals, "scale": scale, "fill": FILL,
                "shape": [len(axis_vals), grid["nlat"], grid["nlon"]],
                "offset": offset, "bytes": len(buf), "source": src,
            })
            offset += len(buf)
    raw = b"".join(chunks)
    with gzip.open(bin_path, "wb", compresslevel=9) as fh:
        fh.write(raw)

    calib = {}
    cpath = os.path.join(OUT, "calibration.json")
    if os.path.exists(cpath):
        calib = json.load(open(cpath))

    manifest = {
        "format": "option-c grid v1",
        "encoding": "int16 LE, C-order, per-array scale; byte-shuffle then gzip",
        "shuffle": True,
        "grid": grid, "fill": FILL, "binary": "grid.i16.gz",
        "decoded_bytes": len(raw),
        "layers": layers, "calibration": calib,
    }
    with open(os.path.join(EXP, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    gz = os.path.getsize(bin_path)
    print(f"wrote {bin_path} ({gz/1e6:.1f} MB gz, {len(raw)/1e6:.1f} MB decoded), "
          f"{len(layers)} arrays")
    print(f"wrote manifest.json ({len(json.dumps(manifest))/1e3:.0f} KB JSON)")

    # ── self-check: decode gz, compare sample cells to source NetCDF ──
    blob = gzip.open(bin_path, "rb").read()
    assert len(blob) == len(raw), "decoded size mismatch"
    checked = bad = 0
    for path in paths:
        for layer, scenario, role, unit, src, axis_key, axis_vals, arr in file_arrays(path):
            ent = next(l for l in layers if l["layer"] == layer
                       and l["scenario"] == scenario and l["var"] == role)
            q = unshuffle_i16(blob[ent["offset"]:ent["offset"] + ent["bytes"]]
                              ).reshape(ent["shape"])
            a = np.asarray(arr, dtype="float64")
            # sample up to 200 finite cells
            fin = np.argwhere(np.isfinite(a))
            if fin.size == 0:
                continue
            idx = fin[np.linspace(0, len(fin) - 1, min(200, len(fin))).astype(int)]
            for di, yi, xi in idx:
                checked += 1
                got = q[di, yi, xi]
                if got == FILL:
                    bad += 1; continue
                recon = got * ent["scale"]
                if abs(recon - a[di, yi, xi]) > ent["scale"] * 1.5:
                    bad += 1
    print(f"self-check: {checked} cells, {bad} mismatches "
          f"({'OK' if bad == 0 else 'FAIL'})")
    sys.exit(0 if bad == 0 else 1)


if __name__ == "__main__":
    main()
