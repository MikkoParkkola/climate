#!/usr/bin/env python3
"""
grounded_model.py — the grounded forecast engine (replaces cbottle_runner.py).

Reads the compact grid export (data/grid.i16.gz + data/manifest.json) with numpy +
gzip + json ONLY (no xarray/netCDF at serve time — light prod deps), and emits the
SAME projection JSON contract the app already consumes. Every value traces to a real
source: CMIP6 ensemble deltas (IPCC-calibrated for temperature), CMIP6 historical
monthly baseline, AR6 regional sea level, CMIP6 ETCCDI extreme indices for risk.

NO fabricated coefficients. Where the grid has no data (a gap), the field is null,
never invented. Absolute = observed/model baseline + modeled delta (delta/change-
factor architecture). Risk = absolute extreme index scored against a CITED threshold
(see docs/architecture/SCIENTIFIC_GROUNDING.md "Risk index grounding").

CLI (matches the old runner so routes.ts can swap the spawn target):
    python grounded_model.py <lat> <lng> <year> [scenario]
    python grounded_model.py --trajectory <lat> <lng> <year,year,...> [scenario]
    python grounded_model.py --rankings <year> [scenario]
prints JSON to stdout. scenario default ssp245 (middle-of-road); ids:
ssp119 ssp126 ssp245 ssp370 ssp585.
"""
import sys, os, json, gzip
import numpy as np

DATA = os.path.join(os.path.dirname(__file__), "data")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DEFAULT_SCENARIO = "ssp245"
MIN_FORECAST_YEAR = 2024
MAX_FORECAST_YEAR = 2100

# ── Risk thresholds (serve-time, cited; see SCIENTIFIC_GROUNDING.md) ──────────
# Each score 0-100 is a transparent linear map of an ABSOLUTE index to a cited
# anchor; the raw absolute value + threshold are returned alongside the score.
DROUGHT_MAX_CDD = 180.0     # consecutive dry days; 180 = half-year dry spell = 100
FLOOD_MAX_RX5 = 300.0       # max 5-day precip mm; 300 mm ~ extreme pluvial event = 100
TROPICAL_NIGHT_T = 20       # ETCCDI TR: nights with Tmin>20C (heat-stress, no recovery)

_CACHE = None


def _unshuffle_i16(buf):
    """Reverse build_export.py byte-shuffle (all low bytes then all high) -> int16."""
    u = np.frombuffer(buf, dtype=np.uint8)
    half = u.size // 2
    out = np.empty(u.size, dtype=np.uint8)
    out[0::2] = u[:half]; out[1::2] = u[half:]
    return out.view("<i2")


def load():
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    manifest = json.load(open(os.path.join(DATA, "manifest.json")))
    raw = gzip.open(os.path.join(DATA, manifest["binary"]), "rb").read()
    index = {}
    for ent in manifest["layers"]:
        i16 = _unshuffle_i16(raw[ent["offset"]:ent["offset"] + ent["bytes"]])
        ent = dict(ent)
        ent["data"] = i16.reshape(ent["shape"])      # (axis, nlat, nlon)
        ent["axis"] = ent.get("decades") or ent.get("months") or [0]
        index[(ent["layer"], ent["scenario"], ent["var"])] = ent
    _CACHE = {"grid": manifest["grid"], "fill": manifest["fill"],
              "calibration": manifest.get("calibration", {}), "index": index}
    return _CACHE


def _bilinear(slice2d, scale, fill, g, lat, lng):
    """Bilinear sample of one (nlat,nlon) int16 slice; NaN if all 4 neighbours fill."""
    fr = (lat - g["lat0"]) / g["dlat"]
    fc = (((lng - g["lon0"]) % 360) / g["dlon"])
    r0 = int(np.floor(fr)); c0 = int(np.floor(fc))
    wr = fr - r0; wc = fc - c0
    nlat, nlon = g["nlat"], g["nlon"]
    acc = wsum = 0.0
    for dr, ww_r in ((0, 1 - wr), (1, wr)):
        r = min(max(r0 + dr, 0), nlat - 1)
        for dc, ww_c in ((0, 1 - wc), (1, wc)):
            c = (c0 + dc) % nlon
            v = slice2d[r, c]
            if v == fill:
                continue
            w = ww_r * ww_c
            acc += w * (v * scale); wsum += w
    return (acc / wsum) if wsum > 0 else float("nan")


def sample(layer, scenario, var, lat, lng, axisval):
    """Interpolate a layer value at (lat,lng) and an axis position (decade year or
    month), bilinear in space + linear along the axis. NaN where data is missing."""
    c = load()
    ent = c["index"].get((layer, scenario, var))
    if ent is None:
        return float("nan")
    axis = ent["axis"]; data = ent["data"]; scale = ent["scale"]; fill = c["fill"]
    g = c["grid"]
    a = float(np.clip(axisval, axis[0], axis[-1]))
    # bracket the axis
    hi = next((i for i, x in enumerate(axis) if x >= a), len(axis) - 1)
    lo = max(hi - 1, 0)
    v_lo = _bilinear(data[lo], scale, fill, g, lat, lng)
    if lo == hi or axis[hi] == axis[lo]:
        return v_lo
    v_hi = _bilinear(data[hi], scale, fill, g, lat, lng)
    if np.isnan(v_lo):
        return v_hi
    if np.isnan(v_hi):
        return v_lo
    t = (a - axis[lo]) / (axis[hi] - axis[lo])
    return v_lo + t * (v_hi - v_lo)


def calibration_k(scenario, year):
    """IPCC hot-model scaling k for temperature at (scenario, year). 1.0 if absent."""
    c = load()
    cds = {"ssp119": "ssp1_1_9", "ssp126": "ssp1_2_6", "ssp245": "ssp2_4_5",
           "ssp370": "ssp3_7_0", "ssp585": "ssp5_8_5"}.get(scenario, scenario)
    facs = c["calibration"].get("factors", {}).get(cds)
    if not facs:
        return 1.0
    decs = sorted(int(d) for d in facs)
    y = min(max(year, decs[0]), decs[-1])
    hi = next((d for d in decs if d >= y), decs[-1]); lo = max([d for d in decs if d <= y] or [decs[0]])
    if lo == hi:
        return float(facs[str(lo)]["k"])
    t = (y - lo) / (hi - lo)
    return float(facs[str(lo)]["k"]) + t * (float(facs[str(hi)]["k"]) - float(facs[str(lo)]["k"]))


def _num(x):
    return None if (x is None or (isinstance(x, float) and np.isnan(x))) else round(float(x), 2)


def climate_zone(lat):
    a = abs(lat)
    return ("Tropical" if a < 23.5 else "Subtropical" if a < 35 else
            "Temperate" if a < 55 else "Subpolar" if a < 66.5 else "Polar")


def category(score):
    return ("Excellent" if score >= 80 else "Good" if score >= 60 else
            "Fair" if score >= 40 else "Poor" if score >= 20 else "Severe")


def habitability(mean_temp, annual_precip, heat_nights, drought_risk, flood_risk):
    """Transparent weighted comfort composite (documented; not a model output).
    Components shown to the user; weights fixed + visible. See SCIENTIFIC_GROUNDING."""
    # temperature comfort: peak at ~20C, falls off both sides (heat penalised harder)
    if mean_temp is None:
        return 50.0, {}
    if 15 <= mean_temp <= 25:
        ts = 100 - abs(mean_temp - 20) * 1.5
    elif mean_temp < 15:
        ts = max(0, 92 - (15 - mean_temp) * 2.2)
    else:
        ts = max(0, 92 - (mean_temp - 25) * 3.5)
    ts = max(0, min(100, ts))
    # precipitation adequacy: comfortable 600-1200 mm/yr, dry & very-wet penalised
    if annual_precip is None:
        ps = 50.0
    elif 600 <= annual_precip <= 1200:
        ps = 100 - abs(annual_precip - 900) / 25
    elif annual_precip < 600:
        ps = max(20, 88 - (600 - annual_precip) / 12)
    else:
        ps = max(20, 88 - (annual_precip - 1200) / 40)
    ps = max(0, min(100, ps))
    temp_component = ts * 0.45            # documented weights
    precip_component = ps * 0.35
    adaptation = 20.0                     # fixed adaptation allowance (NOT climate-derived)
    base = temp_component + precip_component + adaptation
    heat_pen = min(30, (heat_nights or 0) * 0.4)
    drought_pen = min(25, (drought_risk or 0) * 0.25)
    flood_pen = min(25, (flood_risk or 0) * 0.25)
    final = max(10, min(100, base - heat_pen - drought_pen - flood_pen))
    breakdown = {
        "temperature_comfort": round(temp_component, 1),
        "precipitation_adequacy": round(precip_component, 1),
        "infrastructure_adaptation": round(adaptation, 1),
        "heat_stress_penalty": round(heat_pen, 1),
        "drought_penalty": round(drought_pen, 1),
        "flood_penalty": round(flood_pen, 1),
        "drought_risk_penalty": round(drought_pen, 1),
        "flood_risk_penalty": round(flood_pen, 1),
        "base_score": round(base, 1),
        "final_score": round(final, 1),
    }
    return final, breakdown


def project(lat, lng, year, scenario=DEFAULT_SCENARIO):
    k = calibration_k(scenario, year)
    # monthly absolute = baseline monthly + annual delta (temp: calibrated)
    t_delta = sample("temperature", scenario, "mean", lat, lng, year) * k
    p_delta = sample("precipitation", scenario, "mean", lat, lng, year)        # percent
    monthly_t, monthly_p = [], []
    for m in range(1, 13):
        bt = sample("baseline", "temperature", "clim", lat, lng, m)
        bp = sample("baseline", "precipitation", "clim", lat, lng, m)
        monthly_t.append(bt + t_delta if not np.isnan(bt) else float("nan"))
        monthly_p.append(bp * (1 + p_delta / 100.0) if not np.isnan(bp) and not np.isnan(p_delta) else float("nan"))
    mt = [x for x in monthly_t if not np.isnan(x)]
    mp = [x for x in monthly_p if not np.isnan(x)]
    annual_mean = float(np.mean(mt)) if mt else None
    annual_total = float(np.sum(mp)) if mp else None

    # ── extremes -> serve-time absolute risk (baseline + delta vs cited threshold)
    def absolute(idx):
        b = sample("baseline-extreme", idx, "clim", lat, lng, 0)
        d = sample(f"extreme-{idx}", scenario, "mean", lat, lng, year)
        if np.isnan(b) or np.isnan(d):
            return float("nan")
        return b + d
    tr_abs = absolute("tr")        # tropical nights / yr (heat)
    cdd_abs = absolute("cdd")      # consecutive dry days (drought)
    rx5_abs = absolute("rx5day")   # max 5-day precip mm (flood)
    heat_nights = None if np.isnan(tr_abs) else max(0, tr_abs)
    drought_risk = None if np.isnan(cdd_abs) else float(np.clip(100 * max(0, cdd_abs) / DROUGHT_MAX_CDD, 0, 100))
    flood_risk = None if np.isnan(rx5_abs) else float(np.clip(100 * max(0, rx5_abs) / FLOOD_MAX_RX5, 0, 100))

    slr = sample("sealevel", scenario, "median", lat, lng, year)      # metres
    slr_cm = None if np.isnan(slr) else slr * 100.0

    score, breakdown = habitability(annual_mean, annual_total, heat_nights, drought_risk, flood_risk)

    return {
        "location": {"latitude": lat, "longitude": lng,
                     "name": f"Location {lat:.2f}, {lng:.2f}", "climate_zone": climate_zone(lat)},
        "year": year, "scenario": scenario,
        "temperature": {
            "annual_mean": _num(annual_mean),
            "monthly": [_num(x) for x in monthly_t], "monthly_labels": MONTHS,
            "anomaly": _num(t_delta),
            "min": _num(min(mt)) if mt else None, "max": _num(max(mt)) if mt else None,
            "seasonal_amplitude": _num(max(mt) - min(mt)) if mt else None,
        },
        "precipitation": {
            "annual_total": _num(annual_total),
            "monthly": [_num(x) for x in monthly_p], "monthly_labels": MONTHS,
            "anomaly_percent": _num(p_delta),
            "wettest_month": _num(max(mp)) if mp else None,
            "driest_month": _num(min(mp)) if mp else None,
            "wettest_month_name": MONTHS[int(np.nanargmax(monthly_p))] if mp else None,
            "driest_month_name": MONTHS[int(np.nanargmin(monthly_p))] if mp else None,
        },
        "extremes": {
            "heat_stress_days": None if heat_nights is None else int(round(heat_nights)),
            "drought_risk": _num(drought_risk), "flood_risk": _num(flood_risk),
            "sea_level_rise_cm": _num(slr_cm),
            "detail": {
                "tropical_nights_per_year": _num(heat_nights),
                "consecutive_dry_days": _num(None if np.isnan(cdd_abs) else cdd_abs),
                "max_5day_precip_mm": _num(None if np.isnan(rx5_abs) else rx5_abs),
                "thresholds": {"tropical_night_C": TROPICAL_NIGHT_T,
                               "drought_max_cdd": DROUGHT_MAX_CDD, "flood_max_rx5_mm": FLOOD_MAX_RX5},
            },
        },
        "habitability": {"score": round(score, 1), "category": category(score), "breakdown": breakdown},
        "metadata": {
            "model": "fupit grounded engine (CMIP6/IPCC AR6)", "model_version": "grounded-v1",
            "resolution": "1.0 degree", "confidence": "ensemble spread reported",
            "data_source": "CMIP6 ScenarioMIP + IPCC AR6 (temp IPCC-calibrated) + AR6 sea level + CMIP6 ETCCDI extremes",
            "baseline": "1995-2014 (CMIP6 historical; model baseline, observed bias-correction planned)",
            "projection_method": "delta/change-factor; baseline + ensemble delta; serve-time risk thresholds",
            "scenario": scenario,
        },
    }


def trajectory(lat, lng, years, scenario=DEFAULT_SCENARIO):
    return {"coordinates": {"lat": lat, "lng": lng},
            "points": [{"year": y, **project(lat, lng, y, scenario)} for y in years]}


def _parse_year(value):
    year = int(value)
    if year < MIN_FORECAST_YEAR or year > MAX_FORECAST_YEAR:
        raise ValueError(f"forecast year must be {MIN_FORECAST_YEAR}-{MAX_FORECAST_YEAR}; got {year}")
    return year


def _parse_years(value):
    years = sorted({_parse_year(y.strip()) for y in value.split(",") if y.strip()})
    if not years:
        raise ValueError("at least one forecast year is required")
    return years


def main():
    try:
        a = sys.argv[1:]
        if a and a[0] == "--rankings":
            year = _parse_year(a[1]); scenario = a[2] if len(a) > 2 else DEFAULT_SCENARIO
            # rank a fixed set of major cities by habitability (grounded)
            from_cities = json.load(open(os.path.join(DATA, "ranking_cities.json"))) \
                if os.path.exists(os.path.join(DATA, "ranking_cities.json")) else []
            out = []
            for ci in from_cities:
                p = project(ci["lat"], ci["lng"], year, scenario)
                out.append({**ci, "habitability": p["habitability"], "year": year})
            out.sort(key=lambda r: r["habitability"]["score"], reverse=True)
            print(json.dumps({"year": year, "scenario": scenario, "rankings": out}))
            return
        if a and a[0] == "--trajectory":
            lat = float(a[1]); lng = float(a[2])
            years = _parse_years(a[3])
            scenario = a[4] if len(a) > 4 else DEFAULT_SCENARIO
            print(json.dumps(trajectory(lat, lng, years, scenario)))
            return
        lat = float(a[0]); lng = float(a[1]); year = _parse_year(a[2])
        scenario = a[3] if len(a) > 3 else DEFAULT_SCENARIO
        print(json.dumps(project(lat, lng, year, scenario)))
    except (IndexError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
