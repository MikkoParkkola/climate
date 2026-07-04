#!/usr/bin/env python3
"""
build_historical_observed.py — precomputed 1980-2024 observed annual history
for the app's curated city catalog (MIK-6777).

Fetches per-city annual-mean temperature + total precipitation from Open-Meteo's
free ERA5 archive API (no key, daily data back to 1940) for every city in
data/ranking_cities.json, and writes a single cached artifact consumed at
request time (never a per-request external call — same ingest-once/serve-many
pattern as data/grid.i16.gz and the other precomputed layers in data/).

Scope note (honest, not silently dropped): the app's live location search
resolves to ARBITRARY lat/lng worldwide (server/grounded-node-model.ts /
grounded_model.py take any coordinate off a ~25km grid). A true global
1980-2024 observed grid at that resolution is not feasible via a free
per-point archive API (would require on the order of 10^5-10^6 calls). This
ingest step covers the curated city catalog (data/ranking_cities.json, the
same 45 cities backing rankings/comparisons) as a scoped, honest slice.
Arbitrary-location coverage is a follow-up, not silently implied here.

Run from repo root:  python3 scripts/build_historical_observed.py
Writes: data/historical-observed.openmeteo.json
"""
import json
import os
import sys
import time
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START_YEAR, END_YEAR = 1980, 2024


def fetch_daily(lat, lng, start, end, retries=4):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}"
        f"&start_date={start}-01-01&end_date={end}-12-31"
        f"&daily=temperature_2m_mean,precipitation_sum&timezone=UTC"
    )
    delay = 2.0
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError("unreachable")


def annualize(daily):
    times = daily["daily"]["time"]
    temps = daily["daily"]["temperature_2m_mean"]
    precip = daily["daily"]["precipitation_sum"]
    by_year = {}
    for t, temp, p in zip(times, temps, precip):
        year = int(t[:4])
        by_year.setdefault(year, {"temps": [], "precip": []})
        if temp is not None:
            by_year[year]["temps"].append(temp)
        if p is not None:
            by_year[year]["precip"].append(p)
    years = sorted(by_year)
    return (
        years,
        [round(sum(by_year[y]["temps"]) / len(by_year[y]["temps"]), 2) if by_year[y]["temps"] else None for y in years],
        [round(sum(by_year[y]["precip"]), 1) if by_year[y]["precip"] else None for y in years],
    )


def main():
    with open(os.path.join(REPO, "data", "ranking_cities.json")) as f:
        cities = json.load(f)

    entries = []
    for c in cities:
        name, lat, lng = c["name"], c["lat"], c["lng"]
        try:
            daily = fetch_daily(lat, lng, START_YEAR, END_YEAR)
        except Exception as exc:  # noqa: BLE001
            print(f"SKIP {name}: {exc}", file=sys.stderr)
            continue
        years, temps, precip = annualize(daily)
        entries.append({
            "name": name,
            "country": c.get("country"),
            "lat": lat,
            "lng": lng,
            "years": years,
            "tempC": temps,
            "precipMm": precip,
        })
        print(f"{name:20} {len(years)} years  latest temp={temps[-1] if temps else None}")
        time.sleep(0.5)

    artifact = {
        "version": "historical-observed-v1",
        "source": "Open-Meteo ERA5 archive (daily temperature_2m_mean + precipitation_sum, annualized)",
        "period": f"{START_YEAR}-{END_YEAR}",
        "coverage": "curated city catalog (data/ranking_cities.json) only — not arbitrary worldwide lat/lng",
        "cities": entries,
    }
    out = os.path.join(REPO, "data", "historical-observed.openmeteo.json")
    with open(out, "w") as f:
        json.dump(artifact, f, indent=2)
        f.write("\n")
    print(f"\nwrote {os.path.relpath(out, REPO)} ({len(entries)}/{len(cities)} cities)")


if __name__ == "__main__":
    main()
