#!/usr/bin/env python3
"""
load_cache.py — load grounded grids + calibration into Postgres.

Reads the products fetch_reduce.py / calibrate.py wrote in out/:
  - out/<variable>__<scenario>.nc  (dims decade,lat,lon; delta_mean/std, n_models)
  - out/calibration.json           (per scenario/decade k factors, temperature)
and upserts them into the climate_grid + climate_calibration tables
(shared/schema.ts). Runs on Spark (where the .nc files live).

NaN cells (no model data) are skipped — no row for a missing value (cardinal
rule: a gap is honest). This also keeps the table small.

  --dry-run   parse + count rows, NO database connection or write. Use to
              validate the grids and estimate DB size without credentials.

Real run needs: grids complete, DATABASE_URL set, `psycopg2` installed, and the
schema pushed first (`npm run db:push`). The DB write is production shared state
— run deliberately, not by accident.
"""
import os, sys, glob, json
import numpy as np
import xarray as xr

OUT = os.path.join(os.path.dirname(__file__), "out")
METHOD_VERSION = "cmip6-delta-v1"
# CDS scenario id (ssp1_2_6) -> public scenario id (ssp126) used in the app/schema.
SCENARIO_ID = {
    "ssp1_1_9": "ssp119", "ssp1_2_6": "ssp126", "ssp2_4_5": "ssp245",
    "ssp3_7_0": "ssp370", "ssp5_8_5": "ssp585",
}
# filename short var -> public variable id
VARIABLE_ID = {"air-temperature": "temperature", "precipitation": "precipitation",
               "relative-humidity": "humidity"}
SOURCE = "CMIP6/ScenarioMIP ensemble + IPCC AR6"


def grid_rows():
    """Yield (variable, scenario, decade, lat, lng, mean, std, n, unit) for every
    non-NaN cell across all grid files in out/."""
    for path in sorted(glob.glob(os.path.join(OUT, "*__*.nc"))):
        base = os.path.basename(path)[:-3]
        short_var, cds_scn = base.split("__")
        variable = VARIABLE_ID.get(short_var, short_var)
        scenario = SCENARIO_ID.get(cds_scn, cds_scn)
        ds = xr.open_dataset(path)
        unit = ds.attrs.get("units", "absolute")
        lats = ds.lat.values
        lons = ds.lon.values
        for di, d in enumerate(ds.decade.values):
            mean = ds.delta_mean.isel(decade=di).values
            std = ds.delta_std.isel(decade=di).values
            n = int(ds.n_models.isel(decade=di))
            valid = ~np.isnan(mean)
            ii, jj = np.where(valid)
            for i, j in zip(ii, jj):
                s = std[i, j]
                yield (variable, scenario, int(d), float(lats[i]), float(lons[j]),
                       round(float(mean[i, j]), 3),
                       None if np.isnan(s) else round(float(s), 3),
                       n, unit)
        ds.close()


def calibration_rows():
    path = os.path.join(OUT, "calibration.json")
    if not os.path.exists(path):
        return []
    data = json.load(open(path))
    variable = "temperature"  # calibrate.py is temperature-only by design
    rows = []
    for cds_scn, decades in data.get("factors", {}).items():
        scenario = SCENARIO_ID.get(cds_scn, cds_scn)
        for d, r in decades.items():
            rows.append((variable, scenario, int(d), r["k"],
                         r["raw_global"], r["assessed_global"], SOURCE))
    return rows


def dry_run():
    n_cells = 0
    by_file = {}
    for row in grid_rows():
        n_cells += 1
        key = f"{row[0]}/{row[1]}"
        by_file[key] = by_file.get(key, 0) + 1
    cal = calibration_rows()
    print(f"climate_grid rows (non-NaN cells): {n_cells:,}")
    print(f"climate_calibration rows: {len(cal)}")
    print(f"est. DB size @ ~60 B/row: ~{n_cells * 60 / 1e6:.0f} MB")
    print("per variable/scenario:")
    for k in sorted(by_file):
        print(f"  {k:28} {by_file[k]:>8,}")


def load_db():
    import psycopg2
    from psycopg2.extras import execute_values
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL not set — refusing to guess the production DB.")
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    grid_sql = """
        INSERT INTO climate_grid
          (variable, scenario, decade, lat_key, lng_key, delta_mean, delta_std,
           n_models, unit, source, method_version)
        VALUES %s
        ON CONFLICT (variable, scenario, decade, lat_key, lng_key) DO UPDATE SET
          delta_mean=EXCLUDED.delta_mean, delta_std=EXCLUDED.delta_std,
          n_models=EXCLUDED.n_models, unit=EXCLUDED.unit, source=EXCLUDED.source,
          method_version=EXCLUDED.method_version
    """
    batch, total = [], 0
    for (variable, scenario, d, lat, lng, mean, std, n, unit) in grid_rows():
        batch.append((variable, scenario, d, lat, lng, mean, std, n, unit,
                      SOURCE, METHOD_VERSION))
        if len(batch) >= 5000:
            execute_values(cur, grid_sql, batch); total += len(batch); batch = []
            print(f"  ...{total:,} grid rows", flush=True)
    if batch:
        execute_values(cur, grid_sql, batch); total += len(batch)

    cal_sql = """
        INSERT INTO climate_calibration
          (variable, scenario, decade, k, raw_global, assessed_global, source)
        VALUES %s
        ON CONFLICT (variable, scenario, decade) DO UPDATE SET
          k=EXCLUDED.k, raw_global=EXCLUDED.raw_global,
          assessed_global=EXCLUDED.assessed_global, source=EXCLUDED.source
    """
    cal = calibration_rows()
    if cal:
        execute_values(cur, cal_sql, cal)
    conn.commit()
    cur.close(); conn.close()
    print(f"loaded {total:,} grid rows + {len(cal)} calibration rows")


if __name__ == "__main__":
    (dry_run if "--dry-run" in sys.argv else load_db)()
