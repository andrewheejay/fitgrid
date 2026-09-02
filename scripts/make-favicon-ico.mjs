#!/usr/bin/env node
/**
 * Build public/favicon.ico from public/favicon.svg.
 *
 *   node scripts/make-favicon-ico.mjs
 *
 * The .ico is not legacy decoration. Vercel serves a static file if one exists
 * and otherwise hands the request to the SPA rewrite, so with no file here
 * /favicon.ico answered 200 with the app's HTML — and a client that asked for
 * an icon and was told "yes, here is 2.8kB of text/html" caches that as a
 * broken icon for the whole origin rather than falling back to the <link> tags.
 * Chrome asks for /favicon.ico whenever it has nothing cached for a host, which
 * is every first visit.
 *
 * ICO is assembled by hand because sharp cannot write the container. Since
 * Vista an .ico may hold PNGs directly rather than the old DIB-with-AND-mask
 * layout, so each entry is simply a complete PNG, which is what sharp does emit.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

/** 16 and 32 are the sizes actually asked for; 48 is what Windows uses. */
const SIZES = [16, 32, 48];

const ICONDIR = 6;
const ICONDIRENTRY = 16;

const images = await Promise.all(
  SIZES.map((size) =>
    // Rendered large and resized down, so the 1.5px rules of the mark land on
    // clean edges instead of being rasterised straight onto a 16px grid.
    sharp('public/favicon.svg', { density: 600 }).resize(size, size).png().toBuffer(),
  ),
);

const header = Buffer.alloc(ICONDIR);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(SIZES.length, 4);

let offset = ICONDIR + ICONDIRENTRY * SIZES.length;
const entries = SIZES.map((size, index) => {
  const entry = Buffer.alloc(ICONDIRENTRY);
  // 0 means 256 in this field; nothing here is that big, but the rule stands.
  entry.writeUInt8(size % 256, 0);
  entry.writeUInt8(size % 256, 1);
  entry.writeUInt8(0, 2); // palette size, 0 for truecolour
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(images[index].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += images[index].length;
  return entry;
});

const ico = Buffer.concat([header, ...entries, ...images]);
writeFileSync('public/favicon.ico', ico);
console.log(
  `wrote public/favicon.ico (${SIZES.join(', ')}px — ${ico.length} bytes)`,
);
