#!/usr/bin/env python3
"""
grounded_model.py — the grounded forecast engine (replaces cbottle_runner.py).

Reads compact grid exports with numpy + gzip + json ONLY (no xarray/netCDF at
serve time — light prod deps), and emits the SAME projection JSON contract the app
already consumes. Every value traces to a real source: raw CMIP6 ensemble deltas,
IPCC assessed temperature calibration reported alongside the raw model consensus,
WorldClim observed monthly baseline where available, AR6 regional sea level,
CMIP6 ETCCDI extreme indices for risk.

NO fabricated coefficients. Where the grid has no data (a gap), the field is null,
never invented. Absolute = observed/model baseline + modeled delta (delta/change-
factor architecture). Risk = absolute extreme index scored against a CITED threshold
(see docs/architecture/SCIENTIFIC_GROUNDING.md "Risk index grounding").

CLI (matches the old runner so routes.ts can swap the spawn target):
    python grounded_model.py <lat> <lng> <year> [scenario]
    python grounded_model.py --trajectory <lat> <lng> <year,year,...> [scenario]
    python grounded_model.py --rankings <year> [scenario]
prints JSON to stdout. scenario default ssp245 (middle-of-road). Full
habitability forecasts currently support ssp126, ssp245, ssp370, and ssp585.
SSP1-1.9 temperature/precipitation layers exist in the source grid, but the
ETCCDI extremes source lacks SSP1-1.9, so the app rejects it instead of serving
habitability scores with missing heat/drought/flood penalties.
"""
import sys, os, json, gzip
import numpy as np

DATA = os.path.join(os.path.dirname(__file__), "data")
OBSERVED_BASELINE_MANIFEST = "worldclim10m.manifest.json"
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DEFAULT_SCENARIO = "ssp245"
SERVABLE_SCENARIOS = {"ssp126", "ssp245", "ssp370", "ssp585"}
MIN_FORECAST_YEAR = 2024
MAX_FORECAST_YEAR = 2100
SOURCE_TRAIL = [
    {
        "label": "Temperature",
        "source": "CMIP6 ScenarioMIP ensemble, with IPCC AR6 assessed calibration reported alongside",
        "method": "headline value is observed monthly baseline where available plus raw ensemble anomaly; IPCC assessed anomaly is returned separately",
        "citation": "IPCC AR6 WGI SPM Table SPM.1; CMIP6 / Eyring et al. 2016",
    },
    {
        "label": "Precipitation",
        "source": "CMIP6 ScenarioMIP ensemble",
        "method": "observed monthly baseline where available multiplied by ensemble percent change",
        "citation": "CMIP6 / Eyring et al. 2016",
    },
    {
        "label": "Observed baseline",
        "source": "WorldClim v2.1 current conditions",
        "method": "10 arc-minute monthly climatology for 1970-2000; CMIP6 model baseline fallback where observed land baseline is unavailable",
        "citation": "Fick & Hijmans 2017",
    },
    {
        "label": "Sea level",
        "source": "IPCC AR6 regional sea-level projections",
        "method": "regional median plus low/high range sampled at the coast; inland locations are reported as not applicable",
        "citation": "IPCC AR6 sea-level projections; NASA AR6 archive",
    },
    {
        "label": "Heat, drought, flood",
        "source": "CMIP6 ETCCDI extreme-climate indices",
        "method": "absolute future index scored against documented thresholds",
        "citation": "Sillmann et al. 2013; IPCC AR6 WGI Ch.11",
    },
    {
        "label": "Humid heat screen",
        "source": "CMIP6 near-surface relative humidity plus Stull wet-bulb approximation",
        "method": "monthly mean air temperature and relative humidity produce a max monthly mean wet-bulb screen; no daily exceedance count or WBGT is inferred",
        "citation": "Stull 2011; CMIP6 / Eyring et al. 2016",
    },
]

# ── Risk thresholds (serve-time, cited; see SCIENTIFIC_GROUNDING.md) ──────────
# Each score 0-100 is a transparent linear map of an ABSOLUTE index to a cited
# anchor; the raw absolute value + threshold are returned alongside the score.
DROUGHT_MAX_CDD = 180.0     # consecutive dry days; 180 = half-year dry spell = 100
FLOOD_MAX_RX5 = 300.0       # max 5-day precip mm; 300 mm ~ extreme pluvial event = 100
TROPICAL_NIGHT_T = 20       # ETCCDI TR: nights with Tmin>20C (heat-stress, no recovery)
WET_BULB_RH_MIN = 5.0       # Stull approximation validity/capping domain for RH (%)
WET_BULB_RH_MAX = 99.0
WET_BULB_TEMP_MIN = -20.0   # Stull 2011 practical approximation domain (C)
WET_BULB_TEMP_MAX = 50.0

# ── Habitability scoring (transparent; hazards grounded, comfort is a stated preference) ──
# The comfort term encodes a temperate-human thermal preference (optimum adjustable on the
# live single-location path). The penalties are grounded, cited hazard indices. See
# docs/architecture/SCIENTIFIC_GROUNDING.md "Habitability scoring".
COMFORT_OPTIMUM_C = 20.0      # default thermal-comfort optimum (user-adjustable; rankings use the default)
COMFORT_PLATEAU_C = 3.0       # +/- band around the optimum scored as fully comfortable
COMFORT_HEAT_SLOPE = 3.5      # comfort points lost per C above the plateau (heat penalised hardest)
COMFORT_COLD_SLOPE = 3.0      # comfort points lost per C below the plateau
COMFORT_WEIGHT_TEMP = 0.6     # base = temp comfort * 0.6 + precip adequacy * 0.4 (sum 1.0, 0-100 scale)
COMFORT_WEIGHT_PRECIP = 0.4
HEAT_NIGHTS_PEN_PER = 0.4     # penalty per tropical night (ETCCDI TR), capped
HEAT_NIGHTS_PEN_MAX = 25.0
WETBULB_PEN_LOW_C = 18.0      # monthly-mean wet-bulb at/below this -> no humid-heat penalty
WETBULB_PEN_HIGH_C = 28.0     # monthly-mean wet-bulb at/above this -> max humid-heat penalty
WETBULB_PEN_MAX = 35.0        # strongest single penalty: humid-heat survivability dominates habitability
DROUGHT_PEN_MAX = 25.0
FLOOD_PEN_MAX = 25.0

# ── Coastal mask (sea-level rise is only meaningful near a coast) ──
# 75 km = smallest radius that classified a 20-city validation set (10 coastal,
# 10 inland) with zero errors; biased small so inland points are never shown a
# fabricated sea-level number (a false "N/A" is honest; a false number is not).
COAST_RADIUS_KM = 75.0        # a land point is "coastal" if ocean lies within this distance
KM_PER_DEG = 111.32

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
              "calibration": manifest.get("calibration", {}), "index": index,
              "observed": load_observed_baseline()}
    return _CACHE


def load_observed_baseline():
    manifest_path = os.path.join(DATA, OBSERVED_BASELINE_MANIFEST)
    if not os.path.exists(manifest_path):
        return None
    manifest = json.load(open(manifest_path))
    raw = gzip.open(os.path.join(DATA, manifest["binary"]), "rb").read()
    index = {}
    for ent in manifest["layers"]:
        i16 = _unshuffle_i16(raw[ent["offset"]:ent["offset"] + ent["bytes"]])
        ent = dict(ent)
        ent["data"] = i16.reshape(ent["shape"])
        ent["axis"] = ent["months"]
        index[(ent["layer"], ent["scenario"], ent["var"])] = ent
    return {"grid": manifest["grid"], "fill": manifest["fill"], "index": index,
            "source": manifest.get("source", {})}


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


def projection_year_basis(scenario, year):
    """Describe which packed scenario year(s) back a requested forecast year."""
    c = load()
    ent = c["index"].get(("temperature", scenario, "mean"))
    if ent is None:
        return {
            "requested_year": year,
            "cadence": "projection year basis unavailable because the scenario layer is missing",
            "mode": "missing",
        }
    axis = ent["axis"]
    effective = float(np.clip(year, axis[0], axis[-1]))
    hi = next((i for i, x in enumerate(axis) if x >= effective), len(axis) - 1)
    lo = max(hi - 1, 0)
    source_low = int(axis[lo])
    source_high = int(axis[hi])
    cadence = "scenario layers are decadal 2030-2100; in-between years are linearly interpolated"
    if year < axis[0]:
        mode = "clamped-earliest-source-year"
        note = (
            f"Requested year {year} is before the first packed scenario layer; "
            f"the earliest available {source_low} source layer is used."
        )
    elif year > axis[-1]:
        mode = "clamped-latest-source-year"
        note = (
            f"Requested year {year} is after the last packed scenario layer; "
            f"the latest available {source_high} source layer is used."
        )
    elif lo == hi or source_low == source_high:
        mode = "direct-source-year"
        note = f"Requested year {year} uses the packed {source_low} source layer."
    else:
        mode = "linear-interpolation"
        note = f"Requested year {year} is linearly interpolated between packed {source_low} and {source_high} source layers."
    return {
        "requested_year": year,
        "source_year_low": source_low,
        "source_year_high": source_high,
        "effective_source_year": round(effective, 2),
        "mode": mode,
        "cadence": cadence,
        "note": note,
    }


def sample_observed_baseline(scenario, lat, lng, month):
    c = load()
    observed = c.get("observed")
    if not observed:
        return float("nan")
    ent = observed["index"].get(("observed-baseline", scenario, "clim"))
    if ent is None:
        return float("nan")
    idx = int(month) - 1
    if idx < 0 or idx >= ent["data"].shape[0]:
        return float("nan")
    return _bilinear(ent["data"][idx], ent["scale"], observed["fill"],
                     observed["grid"], lat, lng)


def is_coastal(lat, lng):
    """True if (lat,lng) is at sea or within COAST_RADIUS_KM of ocean, using the
    WorldClim land-only baseline as a land/ocean mask. Sea-level rise is only
    meaningful near a coast, so inland points return None for sea level instead of
    a fabricated number.
    KNOWN CEILING: WorldClim masks large lakes the same as ocean, so cities beside
    the Great Lakes / Caspian can false-positive. Documented in the methodology;
    upgrade path is a true ocean polygon mask. Fails open if no mask is loaded."""
    c = load()
    observed = c.get("observed")
    if not observed:
        return True
    ent = observed["index"].get(("observed-baseline", "temperature", "clim"))
    if ent is None:
        return True
    g = observed["grid"]; fill = observed["fill"]
    data = ent["data"][0]  # any month works; the land/ocean mask is month-invariant
    nlat, nlon = g["nlat"], g["nlon"]
    r0 = int(np.floor((lat - g["lat0"]) / g["dlat"] + 0.5))   # nearest cell (half-up, matches JS)
    c0 = int(np.floor(((lng - g["lon0"]) % 360) / g["dlon"] + 0.5))
    r0 = min(max(r0, 0), nlat - 1); c0 = c0 % nlon
    if data[r0, c0] == fill:
        return True  # the point itself is sea/water -> sea level applies
    lat_steps = max(1, int(np.ceil(COAST_RADIUS_KM / (KM_PER_DEG * abs(g["dlat"])))))
    coslat = max(0.05, float(np.cos(np.radians(lat))))
    lon_steps = max(1, int(np.ceil(COAST_RADIUS_KM / (KM_PER_DEG * abs(g["dlon"]) * coslat))))
    lon_steps = min(lon_steps, nlon // 2)
    for dr in range(-lat_steps, lat_steps + 1):
        rr = r0 + dr
        if rr < 0 or rr >= nlat:
            continue
        for dc in range(-lon_steps, lon_steps + 1):
            if data[rr, (c0 + dc) % nlon] == fill:
                return True
    return False


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


def wet_bulb_stull_c(temp_c, relative_humidity_pct):
    """Stull 2011 empirical wet-bulb approximation from air temp (C) and RH (%)."""
    if np.isnan(temp_c) or np.isnan(relative_humidity_pct):
        return float("nan"), float("nan")
    rh_physical = float(np.clip(relative_humidity_pct, 0.0, 100.0))
    rh_formula = float(np.clip(rh_physical, WET_BULB_RH_MIN, WET_BULB_RH_MAX))
    tw = (
        temp_c * np.arctan(0.151977 * np.sqrt(rh_formula + 8.313659))
        + np.arctan(temp_c + rh_formula)
        - np.arctan(rh_formula - 1.676331)
        + 0.00391838 * (rh_formula ** 1.5) * np.arctan(0.023101 * rh_formula)
        - 4.686035
    )
    return tw, rh_formula


def climate_zone(lat):
    a = abs(lat)
    return ("Tropical" if a < 23.5 else "Subtropical" if a < 35 else
            "Temperate" if a < 55 else "Subpolar" if a < 66.5 else "Polar")


def category(score):
    return ("Excellent" if score >= 80 else "Good" if score >= 60 else
            "Fair" if score >= 40 else "Poor" if score >= 20 else "Severe")


def habitability(mean_temp, annual_precip, heat_nights, drought_risk, flood_risk,
                 wet_bulb_max=None, comfort_optimum=COMFORT_OPTIMUM_C):
    """Hazard-led habitability composite (documented; not a model output).
    Grounded, cited hazard penalties (humid heat via wet-bulb, heat nights, drought,
    flood) are subtracted from a base built of a STATED temperate-human comfort
    preference (temperature optimum adjustable) plus rainfall adequacy. Every
    component is returned in the breakdown. See SCIENTIFIC_GROUNDING.md."""
    if mean_temp is None:
        return 50.0, {}
    # temperature comfort: flat plateau around the (adjustable) optimum, then linear
    # falloff; heat is penalised harder than cold, and genuinely hostile cold reaches 0.
    d = abs(mean_temp - comfort_optimum)
    if d <= COMFORT_PLATEAU_C:
        ts = 100.0
    elif mean_temp > comfort_optimum:
        ts = 100.0 - (d - COMFORT_PLATEAU_C) * COMFORT_HEAT_SLOPE
    else:
        ts = 100.0 - (d - COMFORT_PLATEAU_C) * COMFORT_COLD_SLOPE
    ts = max(0.0, min(100.0, ts))
    # precipitation adequacy: comfortable 600-1200 mm/yr, dry & very-wet penalised
    if annual_precip is None:
        ps = 50.0
    elif 600 <= annual_precip <= 1200:
        ps = 100 - abs(annual_precip - 900) / 25
    elif annual_precip < 600:
        ps = max(20, 88 - (600 - annual_precip) / 12)
    else:
        ps = max(20, 88 - (annual_precip - 1200) / 40)
    ps = max(0.0, min(100.0, ps))
    temp_component = ts * COMFORT_WEIGHT_TEMP
    precip_component = ps * COMFORT_WEIGHT_PRECIP
    base = temp_component + precip_component          # 0-100, no fabricated adaptation constant
    heat_pen = min(HEAT_NIGHTS_PEN_MAX, (heat_nights or 0) * HEAT_NIGHTS_PEN_PER)
    if wet_bulb_max is None or (isinstance(wet_bulb_max, float) and np.isnan(wet_bulb_max)):
        humid_pen = 0.0
    else:
        humid_pen = float(np.clip(
            (wet_bulb_max - WETBULB_PEN_LOW_C) / (WETBULB_PEN_HIGH_C - WETBULB_PEN_LOW_C) * WETBULB_PEN_MAX,
            0.0, WETBULB_PEN_MAX))
    drought_pen = min(DROUGHT_PEN_MAX, (drought_risk or 0) * 0.25)
    flood_pen = min(FLOOD_PEN_MAX, (flood_risk or 0) * 0.25)
    final = max(0.0, min(100.0, base - heat_pen - humid_pen - drought_pen - flood_pen))
    breakdown = {
        "temperature_comfort": round(temp_component, 1),
        "precipitation_adequacy": round(precip_component, 1),
        "comfort_optimum_c": round(comfort_optimum, 1),
        "heat_stress_penalty": round(heat_pen, 1),
        "humid_heat_penalty": round(humid_pen, 1),
        "drought_penalty": round(drought_pen, 1),
        "flood_penalty": round(flood_pen, 1),
        "base_score": round(base, 1),
        "final_score": round(final, 1),
    }
    return final, breakdown


def project(lat, lng, year, scenario=DEFAULT_SCENARIO, comfort_optimum=COMFORT_OPTIMUM_C):
    k = calibration_k(scenario, year)
    # monthly absolute = baseline monthly + annual delta.
    # Headline temperature is the raw CMIP6 model consensus. IPCC assessed
    # calibration is exposed separately instead of silently lowering/raising it.
    t_delta_raw = sample("temperature", scenario, "mean", lat, lng, year)
    t_std_raw = sample("temperature", scenario, "std", lat, lng, year)
    t_delta_ipcc = t_delta_raw * k
    t_std_ipcc = t_std_raw * k
    p_delta = sample("precipitation", scenario, "mean", lat, lng, year)        # percent
    p_std = sample("precipitation", scenario, "std", lat, lng, year)          # percent
    rh_delta = sample("humidity", scenario, "mean", lat, lng, year)            # percentage points
    rh_std = sample("humidity", scenario, "std", lat, lng, year)              # percentage points
    monthly_t, monthly_t_ipcc, monthly_p, monthly_rh, monthly_wet_bulb = [], [], [], [], []
    wet_bulb_formula_rh = []
    observed_t_values, observed_p_values = [], []
    observed_t_months = 0
    observed_p_months = 0
    for m in range(1, 13):
        model_bt = sample("baseline", "temperature", "clim", lat, lng, m)
        model_bp = sample("baseline", "precipitation", "clim", lat, lng, m)
        model_brh = sample("baseline", "humidity", "clim", lat, lng, m)
        obs_bt = sample_observed_baseline("temperature", lat, lng, m)
        obs_bp = sample_observed_baseline("precipitation", lat, lng, m)
        bt = obs_bt if not np.isnan(obs_bt) else model_bt
        bp = obs_bp if not np.isnan(obs_bp) else model_bp
        observed_t_months += 0 if np.isnan(obs_bt) else 1
        observed_p_months += 0 if np.isnan(obs_bp) else 1
        if not np.isnan(obs_bt):
            observed_t_values.append(float(obs_bt))
        if not np.isnan(obs_bp):
            observed_p_values.append(float(obs_bp))
        temp_m = bt + t_delta_raw if not np.isnan(bt) and not np.isnan(t_delta_raw) else float("nan")
        rh_m = model_brh + rh_delta if not np.isnan(model_brh) and not np.isnan(rh_delta) else float("nan")
        rh_m = float(np.clip(rh_m, 0.0, 100.0)) if not np.isnan(rh_m) else float("nan")
        wet_bulb_m, formula_rh_m = wet_bulb_stull_c(temp_m, rh_m)
        monthly_t.append(temp_m)
        monthly_t_ipcc.append(bt + t_delta_ipcc if not np.isnan(bt) and not np.isnan(t_delta_ipcc) else float("nan"))
        monthly_p.append(bp * (1 + p_delta / 100.0) if not np.isnan(bp) and not np.isnan(p_delta) else float("nan"))
        monthly_rh.append(rh_m)
        monthly_wet_bulb.append(wet_bulb_m)
        wet_bulb_formula_rh.append(formula_rh_m)
    mt = [x for x in monthly_t if not np.isnan(x)]
    mt_ipcc = [x for x in monthly_t_ipcc if not np.isnan(x)]
    mp = [x for x in monthly_p if not np.isnan(x)]
    mwb = [x for x in monthly_wet_bulb if not np.isnan(x)]
    annual_mean = float(np.mean(mt)) if mt else None
    annual_mean_ipcc = float(np.mean(mt_ipcc)) if mt_ipcc else None
    annual_total = float(np.sum(mp)) if mp else None
    wet_bulb_max_idx = int(np.nanargmax(monthly_wet_bulb)) if mwb else None
    rh_domain_clipped = sum(
        1 for rh, formula_rh in zip(monthly_rh, wet_bulb_formula_rh)
        if not np.isnan(rh) and not np.isnan(formula_rh) and abs(rh - formula_rh) > 0.001
    )
    temp_domain_warning_months = sum(
        1 for temp in monthly_t
        if not np.isnan(temp) and (temp < WET_BULB_TEMP_MIN or temp > WET_BULB_TEMP_MAX)
    )

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
    tr_std = sample("extreme-tr", scenario, "std", lat, lng, year)
    cdd_std = sample("extreme-cdd", scenario, "std", lat, lng, year)
    rx5_std = sample("extreme-rx5day", scenario, "std", lat, lng, year)
    heat_nights = None if np.isnan(tr_abs) else max(0, tr_abs)
    drought_risk = None if np.isnan(cdd_abs) else float(np.clip(100 * max(0, cdd_abs) / DROUGHT_MAX_CDD, 0, 100))
    flood_risk = None if np.isnan(rx5_abs) else float(np.clip(100 * max(0, rx5_abs) / FLOOD_MAX_RX5, 0, 100))

    coastal = is_coastal(lat, lng)
    slr = sample("sealevel", scenario, "median", lat, lng, year) if coastal else float("nan")  # metres; inland -> N/A
    slr_cm = None if np.isnan(slr) else slr * 100.0
    slr_low = sample("sealevel", scenario, "low", lat, lng, year) if coastal else float("nan")
    slr_high = sample("sealevel", scenario, "high", lat, lng, year) if coastal else float("nan")
    slr_low_cm = None if np.isnan(slr_low) else slr_low * 100.0
    slr_high_cm = None if np.isnan(slr_high) else slr_high * 100.0

    t_spread = None if np.isnan(t_std_raw) else abs(t_std_raw)
    t_spread_ipcc = None if np.isnan(t_std_ipcc) else abs(t_std_ipcc)
    p_spread_pct = None if np.isnan(p_std) else abs(p_std)
    precip_spread_mm = None if annual_total is None or p_spread_pct is None else annual_total * p_spread_pct / 100.0

    wet_bulb_max = monthly_wet_bulb[wet_bulb_max_idx] if wet_bulb_max_idx is not None else None
    score, breakdown = habitability(annual_mean, annual_total, heat_nights, drought_risk,
                                    flood_risk, wet_bulb_max, comfort_optimum)
    observed = load().get("observed")
    observed_source = observed.get("source", {}) if observed else {}
    baseline_temperature = "WorldClim v2.1 observed 1970-2000" if observed_t_months == 12 else "CMIP6 historical model baseline 1995-2014"
    baseline_precipitation = "WorldClim v2.1 observed 1970-2000" if observed_p_months == 12 else "CMIP6 historical model baseline 1995-2014"
    if observed_t_months and observed_t_months < 12:
        baseline_temperature = f"mixed WorldClim observed ({observed_t_months}/12 months) + CMIP6 model fallback"
    if observed_p_months and observed_p_months < 12:
        baseline_precipitation = f"mixed WorldClim observed ({observed_p_months}/12 months) + CMIP6 model fallback"

    return {
        "location": {"latitude": lat, "longitude": lng,
                     "name": f"Location {lat:.2f}, {lng:.2f}", "climate_zone": climate_zone(lat)},
        "year": year, "scenario": scenario,
        "temperature": {
            "annual_mean": _num(annual_mean),
            "monthly": [_num(x) for x in monthly_t], "monthly_labels": MONTHS,
            "anomaly": _num(t_delta_raw),
            "min": _num(min(mt)) if mt else None, "max": _num(max(mt)) if mt else None,
            "seasonal_amplitude": _num(max(mt) - min(mt)) if mt else None,
            "model_consensus": {
                "annual_mean": _num(annual_mean),
                "monthly": [_num(x) for x in monthly_t],
                "anomaly": _num(t_delta_raw),
                "source": "raw CMIP6 ScenarioMIP ensemble mean",
                "method": "observed or model monthly baseline plus raw CMIP6 ensemble anomaly",
            },
            "ipcc_calibrated": {
                "annual_mean": _num(annual_mean_ipcc),
                "monthly": [_num(x) for x in monthly_t_ipcc],
                "anomaly": _num(t_delta_ipcc),
                "adjustment_c": _num(t_delta_ipcc - t_delta_raw) if not np.isnan(t_delta_ipcc) and not np.isnan(t_delta_raw) else None,
                "calibration_factor": _num(k),
                "uncertainty": {
                    "annual_mean_low": _num(annual_mean_ipcc - t_spread_ipcc) if annual_mean_ipcc is not None and t_spread_ipcc is not None else None,
                    "annual_mean_high": _num(annual_mean_ipcc + t_spread_ipcc) if annual_mean_ipcc is not None and t_spread_ipcc is not None else None,
                    "anomaly_spread": _num(t_spread_ipcc),
                },
                "method": "same baseline plus CMIP6 ensemble anomaly scaled to IPCC AR6 assessed global warming ranges",
            },
            "uncertainty": {
                "annual_mean_low": _num(annual_mean - t_spread) if annual_mean is not None and t_spread is not None else None,
                "annual_mean_high": _num(annual_mean + t_spread) if annual_mean is not None and t_spread is not None else None,
                "anomaly_spread": _num(t_spread),
                "method": "raw CMIP6 ensemble standard deviation around the uncalibrated ensemble anomaly",
            },
        },
        "precipitation": {
            "annual_total": _num(annual_total),
            "monthly": [_num(x) for x in monthly_p], "monthly_labels": MONTHS,
            "anomaly_percent": _num(p_delta),
            "wettest_month": _num(max(mp)) if mp else None,
            "driest_month": _num(min(mp)) if mp else None,
            "wettest_month_name": MONTHS[int(np.nanargmax(monthly_p))] if mp else None,
            "driest_month_name": MONTHS[int(np.nanargmin(monthly_p))] if mp else None,
            "uncertainty": {
                "annual_total_low": _num(max(0, annual_total - precip_spread_mm)) if annual_total is not None and precip_spread_mm is not None else None,
                "annual_total_high": _num(annual_total + precip_spread_mm) if annual_total is not None and precip_spread_mm is not None else None,
                "anomaly_percent_spread": _num(p_spread_pct),
                "method": "CMIP6 ensemble standard deviation of precipitation percent change, converted to annual-total millimetres at this location",
            },
        },
        "extremes": {
            "heat_stress_days": None if heat_nights is None else int(round(heat_nights)),
            "drought_risk": _num(drought_risk), "flood_risk": _num(flood_risk),
            "sea_level_rise_cm": _num(slr_cm),
            "sea_level_applicable": coastal,
            "detail": {
                "tropical_nights_per_year": _num(heat_nights),
                "consecutive_dry_days": _num(None if np.isnan(cdd_abs) else cdd_abs),
                "max_5day_precip_mm": _num(None if np.isnan(rx5_abs) else rx5_abs),
                "humid_heat": {
                    "max_monthly_mean_wet_bulb_c": _num(monthly_wet_bulb[wet_bulb_max_idx]) if wet_bulb_max_idx is not None else None,
                    "max_month": MONTHS[wet_bulb_max_idx] if wet_bulb_max_idx is not None else None,
                    "monthly_mean_wet_bulb_c": [_num(x) for x in monthly_wet_bulb],
                    "monthly_relative_humidity_percent": [_num(x) for x in monthly_rh],
                    "relative_humidity_anomaly_percent_points": _num(rh_delta),
                    "relative_humidity_spread_percent_points": _num(None if np.isnan(rh_std) else abs(rh_std)),
                    "relative_humidity_baseline_source": "CMIP6 historical model baseline 1995-2014",
                    "domain_clipped_months": rh_domain_clipped,
                    "temperature_domain_warning_months": temp_domain_warning_months,
                    "source_id": "stull-2011-wetbulb-approximation",
                    "method": "Stull 2011 empirical wet-bulb approximation from monthly mean air temperature and CMIP6 near-surface relative humidity; RH is physically clipped to 0-100% and formula-clipped to 5-99% if needed.",
                    "caveat": "Monthly mean wet-bulb is a humid-heat screening context only. It is not WBGT, a daily exceedance count, personal medical advice, or occupational-safety guidance.",
                },
                "uncertainty": {
                    "tropical_nights_spread_days": _num(None if np.isnan(tr_std) else abs(tr_std)),
                    "consecutive_dry_days_spread": _num(None if np.isnan(cdd_std) else abs(cdd_std)),
                    "max_5day_precip_spread_mm": _num(None if np.isnan(rx5_std) else abs(rx5_std)),
                    "sea_level_low_cm": _num(slr_low_cm),
                    "sea_level_high_cm": _num(slr_high_cm),
                    "method": "CMIP6 ETCCDI ensemble standard deviation for extremes; IPCC AR6 low/high range for sea level",
                },
                "thresholds": {"tropical_night_C": TROPICAL_NIGHT_T,
                               "drought_max_cdd": DROUGHT_MAX_CDD, "flood_max_rx5_mm": FLOOD_MAX_RX5},
            },
        },
        "habitability": {"score": round(score, 1), "category": category(score), "breakdown": breakdown},
        "metadata": {
            "model": "fupit grounded engine (raw CMIP6 + IPCC AR6 context)", "model_version": "grounded-v3",
            "resolution": "1.0 degree", "confidence": "raw CMIP6 ensemble spread with IPCC AR6 assessed ranges reported separately",
            "data_source": "WorldClim v2.1 observed baseline where available + raw CMIP6 ScenarioMIP + IPCC AR6 temperature context + AR6 sea level + CMIP6 ETCCDI extremes",
            "baseline": "WorldClim v2.1 10 arc-minute observed climatology (1970-2000) where available; CMIP6 1995-2014 model baseline fallback",
            "baseline_source": {
                "temperature": baseline_temperature,
                "precipitation": baseline_precipitation,
                "humidity": "CMIP6 historical model monthly relative-humidity baseline 1995-2014",
                "observed_period": observed_source.get("period"),
                "observed_resolution": observed_source.get("resolution"),
                "observed_citation": observed_source.get("citation"),
                "observed_temperature_months": observed_t_months,
                "observed_precipitation_months": observed_p_months,
                "observed_annual_temperature_c": _num(np.mean(observed_t_values)) if observed_t_values else None,
                "observed_annual_precipitation_mm": _num(np.sum(observed_p_values)) if observed_p_values else None,
                "delta_reference_period": "CMIP6 deltas are relative to 1995-2014; baseline-period difference is disclosed, not hidden",
            },
            "projection_year_basis": projection_year_basis(scenario, year),
            "projection_method": "delta/change-factor; observed or model baseline + raw CMIP6 ensemble delta; IPCC assessed temperature calibration is contextual, not the hidden headline; serve-time risk thresholds",
            "scenario": scenario,
            "uncertainty": {
                "temperature_anomaly_spread_c": _num(t_spread),
                "temperature_ipcc_calibrated_anomaly_c": _num(t_delta_ipcc),
                "temperature_ipcc_adjustment_c": _num(t_delta_ipcc - t_delta_raw) if not np.isnan(t_delta_ipcc) and not np.isnan(t_delta_raw) else None,
                "temperature_ipcc_calibration_factor": _num(k),
                "precipitation_anomaly_spread_pct": _num(p_spread_pct),
                "relative_humidity_anomaly_spread_percent_points": _num(None if np.isnan(rh_std) else abs(rh_std)),
                "sea_level_low_cm": _num(slr_low_cm),
                "sea_level_high_cm": _num(slr_high_cm),
                "extreme_index_spread_source": "CMIP6 ETCCDI ensemble standard deviation",
            },
            "source_trail": SOURCE_TRAIL,
        },
    }


def trajectory(lat, lng, years, scenario=DEFAULT_SCENARIO):
    return {"coordinates": {"lat": lat, "lng": lng}, "scenario": scenario,
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


def _parse_scenario(value):
    if value not in SERVABLE_SCENARIOS:
        allowed = ", ".join(sorted(SERVABLE_SCENARIOS))
        raise ValueError(
            f"unsupported full-forecast scenario '{value}'. Supported scenarios: {allowed}. "
            "SSP1-1.9 lacks grounded ETCCDI heat/drought/flood layers, so it is withheld."
        )
    return value


def _load_ranking_catalog(catalog_arg=None):
    catalog_file = catalog_arg or "ranking_cities.json"
    catalog_path = catalog_file if os.path.isabs(catalog_file) else os.path.join(DATA, catalog_file)
    if not os.path.exists(catalog_path):
        raise ValueError(f"ranking catalog not found: {catalog_file}")
    catalog = json.load(open(catalog_path))
    rows = catalog.get("places") if isinstance(catalog, dict) else catalog
    if not isinstance(rows, list):
        raise ValueError("ranking catalog must be a list or an object with a places list")
    return rows


def main():
    try:
        a = sys.argv[1:]
        if a and a[0] == "--rankings":
            year = _parse_year(a[1]); scenario = _parse_scenario(a[2] if len(a) > 2 else DEFAULT_SCENARIO)
            from_cities = _load_ranking_catalog(a[3] if len(a) > 3 else None)
            out = []
            for ci in from_cities:
                p = project(ci["lat"], ci["lng"], year, scenario)
                out.append({
                    **ci,
                    "year": year,
                    "scenario": scenario,
                    "temperature": {
                        "annual_mean": p["temperature"]["annual_mean"],
                        "anomaly": p["temperature"]["anomaly"],
                        "uncertainty": p["temperature"].get("uncertainty"),
                    },
                    "precipitation": {
                        "annual_total": p["precipitation"]["annual_total"],
                        "anomaly_percent": p["precipitation"]["anomaly_percent"],
                        "uncertainty": p["precipitation"].get("uncertainty"),
                    },
                    "extremes": p["extremes"],
                    "habitability": p["habitability"],
                    "metadata": {
                        "model_version": p["metadata"]["model_version"],
                        "source_trail": p["metadata"]["source_trail"],
                    },
                })
            out.sort(key=lambda r: r["habitability"]["score"], reverse=True)
            print(json.dumps({"year": year, "scenario": scenario, "rankings": out}))
            return
        if a and a[0] == "--trajectory":
            lat = float(a[1]); lng = float(a[2])
            years = _parse_years(a[3])
            scenario = _parse_scenario(a[4] if len(a) > 4 else DEFAULT_SCENARIO)
            print(json.dumps(trajectory(lat, lng, years, scenario)))
            return
        lat = float(a[0]); lng = float(a[1]); year = _parse_year(a[2])
        scenario = _parse_scenario(a[3] if len(a) > 3 else DEFAULT_SCENARIO)
        comfort = float(a[4]) if len(a) > 4 else COMFORT_OPTIMUM_C
        print(json.dumps(project(lat, lng, year, scenario, comfort)))
    except (IndexError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
