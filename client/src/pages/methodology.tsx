import { Card, CardContent } from "@/components/ui/card";

/**
 * /methodology — public honesty page. Documents every data source and the exact
 * risk threshold bands before they ship (Scientific Grounding requirement #3 + risk
 * constraint #3). Keep in sync with docs/architecture/SCIENTIFIC_GROUNDING.md and
 * grounded_model.py threshold constants.
 */
export default function Methodology() {
  return (
    <div className="min-h-screen w-full bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <a href="/" className="text-sm text-blue-600 hover:underline">← Back to the map</a>
          <h1 className="text-3xl font-bold text-gray-900">How fupit gets its numbers</h1>
          <p className="text-gray-600">
            Every value on this site traces to real climate science. We do not invent
            coefficients or warming rates. Where we cannot ground a number, we leave it
            blank rather than guess. This page shows the full chain.
          </p>
        </header>

        <Card>
          <CardContent className="prose prose-sm max-w-none pt-6">
            <h2>What the forecast is built from</h2>
            <ul>
              <li>
                <strong>Temperature, precipitation, humidity change</strong> — CMIP6, the
                model ensemble behind the IPCC Sixth Assessment Report. We take the
                multi-model average change for each scenario, decade by decade to 2100.
              </li>
              <li>
                <strong>Present-day baseline</strong> — the CMIP6 historical average for
                1995 to 2014, by calendar month. Future absolute values are this baseline
                plus the modeled change. (This baseline is from models, not direct
                observations; see the honesty note below.)
              </li>
              <li>
                <strong>Sea-level rise</strong> — IPCC AR6 regional projections, per
                scenario.
              </li>
              <li>
                <strong>Heat, drought and flood risk</strong> — CMIP6 ETCCDI extreme-climate
                indices (the standard set used in the scientific literature), scored against
                published thresholds. See the table below.
              </li>
            </ul>

            <h2>The "hot model" correction</h2>
            <p>
              Some CMIP6 models run warmer than the observational record and paleoclimate
              evidence support. The IPCC did not simply average the raw models; it adjusted
              its assessed warming toward observations. We do the same: for temperature we
              show both the raw model average and the IPCC-calibrated value, and default to
              the calibrated one. Precipitation and humidity have no comparable single
              assessed anchor, so we show them as model average plus spread, labeled as such.
              We do not fabricate a calibration we cannot ground.
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
              guessed. Sea-level rise for the very-low-emissions scenario (SSP1-1.9) is not
              in this extreme-index dataset, so its risk is withheld rather than interpolated.
            </p>

            <h2>Habitability score</h2>
            <p>
              The single habitability number is a weighted blend of temperature comfort
              (weight 0.45), rainfall adequacy (0.35), a fixed adaptation allowance, minus
              penalties for heat, drought and flood. It is a transparent summary, not a model
              output, and the full breakdown is shown so you can see every component.
            </p>

            <h2>Honesty notes</h2>
            <ul>
              <li>
                The present-day baseline comes from climate models, which carry local biases
                of a few degrees. The <em>change</em> signal — the product's actual claim — is
                kept observation-constrained through the IPCC calibration. Replacing the
                baseline with a direct-observation product is a planned upgrade.
              </li>
              <li>
                The extreme-index dataset is marked by its providers as no longer actively
                supported and provided as is. The index definitions are the published ETCCDI
                standard; we cite it as a frozen product.
              </li>
              <li>
                Every projection carries its scenario, its source, and an uncertainty range
                from the spread across models. We never collapse that range into false precision.
              </li>
            </ul>

            <p className="text-gray-500">
              Sources: IPCC AR6 Working Group I; CMIP6 (Eyring et al. 2016); ETCCDI indices
              (Sillmann et al. 2013); IPCC AR6 sea-level projections.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
