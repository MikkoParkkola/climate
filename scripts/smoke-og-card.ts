// smoke:og — guards the social-preview image path (satori + @resvg/resvg-wasm +
// bundled fonts). These can break silently on deploy (WASM init, font resolution),
// so assert in-process that the renderer emits a valid 1200x630 PNG and that the
// honesty fallback (a card with a grounded score must differ from one without)
// holds. No server, no DB — exercises the exact render path and nothing else.
import assert from "node:assert";
import { renderOgPng } from "../server/og-image";
import { decodeRgba, inkIn, pngDims } from "./png-ink";


async function main(): Promise<void> {
  const withScore = await renderOgPng({ place: "Lisbon", lat: 38.72, lng: -9.14, year: 2075, score: 48, scenario: "ssp245" });
  const d1 = pngDims(withScore);
  assert.equal(d1.w, 1200, "width must be 1200");
  assert.equal(d1.h, 630, "height must be 630");

  const noParams = await renderOgPng({});
  pngDims(noParams); // valid PNG, default branded card

  const noScore = await renderOgPng({ place: "Lisbon", lat: 38.72, lng: -9.14, year: 2075, scenario: "ssp245" });
  pngDims(noScore);

  // Honesty: presence of a grounded score must visibly change the card.
  assert.notEqual(
    Buffer.from(withScore).toString("base64"),
    Buffer.from(noScore).toString("base64"),
    "card with a score must differ from the same card without one",
  );

  // Layout: the bottom-right "fupit.com" footer must land inside the card. A box-sizing
  // change in satori once pushed the whole footer row below the 630px canvas. A healthy
  // footer measures 673 light pixels here and the broken layout 0; 400 also fails a
  // half-clipped footer. (The chip row is not ink-checked: the broken layout slides the
  // score digits into that region, so ink there rises instead of falling.)
  const longHeadline = await renderOgPng({ place: "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch", year: 2050, scenario: "ssp585", score: 12 });
  const cards = { withScore, noScore, default: noParams, longHeadline };
  for (const [name, png] of Object.entries(cards)) {
    const ink = inkIn(decodeRgba(png), 1000, 515, 1140, 560);
    assert.ok(ink >= 400, `${name}: footer domain missing or clipped in the bottom-right of the card (${ink} light pixels)`);
  }

  console.log(`smoke:og OK — withScore ${withScore.length}B / noScore ${noScore.length}B / default ${noParams.length}B; all 1200x630`);
}

main().catch((e) => {
  console.error("smoke:og FAILED:", (e as Error).message);
  process.exit(1);
});
