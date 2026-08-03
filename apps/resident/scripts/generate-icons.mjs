#!/usr/bin/env node
/**
 * Generate the PWA icon set from the Living mark — no image dependency.
 *
 * Android/Chrome only treats an app as installable when the manifest offers a
 * raster icon of at least 192px (and 512px for the splash screen), so shipping
 * the SVG alone is what kept the resident app from being installable. Rather
 * than add sharp/canvas to the toolchain for four flat shapes, this rasterizes
 * the mark directly and encodes PNG with node:zlib.
 *
 *   pnpm --filter @living/resident icons
 *
 * The mark: a rounded square in Living green with a serif "L" and the accent
 * dot — the same design as public/icon.svg, drawn geometrically.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BRAND = [0x23, 0x4b, 0x39]; // #234b39
const CREAM = [0xfa, 0xf8, 0xf4]; // #faf8f4
const ACCENT = [0xc9, 0x78, 0x4a]; // #c9784a

/** Icons Chrome/Android/iOS actually look for. */
const TARGETS = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  // Maskable icons are cropped to a circle on Android, so the mark must sit
  // inside the 80% safe zone and the background must bleed to the edges.
  { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const target of TARGETS) {
    const png = encodePng(drawIcon(target.size, target.maskable), target.size, target.size);
    writeFileSync(join(OUT_DIR, target.file), png);
    console.log(`wrote public/${target.file} (${target.size}x${target.size})`);
  }
}

/** RGBA pixel buffer for one icon. */
function drawIcon(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  // Maskable icons bleed to the edge (the launcher applies its own mask);
  // regular icons keep the rounded-square silhouette with transparency around it.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  fillRoundedRect(px, size, 0, 0, size, size, radius, BRAND);

  // Mark geometry, as a fraction of the canvas. Maskable shrinks it into the
  // safe zone so a circular crop never clips the letter.
  const scale = maskable ? 0.62 : 0.78;
  const markSize = size * scale;
  const originX = (size - markSize) / 2;
  const originY = (size - markSize) / 2;

  const stemW = markSize * 0.17;
  const footH = markSize * 0.17;
  const letterH = markSize * 0.74;
  const letterW = markSize * 0.5;
  // The dot extends ~0.25 of the mark past the letter, so nudge the letter
  // right to optically centre the whole "L." composition.
  const letterX = originX + markSize * 0.14;
  const letterY = originY + (markSize - letterH) / 2;

  // Vertical stem.
  fillRect(px, size, letterX, letterY, stemW, letterH, CREAM);
  // Foot.
  fillRect(px, size, letterX, letterY + letterH - footH, letterW, footH, CREAM);
  // Serifs — the top of the stem and the right edge of the foot.
  fillRect(px, size, letterX - stemW * 0.35, letterY, stemW * 1.7, markSize * 0.045, CREAM);
  fillRect(
    px,
    size,
    letterX + letterW - markSize * 0.045,
    letterY + letterH - footH - markSize * 0.05,
    markSize * 0.045,
    footH + markSize * 0.05,
    CREAM,
  );
  // The accent dot.
  fillCircle(
    px,
    size,
    letterX + letterW + markSize * 0.16,
    letterY + letterH - footH / 2,
    footH * 0.52,
    ACCENT,
  );
  return px;
}

// ── Drawing primitives (nearest-pixel, with analytic AA on the circle) ───────

function setPixel(px, size, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  const a = alpha / 255;
  // Source-over onto whatever is already there.
  px[i] = Math.round(px[i] * (1 - a) + r * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
  px[i + 3] = Math.max(px[i + 3], alpha);
}

function fillRect(px, size, x, y, w, h, color) {
  for (let py = Math.round(y); py < Math.round(y + h); py += 1) {
    for (let cx = Math.round(x); cx < Math.round(x + w); cx += 1) {
      setPixel(px, size, cx, py, color);
    }
  }
}

function fillRoundedRect(px, size, x, y, w, h, radius, color) {
  for (let py = 0; py < h; py += 1) {
    for (let cx = 0; cx < w; cx += 1) {
      if (radius > 0 && !insideRounded(cx, py, w, h, radius)) continue;
      setPixel(px, size, Math.round(x + cx), Math.round(y + py), color);
    }
  }
}

function insideRounded(x, y, w, h, r) {
  const cx = x < r ? r : x > w - r - 1 ? w - r - 1 : x;
  const cy = y < r ? r : y > h - r - 1 ? h - r - 1 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function fillCircle(px, size, cx, cy, r, color) {
  const from = Math.floor(cy - r) - 1;
  const to = Math.ceil(cy + r) + 1;
  for (let y = from; y <= to; y += 1) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r - 0.5) setPixel(px, size, x, y, color);
      // One-pixel feathered edge so the dot doesn't look jagged at 192px.
      else if (d < r + 0.5) setPixel(px, size, x, y, color, Math.round((r + 0.5 - d) * 255));
    }
  }
}

// ── Minimal PNG encoder (RGBA8, no interlace) ───────────────────────────────

function encodePng(rgba, width, height) {
  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Declared last so every helper above is initialised before the first draw.
main();
