#!/usr/bin/env node
/**
 * Build public/og-image-1200x630.png from assets/og-source-1200x630.png.
 *
 *   node scripts/recentre-og.mjs
 *
 * The brand kit's link-preview image is composed flush left: the wordmark,
 * tagline and URL all start at x=81, and the filled cell ends at x=899, so 300
 * of the 1200 columns are empty paper on the right.
 *
 * That is fine at the 1.91:1 the tag declares, and wrong everywhere the image
 * is shown squarer than that. iMessage crops a link preview to roughly 1.6:1
 * by taking the middle of the frame, which removes about 100 columns from each
 * side — enough to cut the f off "fitgrid" and the A off "A catalogue".
 *
 * So the content is moved right by 110px, which puts its centre on the canvas
 * centre and leaves 191px of margin on both sides. A centre crop then has to
 * come in past 190 columns before it touches anything.
 *
 * The move is a copy of pixels, not a re-render: the type is raster and the
 * kit ships no source, so resampling it would only soften it. The catch is
 * that the ruled grid comes along inside the copied rectangle, so the grid
 * this script draws underneath is drawn at the shifted phase — lines every
 * 100px starting at 110 rather than 100 — and the two land on each other
 * exactly. The horizontal rules are untouched: the composition is already
 * centred vertically.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const W = 1200;
const H = 630;

/** Measured off the source, not guessed: paper, and the colour of a rule. */
const PAPER = [244, 242, 237];
const RULE = [233, 231, 225];

/** Every rule is 2px, drawn on the two columns/rows ending at the multiple. */
const V_PITCH = 100;
const H_PITCH = 105;
const SHIFT = 110;

/** The content, with a margin, and where it goes. */
const CROP = { left: 80, top: 80, width: 820, height: 480 };

const ground = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i += 1) ground.set(PAPER, i * 3);

const rule = (x, y) => ground.set(RULE, (y * W + x) * 3);
for (let x = SHIFT; x < W; x += V_PITCH) {
  for (let y = 0; y < H; y += 1) {
    rule(x - 1, y);
    rule(x, y);
  }
}
for (let y = H_PITCH; y < H; y += H_PITCH) {
  for (let x = 0; x < W; x += 1) {
    rule(x, y - 1);
    rule(x, y);
  }
}

const content = await sharp('assets/og-source-1200x630.png').extract(CROP).png().toBuffer();

const out = await sharp(ground, { raw: { width: W, height: H, channels: 3 } })
  .composite([{ input: content, left: CROP.left + SHIFT, top: CROP.top }])
  .png({ palette: true })
  .toBuffer();

writeFileSync('public/og-image-1200x630.png', out);
console.log(`wrote public/og-image-1200x630.png (${W}x${H} — ${out.length} bytes)`);
