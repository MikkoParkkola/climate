import { Card, CardContent } from "@/components/ui/card";

/**
 * /methodology — public honesty page. Documents every data source and the exact
 * risk threshold bands before they ship (Scientific Grounding requirement #3 + risk
 * constraint #3). Keep in sync with docs/architecture/SCIENTIFIC_GROUNDING.md and
 * grounded_model.py threshold constants.
 */
export default function Methodology() {
  return (
    <div className="min-h-screen w-full bg-[hsl(222,16%,8%)] py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <a href="/" className="text-sm text-[hsl(24,88%,66%)] hover:underline">← Back to the map</a>
          <h1 className="text-3xl font-bold text-white">How fupit gets its numbers</h1>
          <p className="text-slate-400">
            Every value on this site traces to real climate science. We do not invent
            coefficients or warming rates. Where we cannot ground a number, we leave it
            blank rather than guess. This page shows the full chain.
          </p>
        </header>

        <Card className="bg-[hsl(222,15%,12%)] text-white">
          <CardContent className="prose prose-sm prose-invert max-w-none pt-6">
            <h2>What the forecast is built from</h2>
            <ul>
              <li>
                <strong>Temperature and precipitation change</strong>: CMIP6, the
                model ensemble behind the IPCC Sixth Assessment Report. We take the
                multi-model average change for each scenario, decade by decade to 2100.
              </li>
              <li>
                <strong>Present-day baseline</strong>: WorldClim v2.1 observed monthly
                climatology at 10 arc-minutes for 1970 to 2000 where land data is
                available, with CMIP6 historical monthly climatology as the fallback.
                Future absolute values are this baseline plus the modeled change.
              </li>
              <li>
                <strong>Sea-level rise</strong>: IPCC AR6 regional projections, per
                scenario. The result page also loads a Natural Earth 1:110m coastline
                artifact to compute a coarse nearest-coast screen for wording only; it
                is not an elevation, tide, storm-surge, subsidence, defense, drainage,
                river, or parcel-exposure model.
              </li>
              <li>
                <strong>Heat, drought and flood risk</strong>: CMIP6 ETCCDI extreme-climate
                indices (the standard set used in the scientific literature), scored against
                published thresholds. See the table below.
              </li>
              <li>
                <strong>Humid heat screen</strong>: CMIP6 near-surface relative humidity
                baseline plus scenario delta, combined with monthly mean temperature through
                the Stull 2011 wet-bulb approximation. It reports a maximum monthly mean
                wet-bulb context only, not WBGT or daily humid-heat exceedance days.
              </li>
              <li>
                <strong>Cold-season context</strong>: selected-year monthly mean
                temperature from the grounded trajectory. We count months whose monthly
                mean is at or below 0°C. This is not a daily freeze-day count, daily
                cold-stress metric, freeze-thaw model, heating-demand model, road/crop
                damage model, pest model, or health-risk estimate.
              </li>
              <li>
                <strong>Freshwater availability (water stress)</strong>: WRI Aqueduct 4.0
                future water-stress category for the HydroBASINS sub-basin containing the
                location, at 2030, 2050 and 2080. We map our scenarios to Aqueduct's
                (SSP1-2.6 → optimistic, SSP3-7.0 → business-as-usual, SSP5-8.5 →
                pessimistic). It is a sub-basin prioritization screen, not a guarantee for
                a specific address, and SSP2-4.5 has no Aqueduct match so it shows nothing.
              </li>
              <li>
                <strong>Fire weather</strong>: Quilcaille et al. 2023 CMIP6 Canadian Fire
                Weather Index — multi-model ensemble-mean extreme-fire-weather days and
                fire-season length for the surrounding 2.5° (~250 km) cell, at 2030, 2050
                and 2080. All four SSP pathways are covered directly. It is a coarse screen
                for fire-conducive weather, not a measure of ignition, fuel, or actual fire
                risk, and open-ocean points show nothing.
              </li>
              <li>
                <strong>River-flood exposure</strong>: WRI Aqueduct Floods 1-in-100-year
                riverine inundation — the fraction of the surrounding ~10 km cell in the
                modeled floodplain and the mean modeled depth there, at 2030, 2050 and 2080.
                RCP4.5 is shown for SSP2-4.5 and RCP8.5 for SSP5-8.5; SSP1-2.6 and SSP3-7.0
                have no Aqueduct match and show nothing. It is a regional screen dependent on
                assumed flood protection, covers riverine flooding only (not coastal surge),
                and is not a property-level guarantee.
              </li>
              <li>
                <strong>Climate twin</strong>: the nearest present-day city in the indexed
                catalog, found by comparing standardized monthly temperature and precipitation
                vectors generated by the same grounded engine. It is a catalog analog, not a
                claim that every local impact is identical. The public API returns the catalog
                version, compared count, distance components, and caveats with the result.
              </li>
            </ul>

            <h2>The "hot model" correction</h2>
            <p>
              Some CMIP6 models run warmer than the observational record and paleoclimate
              evidence support. The IPCC did not simply average the raw models; it adjusted
              its assessed warming toward observations. We do not hide that adjustment in
              the headline number. For temperature, the default value shown in the app is
              the raw CMIP6 model consensus; the IPCC-calibrated value, calibration factor,
              and adjustment are shown beside it. Precipitation has no comparable single
              assessed anchor, so we show it as model average plus spread, labeled as such.
              We do not fabricate a calibration we cannot ground.
            </p>

            <h2>Scenario roles, not political probability</h2>
            <p>
              The source grid carries five SSP pathways for temperature, precipitation and sea
              level context. The app offers full habitability forecasts for the four scenarios
              that also have grounded heat, drought and flood layers. SSP2-4.5 is the default
              middle-path reference because 2025 UNEP current-policy and Climate Action
              Tracker policies/action estimates put end-century warming roughly between
              2.6 C and just below 3 C, making it the closest fully grounded SSP pathway in
              this package. The default policy version is current-policy-reference-2025. It
              is a reference, not a promise, prophecy, or hidden average of scenarios.
              SSP5-8.5 remains available as a very-high-emissions stress test, not as
              "business as usual." We cite the scenario and show the raw output so readers
              can judge the pathway instead of being forced into a single narrative.
            </p>

            <h2>Risk thresholds (exact bands)</h2>
            <p>
              Each 0 to 100 risk score is a transparent rescaling of a real, cited quantity.
              The raw value and its unit are always shown alongside the score. The bands:
            </p>
            <table>
              <thead>
                <tr><th>Hazard</th><th>Real quantity (cited)</th><th>0 to 100 mapping</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Heat</td>
                  <td>Tropical nights: nights per year with minimum above 20°C (ETCCDI TR; WHO heat-health)</td>
                  <td>Shown as the raw count per year</td>
                </tr>
                <tr>
                  <td>Drought</td>
                  <td>Longest dry spell: consecutive days under 1 mm of rain (ETCCDI CDD)</td>
                  <td>0 days → 0, 180 days (half a year) → 100, linear</td>
                </tr>
                <tr>
                  <td>Flood</td>
                  <td>Maximum 5-day rainfall total, mm (ETCCDI Rx5day; IPCC AR6 heavy-precip)</td>
                  <td>0 mm → 0, 300 mm → 100, linear</td>
                </tr>
              </tbody>
            </table>
            <p>
              Where a location has no usable model data, the score is left blank, never
              guessed. The very-low-emissions scenario (SSP1-1.9) has no matching ETCCDI
              heat/drought/flood source in this package, so full habitability forecasts with
              those risk penalties are withheld rather than interpolated.
            </p>

            <h2>Humid heat screen</h2>
            <p>
              The humid-heat field is not a new risk score. It uses CMIP6 historical monthly
              relative humidity as the baseline, applies the scenario relative-humidity
              delta, clips humidity to the physical 0 to 100 percent range, and applies the
              Stull 2011 empirical wet-bulb approximation to monthly mean temperature and
              humidity. fupit shows the hottest monthly mean wet-bulb value and the month
              it occurs in. Because this is monthly mean data, it cannot count hot-hour or
              hot-day exceedances; because it has no wind, sun angle, radiation, or exposure
              inputs, it is not WBGT or occupational-safety guidance.
            </p>

            <h2>Cold-season context</h2>
            <p>
              The cold-season field is also context, not a new risk score. It uses the same
              selected-year monthly mean temperature trajectory already shown in the forecast
              and counts months where the monthly mean is at or below 0°C. This can show
              whether a place still has a modeled monthly-mean freeze season, but it cannot
              count daily freeze days, cold snaps, snow/ice, freeze-thaw cycles, heating
              demand, road conditions, crop damage, pest survival, or local health risk.
              Those require finer daily, land-surface, infrastructure, exposure, and local
              adaptation datasets that are not in this build.
            </p>

            <h2>Habitability score</h2>
            <p>
              The single habitability number is hazard-led. It starts from a base built of
              two parts: temperature comfort (weight 0.6) and rainfall adequacy (weight 0.4),
              on a 0 to 100 scale, and then subtracts grounded, cited hazard penalties:
              humid heat (a wet-bulb screen, the strongest single penalty because humid heat
              is the limit human bodies cannot cool past), heat-stress nights, drought, and
              flood. There is no fixed "adaptation" constant in the score; a flat allowance
              that ignored real infrastructure was removed because it could not be grounded.
            </p>
            <p>
              Temperature comfort is the one stated <em>preference</em> in the score, not a
              physical fact: it peaks across a comfortable band around an optimum of 20°C and
              falls off on both sides, with heat penalised slightly harder than cold. This is
              a temperate-human comfort assumption, and it is adjustable. On a single
              location you can move the comfort optimum to match where you are acclimatised.
              Global rankings are computed at the documented 20°C default so they stay
              comparable between people. Everything else in the score is grounded hazard data;
              the full component breakdown is always shown.
            </p>

            <h2>Sea-level rise (coastal only)</h2>
            <p>
              Sea-level rise is only reported for coastal locations, places at the sea or
              within roughly 75 km of ocean, detected from a land/ocean mask. Inland and
              high-altitude locations are shown as "not applicable" rather than given a number,
              because regional sea-level rise has no meaning away from a coast. The figure is
              the regional relative rise at the nearest coast; it is not a flood-exposure or
              parcel-elevation claim. Known limitation: the mask treats very large lakes (for
              example the Great Lakes or the Caspian) like ocean, so a few lakeside cities can
              be mis-classified as coastal until a true ocean-polygon mask is added.
            </p>

            <h2>Large-scale circulation context</h2>
            <p>
              For broad regions where it is relevant, the app may show an AMOC/Gulf Stream
              context note. This uses IPCC AR6 Working Group I assessment language only:
              the Atlantic Meridional Overturning Circulation is very likely to weaken
              during the 21st century, while abrupt collapse before 2100 is not the central
              IPCC assessment. fupit does not apply a local cooling correction, warming
              correction, collapse date, or deterministic local impact from AMOC context.
            </p>

            <h2>Freshwater availability (water stress)</h2>
            <p>
              The freshwater field is the WRI Aqueduct 4.0 future water-stress category for
              the HydroBASINS sub-basin that contains the location. Water stress is annual
              water withdrawal divided by available renewable surface-plus-groundwater
              supply, classed into Aqueduct's standard bands from "Low (&lt;10%)" to
              "Extremely high (&gt;80%)", plus "Arid and low water use". We show the 2030,
              2050 and 2080 horizons and map scenarios as SSP1-2.6 → optimistic, SSP3-7.0 →
              business-as-usual, and SSP5-8.5 → pessimistic; SSP2-4.5 has no Aqueduct match
              and is left blank rather than approximated. Aqueduct is, in WRI's own words, a
              sub-basin prioritization tool, not a local guarantee: everyone in a basin
              shares one category regardless of local supply, storage, piping, or demand, and
              it covers water stress only, not drought, flood, water quality, sanitation
              access, or seasonal variability. WRI distributes the data without restriction
              and requests attribution, which we carry on the result page and below.
            </p>

            <h2>Fire weather</h2>
            <p>
              The fire-weather field is the Quilcaille et al. 2023 CMIP6 Canadian Fire
              Weather Index, an open dataset of annual FWI indicators published by ETH
              Zurich. We surface two indicators — the number of extreme-fire-weather days
              per year and the fire-season length — as a multi-model ensemble mean (averaged
              within each model, then across models) on the native 2.5° (~250 km) grid, at
              the 2030, 2050 and 2080 horizons (each a 20-year window mean). All four SSP
              pathways (SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5) are covered directly, so no
              scenario is approximated. The FWI is a measure of weather conducive to fire,
              not of ignition, fuel load, land management, or actual burned area; it is
              computed from daily mean (not afternoon-minimum) relative humidity, and the
              ensemble spread between models is not shown. Open-ocean cells are masked out
              because the index has no meaning without fuel, so a point over water shows
              nothing rather than a misleading value. The data is licensed CC-BY 4.0 and we
              carry the attribution on the result page and below.
            </p>

            <h2>River-flood exposure</h2>
            <p>
              The flood field is WRI Aqueduct Floods v2 riverine inundation hazard for the
              1-in-100-year return period. We take the 5-GCM ensemble mean of the ~1 km
              inundation-depth maps and reduce them to a 0.1° (~10 km) grid, storing two
              numbers per cell: the fraction of the cell in the modeled floodplain (depth
              over 5 cm) and the mean modeled depth over those flooded pixels. We show the
              2030, 2050 and 2080 horizons and map RCP4.5 to SSP2-4.5 and RCP8.5 to SSP5-8.5;
              SSP1-2.6 and SSP3-7.0 have no matching Aqueduct scenario and are left blank
              rather than approximated. This is a regional flood-hazard screen: it depends on
              the protection standard assumed in the underlying model, it covers riverine
              flooding only (coastal storm surge is a separate layer not yet included), and
              the flooded-area fraction is a cell-level statistic, not a statement that any
              specific address floods. A cell with no modeled floodplain is shown as 0%, a
              legitimate low-exposure answer rather than missing data. WRI distributes the
              data without restriction and requests attribution, which we carry on the result
              page and below.
            </p>

            <h2>Honesty notes</h2>
            <ul>
              <li>
                The observed baseline uses WorldClim's 1970 to 2000 climatology, while
                CMIP6 deltas are referenced to 1995 to 2014. We disclose that period
                mismatch in the projection receipt instead of hiding it. The raw CMIP6
                <em> change</em> signal is the headline; the IPCC-calibrated version is
                reported as an assessed comparison value.
              </li>
              <li>
                The extreme-index dataset is marked by its providers as no longer actively
                supported and provided as is. The index definitions are the published ETCCDI
                standard; we cite it as a frozen product.
              </li>
              <li>
                Every projection carries its scenario, its source, and an uncertainty range
                from the spread across models. It also carries the source-year basis: this
                package's scenario layers start at 2030, so near-current 2025/2026 points
                disclose that they use the earliest packed scenario layer rather than a true
                historical hindcast. We never collapse that range or cadence into false
                precision.
              </li>
            </ul>

            <p className="text-slate-400">
              Sources: WorldClim v2.1 (Fick & Hijmans 2017); IPCC AR6 Working Group I;
              CMIP6 (Eyring et al. 2016); ETCCDI indices (Sillmann et al. 2013); Stull
              2011 wet-bulb approximation; IPCC AR6 sea-level projections; Natural Earth
              1:110m coastline; WRI Aqueduct 4.0 water-risk data (Kuzma et al. 2023,
              doi:10.46830/writn.23.00061); Quilcaille et al. 2023 CMIP6 Fire Weather Index
              (doi:10.3929/ethz-b-000583391, CC-BY 4.0); WRI Aqueduct Floods riverine hazard
              maps (Ward et al. 2020); Climate Action Tracker thermometer; Hausfather &amp; Peters
              2020 on high-emissions scenario framing.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
