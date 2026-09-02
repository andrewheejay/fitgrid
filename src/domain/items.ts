import type { Category } from './layers';

export type ItemId = string;

/**
 * A CSS hex colour. Narrow enough to catch a seed entry that forgot its `#`,
 * which would otherwise render as a silently broken swatch.
 */
export type Hex = `#${string}`;

export const AESTHETICS = ['workwear', 'quiet', 'casual', 'utility', 'sport'] as const;

export type Aesthetic = (typeof AESTHETICS)[number];

/**
 * How the item entered the wardrobe. Drives the credit line on item detail.
 *
 * Two ways in, both real: a product page Fitgrid read, or an image cut out in
 * the browser. The care-label scan and the order-email parse were simulations
 * of a catalogue this build does not have, and a tab that returns a fixed
 * answer teaches a reviewer nothing the other two do not.
 */
export type ItemSource = 'link' | 'image';

export interface Item {
  id: ItemId;
  category: Category;

  /** Human-named, so: sans, sentence case. */
  name: string;

  /* What the system knows, so: mono, uppercase at the point of display. */
  silhouette: string;
  texture: string;
  aesthetic: Aesthetic;

  /** Dominant hex. Drives the placeholder pattern and any colour UI. */
  tone: Hex;
  palette: readonly [Hex, Hex, Hex];

  /**
   * ISO 8601. Stored unformatted on purpose: the prototype's "Mar 04" strings
   * sort incorrectly across a year boundary, and formatting is a view concern.
   */
  addedAt: string;

  wornCount: number;

  /** Undefined until real imagery exists; the striped placeholder stands in. */
  imageUrl?: string;

  brand?: string;
  styleCode?: string;
  colourway?: string;
  composition?: string;
  retail?: string;

  source: ItemSource;
}

/**
 * A hand correction to one item, held apart from the item itself.
 *
 * The seed wardrobe ships inside the bundle and cannot be written to, so an
 * edit is recorded as a patch keyed by id and merged back over the catalogue at
 * read time. Added items take the same path — one merge rule rather than two —
 * which also means `reset@fitgrid` restores every field by dropping the
 * overlay, exactly as it already does for additions and removals.
 *
 * Only fields a person can reasonably know better than the pipeline are here.
 * `id`, `addedAt`, `source` and `imageUrl` are provenance: what happened, not
 * what the garment is.
 */
export interface ItemPatch {
  name?: string;
  category?: Category;
  silhouette?: string;
  texture?: string;
  aesthetic?: Aesthetic;
  brand?: string;
  styleCode?: string;
  colourway?: string;
  composition?: string;
  retail?: string;
  wornCount?: number;
  palette?: readonly [Hex, Hex, Hex];
}

export function applyItemPatch(item: Item, patch: ItemPatch | undefined): Item {
  // The dominant tone drives the placeholder pattern and is only ever the first
  // palette entry, so it follows the palette rather than being edited twice.
  if (!patch) return item;
  const patched = { ...item, ...patch };
  return patch.palette ? { ...patched, tone: patch.palette[0] } : patched;
}

/** "boxy / cotton poplin / worn 12×" — the wardrobe cell's metadata line. */
export function gridMetaLine(item: Item): string {
  return `${item.silhouette} / ${item.texture} / worn ${item.wornCount}×`;
}

/** "boxy · cotton poplin · workwear" — the deck preview's metadata line. */
export function deckMetaLine(item: Item): string {
  return `${item.silhouette} · ${item.texture} · ${item.aesthetic}`;
}
