/**
 * Layer order is fixed and is the single source of truth for it. Everything
 * that iterates a fit — the deck stack, the rails, a saved fit's rows — derives
 * its order from here rather than restating it.
 */
export const LAYERS = ['top', 'outer', 'bottom', 'shoes'] as const;

export type Layer = (typeof LAYERS)[number];

/** A garment's category is exactly the layer it occupies. */
export type Category = Layer;

const DISPLAY_NAMES: Record<Layer, string> = {
  top: 'Top',
  outer: 'Outerwear',
  bottom: 'Bottom',
  shoes: 'Shoes',
};

export function layerName(layer: Layer): string {
  return DISPLAY_NAMES[layer];
}

export function layerAt(index: number): Layer {
  const layer = LAYERS[index];
  if (layer === undefined) {
    throw new RangeError(`No layer at index ${index}`);
  }
  return layer;
}

export function indexOfLayer(layer: Layer): number {
  return LAYERS.indexOf(layer);
}

/** Outerwear is optional: a t-shirt day should not be forced into a jacket. */
export function isOptional(layer: Layer): boolean {
  return layer === 'outer';
}
