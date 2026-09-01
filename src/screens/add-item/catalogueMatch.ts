import type { SpecRow } from '~/components/SpecTable';
import type { Item } from '~/domain/items';

/**
 * The fixture a catalogue lookup resolves to.
 *
 * The care label and the order email are demonstrations: reading a sewn-in
 * label, or parsing every retailer's confirmation email, needs commercial
 * product data or a per-brand parser set, and the handoff itself lists that as
 * unproven. The shape is real; the answer is fixed. (The link path used to
 * land here too — it now reads the page, in ~/ingest/listing.)
 */
export const CATALOGUE_MATCH = {
  brand: 'Uniqlo U',
  name: 'Heavyweight hoodie, dark navy',
  pill: '97% match',
  rows: [
    { key: 'Style code', value: 'E465184-000' },
    { key: 'Colourway', value: '69 Navy' },
    { key: 'Composition', value: '100% cotton, 13.5 oz' },
    { key: 'Retail', value: '€49.90 · bought Feb 07' },
  ] satisfies SpecRow[],
  tags: ['top', 'boxy', 'brushed fleece', 'casual', '#2c3444', '#8a8a8a', '#0a0a0a'],
} as const;

export function catalogueItem(id: string, source: Item['source']): Item {
  return {
    id,
    category: 'top',
    name: 'Heavyweight hoodie, dark navy',
    silhouette: 'boxy',
    texture: 'brushed fleece',
    aesthetic: 'casual',
    tone: '#2c3444',
    palette: ['#2c3444', '#8a8a8a', '#0a0a0a'],
    addedAt: new Date().toISOString().slice(0, 10),
    wornCount: 0,
    brand: 'Uniqlo U',
    styleCode: 'E465184-000',
    colourway: '69 Navy',
    composition: '100% cotton, 13.5 oz',
    retail: '€49.90',
    source,
  };
}
