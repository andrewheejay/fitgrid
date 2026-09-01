import type { Category } from './layers';

export type ItemId = string;

/**
 * A CSS hex colour. Narrow enough to catch a seed entry that forgot its `#`,
 * which would otherwise render as a silently broken swatch.
 */
export type Hex = `#${string}`;

export type Aesthetic = 'workwear' | 'quiet' | 'casual' | 'utility' | 'sport';

/** How the item entered the wardrobe. Drives the credit line on item detail. */
export type ItemSource = 'label' | 'link' | 'receipt' | 'image';

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

/** "boxy / cotton poplin / worn 12×" — the wardrobe cell's metadata line. */
export function gridMetaLine(item: Item): string {
  return `${item.silhouette} / ${item.texture} / worn ${item.wornCount}×`;
}

/** "boxy · cotton poplin · workwear" — the deck preview's metadata line. */
export function deckMetaLine(item: Item): string {
  return `${item.silhouette} · ${item.texture} · ${item.aesthetic}`;
}
