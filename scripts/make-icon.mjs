#!/usr/bin/env node
/**
 * Generate mcp-server/icon.png — the Loft Motion extension icon.
 *
 * A 256×256 rounded-square mark (brand-blue vertical gradient) with a white "L",
 * supersampled for clean edges. Dependency-free: a minimal PNG encoder built on
 * Node's zlib.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SIZE = 256;
const SS = 3; // supersample factor
const HS = SIZE * SS;

// geometry (in 256-space)
const PAD = 14, R = 58;
const x0 = PAD, y0 = PAD, x1 = SIZE - PAD, y1 = SIZE - PAD;
// the "L"
const stem = { x0: 96, x1: 122, y0: 70, y1: 186 };
const foot = { x0: 96, x1: 178, y0: 160, y1: 186 };

const lerp = (a, b, t) => a + (b - a) * t;
const TOP = [96, 161, 222], BOT = [60, 112, 166], WHITE = [248, 250, 252];

function insideRoundRect(x, y) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + R ? x0 + R : x > x1 - R ? x1 - R : x;
  const cy = y < y0 + R ? y0 + R : y > y1 - R ? y1 - R : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}
const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

function sample(x, y) {
  if (!insideRoundRect(x, y)) return [0, 0, 0, 0];
  if (inRect(stem, x, y) || inRect(foot, x, y)) return [...WHITE, 255];
  const t = (y - y0) / (y1 - y0);
  return [lerp(TOP[0], BOT[0], t), lerp(TOP[1], BOT[1], t), lerp(TOP[2], BOT[2], t), 255];
}

// render with supersampling -> RGBA buffer
const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [sr, sg, sb, sa] = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        const af = sa / 255;
        r += sr * af; g += sg * af; b += sb * af; a += sa;
      }
    }
    const n = SS * SS;
    const aa = a / n;
    const cov = aa === 0 ? 1 : a / 255; // premultiplied-correct un-premultiply
    const o = (py * SIZE + px) * 4;
    rgba[o] = Math.round(r / (cov || 1));
    rgba[o + 1] = Math.round(g / (cov || 1));
    rgba[o + 2] = Math.round(b / (cov || 1));
    rgba[o + 3] = Math.round(aa);
  }
}
void HS;

/* ---- minimal PNG encoder (RGBA, 8-bit) ---- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
// 10,11,12 = compression, filter, interlace = 0

// filtered scanlines (filter byte 0 per row)
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp-server", "icon.png");
writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
