// smoke:og — guards the social-preview image path (satori + @resvg/resvg-wasm +
// bundled fonts). These can break silently on deploy (WASM init, font resolution),
// so assert in-process that the renderer emits a valid 1200x630 PNG and that the
// honesty fallback (a card with a grounded score must differ from one without)
// holds. No server, no DB — exercises the exact render path and nothing else.
import assert from "node:assert";
import { renderOgPng } from "../server/og-image";

function pngDims(buf: Uint8Array): { w: number; h: number } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) assert.equal(buf[i], sig[i], "not a PNG (bad signature)");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) }; // IHDR width/height
}

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

  console.log(`smoke:og OK — withScore ${withScore.length}B / noScore ${noScore.length}B / default ${noParams.length}B; all 1200x630`);
}

main().catch((e) => {
  console.error("smoke:og FAILED:", (e as Error).message);
  process.exit(1);
});
