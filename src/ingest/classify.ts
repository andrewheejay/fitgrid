import { LAYERS, type Category } from '~/domain/layers';

/**
 * The words that put a garment on a layer.
 *
 * Ordered most specific first inside each layer, and the layers are scanned in
 * LAYERS order, so "hoodie" lands on top before "jacket" gets a chance and a
 * "track pant" is a bottom rather than a sport top.
 */
const KEYWORDS: Record<Category, readonly string[]> = {
  top: ['hoodie', 'sweatshirt', 'crewneck', 'jumper', 'sweater', 'knit', 'shirt', 'tee',
    't-shirt', 'polo', 'blouse', 'turtleneck', 'henley', 'top'],
  outer: ['parka', 'overcoat', 'trench', 'peacoat', 'puffer', 'anorak', 'windbreaker',
    'bomber', 'blazer', 'coat', 'jacket', 'vest', 'gilet'],
  bottom: ['trouser', 'jean', 'denim', 'chino', 'cargo', 'short', 'skirt', 'sweatpant',
    'joggers', 'jogger', 'pant', 'slack'],
  shoes: ['sneaker', 'trainer', 'boot', 'loafer', 'derby', 'oxford shoe', 'sandal', 'mule',
    'clog', 'runner', 'shoe'],
};

/**
 * Guess which layer a garment belongs to from its name.
 *
 * A guess, not a classification — the Layer select sits right below the field
 * so the visitor can correct it in one click. Falling back to `top` matches
 * the empty draft rather than inventing a third behaviour.
 */
export function guessCategory(name: string): Category {
  const haystack = name.toLowerCase();
  for (const layer of LAYERS) {
    if (KEYWORDS[layer].some((word) => haystack.includes(word))) return layer;
  }
  return 'top';
}
