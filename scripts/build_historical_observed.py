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

Incremental / quota-aware (MIK-6777 follow-up): a full 45-year x 45-city pull
is ~1170 weighted calls/city (Open-Meteo's own cost = weeks/2, floored
multiplier under 10 vars) -- fine solo, but the free tier caps at 10,000
weighted calls/day, so this now fetches ONE YEAR AT A TIME across all
cities, in recency-biased bisection order (newest and oldest first, then
each remaining gap split toward its recent side), and stops before
exceeding a per-run weighted-call budget. Re-running it daily (e.g. via
cron) fills in more years each time -- the existing artifact is loaded and
merged, never overwritten, so the dataset is always usable (denser near
today, coarser into the past) instead of all-or-nothing.

Set BUDGET=<weighted calls> to change the per-run cap (default 9000, safely
under the 10,000/day free ceiling). One year for all 45 cities costs
~1170 weighted calls, so the default budget covers ~7 new years/run.

A city that fails to fetch (after retries) for a given year is skipped for
that year and retried on the next run -- not a hard failure, since this is
now an incremental multi-run process by design.

Run from repo root:  python3 scripts/build_historical_observed.py
Writes: data/historical-observed.openmeteo.json
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START_YEAR, END_YEAR = 1980, 2024


def fetch_daily(lat, lng, start, end, retries=5):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}"
        f"&start_date={start}-01-01&end_date={end}-12-31"
        f"&daily=temperature_2m_mean,precipitation_sum&timezone=UTC"
    )
    # Open-Meteo's free archive endpoint enforces a per-minute request cap; a
    # burst of ~45 sequential city calls can trip it (observed live 2026-07-05:
    # all 45 cities 429'd in one run). Backoff starts wide (15s) specifically
    # to clear a per-minute window rather than a per-request hiccup.
    delay = 15.0
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as exc:
            if attempt == retries - 1:
                raise
            wait = delay * (2 ** attempt)
            print(f"  ({exc}, retrying in {wait:.0f}s)", file=sys.stderr)
            time.sleep(wait)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(delay)
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


def priority_years(start=START_YEAR, end=END_YEAR):
    """Recency-biased bisection order: newest + oldest first, then each
    remaining gap split toward its recent side. Re-running this generator
    against a partially-filled artifact naturally keeps adding the next
    most-valuable year (near-today density first, deep-past fills in over
    more runs) instead of an arbitrary or strictly-linear order."""
    order = [end, start]
    gaps = [(start, end)]
    while gaps:
        gaps.sort(key=lambda g: g[1] - g[0], reverse=True)
        lo, hi = gaps.pop(0)
        if hi - lo <= 1:
            continue
        mid = lo + round((hi - lo) * 0.7)  # 0.7 -> biased toward hi (recent)
        if mid in (lo, hi):
            continue
        order.append(mid)
        gaps += [(lo, mid), (mid, hi)]
    return order


def weighted_cost(n_cities, n_years=1):
    # Open-Meteo weighted-call formula: (weeks / 2) * max(1, vars // 10),
    # floored to 1x multiplier here since we only request 2 variables.
    weeks = (n_years * 365) / 7
    return (weeks / 2) * n_cities


def save_artifact(out, artifact, by_name, skipped):
    for entry in by_name.values():
        idx = sorted(range(len(entry["years"])), key=lambda i: entry["years"][i])
        entry["years"] = [entry["years"][i] for i in idx]
        entry["tempC"] = [entry["tempC"][i] for i in idx]
        entry["precipMm"] = [entry["precipMm"][i] for i in idx]
    artifact["version"] = "historical-observed-v1"
    artifact["source"] = "Open-Meteo ERA5 archive (daily temperature_2m_mean + precipitation_sum, annualized)"
    artifact["period"] = f"{START_YEAR}-{END_YEAR}"
    artifact["coverage"] = "curated city catalog (data/ranking_cities.json) only — not arbitrary worldwide lat/lng"
    artifact["cities"] = list(by_name.values())
    artifact["skipped_cities"] = sorted(skipped)
    tmp = out + ".tmp"
    with open(tmp, "w") as f:
        json.dump(artifact, f, indent=2)
        f.write("\n")
    os.replace(tmp, out)  # atomic: never leaves a half-written artifact on disk


def main():
    with open(os.path.join(REPO, "data", "ranking_cities.json")) as f:
        cities = json.load(f)

    budget = float(os.environ.get("BUDGET", "9000"))
    out = os.path.join(REPO, "data", "historical-observed.openmeteo.json")
    if os.path.exists(out):
        with open(out) as f:
            artifact = json.load(f)
    else:
        artifact = {"cities": []}
    by_name = {e["name"]: e for e in artifact.get("cities", [])}
    skipped = set(artifact.get("skipped_cities", []))

    spent = 0.0
    fetched_years = set()
    for year in priority_years():
        if all(year in by_name.get(c["name"], {}).get("years", []) for c in cities):
            continue  # every city already has this year -- free, don't spend budget
        cost = weighted_cost(len(cities))
        if spent + cost > budget:
            break
        print(f"=== year {year}  (budget {spent:.0f}/{budget:.0f}) ===")
        for c in cities:
            name, lat, lng = c["name"], c["lat"], c["lng"]
            entry = by_name.setdefault(name, {
                "name": name, "country": c.get("country"), "lat": lat, "lng": lng,
                "years": [], "tempC": [], "precipMm": [],
            })
            if year in entry["years"]:
                continue
            try:
                daily = fetch_daily(lat, lng, year, year)
            except Exception as exc:  # noqa: BLE001
                print(f"  SKIP {name} {year}: {exc}", file=sys.stderr)
                skipped.add(name)
                continue
            years, temps, precip = annualize(daily)
            for y, t, p in zip(years, temps, precip):
                if y not in entry["years"]:
                    entry["years"].append(y)
                    entry["tempC"].append(t)
                    entry["precipMm"].append(p)
            time.sleep(2.0)
        spent += cost
        fetched_years.add(year)
        save_artifact(out, artifact, by_name, skipped)  # checkpoint after every year

    save_artifact(out, artifact, by_name, skipped)  # final save (no-op if loop already covered it)

    coverage = {c["name"]: len(by_name.get(c["name"], {}).get("years", [])) for c in cities}
    complete = sum(1 for n in coverage.values() if n >= (END_YEAR - START_YEAR + 1))
    print(
        f"\nwrote {os.path.relpath(out, REPO)}: {len(fetched_years)} new year(s) fetched this run, "
        f"{complete}/{len(cities)} cities fully covered ({START_YEAR}-{END_YEAR}), "
        f"{len(skipped)} skipped-city name(s) ever seen. Re-run (e.g. daily cron) to keep filling."
    )


if __name__ == "__main__":
    main()
