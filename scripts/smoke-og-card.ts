// smoke:og — guards the social-preview image path (satori + @resvg/resvg-wasm +
// bundled fonts). These can break silently on deploy (WASM init, font resolution),
// so assert in-process that the renderer emits a valid 1200x630 PNG and that the
// honesty fallback (a card with a grounded score must differ from one without)
// holds. No server, no DB — exercises the exact render path and nothing else.
import assert from "node:assert";
import { inflateSync } from "node:zlib";
import { renderOgPng } from "../server/og-image";

function pngDims(buf: Uint8Array): { w: number; h: number } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) assert.equal(buf[i], sig[i], "not a PNG (bad signature)");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) }; // IHDR width/height
}

// Decode an 8-bit RGBA, non-interlaced PNG (what resvg emits) into raw pixels.
function decodeRgba(buf: Uint8Array): { w: number; h: number; px: Uint8Array } {
  const { w, h } = pngDims(buf);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(buf[24], 8, "expected 8-bit depth");
  assert.equal(buf[25], 6, "expected RGBA colour type");
  const idat: Uint8Array[] = [];
  for (let off = 8; off < buf.length; ) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(...buf.subarray(off + 4, off + 8));
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const pred = [0, a, b, (a + b) >> 1, pr][filter];
      px[y * stride + x] = (line[x] + pred) & 0xff;
    }
  }
  return { w, h, px };
}

// Count light pixels in a box; the card background is near-black graphite.
function inkIn(img: { w: number; px: Uint8Array }, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.w + x) * 4;
      if (Math.max(img.px[i], img.px[i + 1], img.px[i + 2]) > 100) n++;
    }
  return n;
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

  // Layout: the bottom-right "fupit.com" footer must land inside the card. A box-sizing
  // change in satori once pushed the whole footer row below the 630px canvas.
  for (const [name, png] of [["withScore", withScore], ["default", noParams]] as const) {
    const ink = inkIn(decodeRgba(png), 1000, 515, 1140, 560);
    assert.ok(ink > 50, `${name}: footer domain missing from the bottom-right of the card (${ink} light pixels)`);
  }

  console.log(`smoke:og OK — withScore ${withScore.length}B / noScore ${noScore.length}B / default ${noParams.length}B; all 1200x630`);
}

main().catch((e) => {
  console.error("smoke:og FAILED:", (e as Error).message);
  process.exit(1);
});
