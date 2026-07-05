#!/usr/bin/env python3
"""
hindcast_validation.py — present-day accuracy audit for the grounded engine.

Compares the model's present-day annual-mean temperature against INDEPENDENT
observations (Open-Meteo ERA5 reanalysis archive) at a spread of cities, and
writes a residuals report. This is the accountability keystone: it turns
"the baseline is calibrated" into a measured, published number instead of an
assertion.

Method + honest caveats:
  - Model: grounded_model.project(lat, lng, 2025, ssp245).annual_mean.
  - Observed: Open-Meteo ERA5 daily mean temperature averaged over 2015-2024
    (a recent ~decadal normal; window center ~2019.5).
  - Residual = model(2025) - observed(2015-2024).
  - The model year (2025) is ~5 years AFTER the observation-window center, so a
    correctly-anchored model should read slightly WARMER than the window
    (~+0.1-0.2 C from trend). A NEGATIVE residual therefore indicates a cold
    lean beyond what the time offset explains.
  - ERA5 is ~25 km reanalysis; for a point city it can differ from a station /
    high-res product by ~0.5 C (representativeness). Treat the per-city number
    as indicative; the aggregate bias is the load-bearing signal.

Run from repo root:  python3 scripts/hindcast_validation.py
Writes: data/hindcast-validation.openmeteo.json
"""
import json
import os
import sys
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
import grounded_model as gm  # noqa: E402

OBS_START, OBS_END = 2015, 2024
MODEL_YEAR, SCENARIO = 2025, "ssp245"

# Diverse spread: latitude bands, climates, hemispheres, coastal + inland.
CITIES = [
    ("Helsinki", 60.17, 24.94), ("Reykjavik", 64.15, -21.94), ("London", 51.51, -0.13),
    ("Berlin", 52.52, 13.40), ("Madrid", 40.42, -3.70), ("Moscow", 55.76, 37.62),
    ("Chicago", 41.88, -87.63), ("New York", 40.71, -74.01), ("Tokyo", 35.68, 139.69),
    ("Cairo", 30.04, 31.24), ("Delhi", 28.61, 77.21), ("Mumbai", 19.08, 72.88),
    ("Lagos", 6.52, 3.38), ("Nairobi", -1.29, 36.82), ("Singapore", 1.35, 103.82),
    ("Sao Paulo", -23.55, -46.63), ("Sydney", -33.87, 151.21), ("Buenos Aires", -34.60, -58.38),
]


def observed_annual_mean(lat, lng, start, end, retries=4):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}"
        f"&start_date={start}-01-01&end_date={end}-12-31&daily=temperature_2m_mean&timezone=UTC"
    )
    delay = 2.0
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                data = json.load(r)
            vals = [x for x in data["daily"]["temperature_2m_mean"] if x is not None]
            return sum(vals) / len(vals)
        except Exception as exc:  # noqa: BLE001 - retry on 429 / transient
            if attempt == retries - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def main():
    results = []
    for name, lat, lng in CITIES:
        model_mean = gm.project(lat, lng, MODEL_YEAR, SCENARIO)["temperature"]["annual_mean"]
        obs_mean = observed_annual_mean(lat, lng, OBS_START, OBS_END)
        residual = round(model_mean - obs_mean, 2)
        results.append({
            "city": name, "lat": lat, "lng": lng,
            "model_annual_mean_c": round(model_mean, 2),
            "observed_annual_mean_c": round(obs_mean, 2),
            "residual_c": residual,
        })
        print(f"{name:14} model={model_mean:6.2f}  obs={obs_mean:6.2f}  residual={residual:+.2f}")
        time.sleep(0.8)  # be polite to the free API

    res = [r["residual_c"] for r in results]
    n = len(res)
    bias = sum(res) / n
    mae = sum(abs(x) for x in res) / n
    rmse = (sum(x * x for x in res) / n) ** 0.5
    summary = {
        "n_cities": n,
        "mean_bias_c": round(bias, 3),
        "mean_absolute_error_c": round(mae, 3),
        "rmse_c": round(rmse, 3),
        "max_cold_residual_c": round(min(res), 2),
        "max_warm_residual_c": round(max(res), 2),
    }
    artifact = {
        "version": "hindcast-validation-v1",
        "methodVersion": gm.project(0, 0, MODEL_YEAR, SCENARIO)["metadata"]["model_version"],
        "comparisonType": "model present-day vs independent ERA5 reanalysis observations",
        "model": {"year": MODEL_YEAR, "scenario": SCENARIO, "variable": "annual_mean_temperature_c"},
        "observed": {
            "source": "Open-Meteo ERA5 archive (daily temperature_2m_mean)",
            "period": f"{OBS_START}-{OBS_END}",
            "window_center_year": (OBS_START + OBS_END) / 2,
        },
        "method": __doc__.strip().split("Method + honest caveats:")[1].strip(),
        "summary": summary,
        "results": results,
        "caveats": [
            "ERA5 ~25km reanalysis differs from station/high-res products at a point by ~0.5C (representativeness).",
            "Model year 2025 is ~5yr after the observation-window center; a correct model reads slightly warmer than the window.",
            "Aggregate bias/RMSE are the load-bearing signal; per-city residuals are indicative.",
            "This validates present-day temperature only; precipitation and extremes need separate hindcasts.",
        ],
    }
    out = os.path.join(REPO, "data", "hindcast-validation.openmeteo.json")
    with open(out, "w") as f:
        json.dump(artifact, f, indent=2)
        f.write("\n")
    print(f"\nbias={summary['mean_bias_c']:+.3f}C  MAE={summary['mean_absolute_error_c']:.3f}C  "
          f"RMSE={summary['rmse_c']:.3f}C  (n={n})")
    print(f"wrote {os.path.relpath(out, REPO)}")


if __name__ == "__main__":
    main()
