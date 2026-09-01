#!/usr/bin/env node
/**
 * Bake the wardrobe you built in the browser into the committed seed.
 *
 *   node scripts/bake-seed.mjs <overlay.json>
 *
 * Takes the localStorage overlay (added items and saved fits), writes each
 * cut-out out as a real image file under public/garments/, and regenerates
 * src/data/seed/items.ts and outfits.ts to reference them.
 *
 * Item ids are rewritten from UUIDs to readable ones (t1, o1, b1, s1) so the
 * seed reads like source rather than a database dump, and saved fits are
 * remapped onto the new ids.
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , overlayPath] = process.argv;
if (!overlayPath) {
  console.error('usage: node scripts/bake-seed.mjs <overlay.json>');
  process.exit(1);
}

const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
const items = overlay.addedItems ?? [];
const outfits = overlay.savedOutfits ?? [];

if (items.length === 0) {
  console.error('No added items in that overlay — nothing to bake.');
  process.exit(1);
}

const IMAGE_DIR = join('public', 'garments');
if (existsSync(IMAGE_DIR)) rmSync(IMAGE_DIR, { recursive: true });
mkdirSync(IMAGE_DIR, { recursive: true });

const PREFIX = { top: 't', outer: 'o', bottom: 'b', shoes: 's' };
const counters = { top: 0, outer: 0, bottom: 0, shoes: 0 };
const idMap = new Map();

/** Layer order, so the seed file reads top → outer → bottom → shoes. */
const ORDER = ['top', 'outer', 'bottom', 'shoes'];
const sorted = [...items].sort(
  (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category),
);

const baked = sorted.map((item) => {
  counters[item.category] += 1;
  const id = `${PREFIX[item.category]}${counters[item.category]}`;
  idMap.set(item.id, id);

  let imageUrl;
  if (typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:')) {
    const [header, data] = item.imageUrl.split(',');
    const ext = header.includes('image/webp') ? 'webp' : header.includes('image/png') ? 'png' : 'jpg';
    writeFileSync(join(IMAGE_DIR, `${id}.${ext}`), Buffer.from(data, 'base64'));
    imageUrl = `/garments/${id}.${ext}`;
  } else if (item.imageUrl) {
    imageUrl = item.imageUrl;
  }

  return { ...item, id, ...(imageUrl ? { imageUrl } : {}) };
});

const quote = (value) => `'${String(value).replace(/'/g, "\\'")}'`;

function renderItem(item) {
  const lines = [
    `    id: ${quote(item.id)},`,
    `    category: ${quote(item.category)},`,
    `    name: ${quote(item.name)},`,
    `    silhouette: ${quote(item.silhouette)},`,
    `    texture: ${quote(item.texture)},`,
    `    aesthetic: ${quote(item.aesthetic)},`,
    `    tone: ${quote(item.tone)},`,
    `    palette: [${item.palette.map(quote).join(', ')}],`,
    `    addedAt: ${quote(item.addedAt)},`,
    `    wornCount: ${item.wornCount ?? 0},`,
  ];
  if (item.imageUrl) lines.push(`    imageUrl: ${quote(item.imageUrl)},`);
  for (const key of ['brand', 'styleCode', 'colourway', 'composition', 'retail']) {
    if (item[key]) lines.push(`    ${key}: ${quote(item[key])},`);
  }
  lines.push(`    source: ${quote(item.source ?? 'image')},`);
  return `  {\n${lines.join('\n')}\n  },`;
}

const counts = ORDER.map((layer) => `${counters[layer]} ${layer}`).join(', ');

writeFileSync(
  join('src', 'data', 'seed', 'items.ts'),
  `import type { Item } from '~/domain/items';

/**
 * The wardrobe: ${baked.length} pieces — ${counts}.
 *
 * Real garments, added through the app's own cut-out path and baked into the
 * seed with scripts/bake-seed.mjs. Images live in public/garments.
 */
export const SEED_ITEMS: readonly Item[] = [
${baked.map(renderItem).join('\n')}
];
`,
);

const bakedOutfits = outfits
  .map((fit) => ({
    ...fit,
    top: idMap.get(fit.top),
    outer: fit.outer ? idMap.get(fit.outer) : null,
    bottom: idMap.get(fit.bottom),
    shoes: idMap.get(fit.shoes),
  }))
  .filter((fit) => fit.top && fit.bottom && fit.shoes);

writeFileSync(
  join('src', 'data', 'seed', 'outfits.ts'),
  `import type { Outfit } from '~/domain/outfits';

/** Saved fits built from the wardrobe above. A null outer layer was skipped. */
export const SEED_OUTFITS: readonly Outfit[] = [
${bakedOutfits
  .map(
    (fit, index) =>
      `  { id: 'f${index + 1}', name: ${quote(fit.name)}, date: ${quote(fit.date)}, top: ${quote(
        fit.top,
      )}, outer: ${fit.outer ? quote(fit.outer) : 'null'}, bottom: ${quote(
        fit.bottom,
      )}, shoes: ${quote(fit.shoes)} },`,
  )
  .join('\n')}
];
`,
);

console.log(`Baked ${baked.length} items (${counts}) and ${bakedOutfits.length} fits.`);
console.log(`Images written to ${IMAGE_DIR}/`);
