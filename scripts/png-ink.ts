// PNG helpers for the share-card smoke test: dimensions, an RGBA decoder for
// resvg output, and a light-pixel counter used to prove content lands on the card.
import assert from "node:assert";
import { inflateSync } from "node:zlib";

export function pngDims(buf: Uint8Array): { w: number; h: number } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) assert.equal(buf[i], sig[i], "not a PNG (bad signature)");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) }; // IHDR width/height
}

// Decode an 8-bit RGBA, non-interlaced PNG (what resvg emits) into raw pixels.
export function decodeRgba(buf: Uint8Array): { w: number; h: number; px: Uint8Array } {
  const { w, h } = pngDims(buf);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(buf[24], 8, "expected 8-bit depth");
  assert.equal(buf[25], 6, "expected RGBA colour type");
  assert.equal(buf[28], 0, "expected a non-interlaced PNG");
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
    assert.ok(filter <= 4, `unsupported PNG filter type ${filter} on row ${y}`);
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
export function inkIn(img: { w: number; px: Uint8Array }, x0: number, y0: number, x1: number, y1: number): number {
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.w + x) * 4;
      if (Math.max(img.px[i], img.px[i + 1], img.px[i + 2]) > 100) n++;
    }
  return n;
}
