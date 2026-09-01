import { describe, expect, it } from 'vitest';
import { guessCategory } from './classify';

describe('guessCategory', () => {
  it.each([
    ['Jet Black Classic Fleece Hoodie', 'top'],
    ['Sportswear Club Crewneck', 'top'],
    ['Wool Overcoat, Navy', 'outer'],
    ['Denim Trucker Jacket', 'outer'],
    ['Wide-Leg Pleated Trousers', 'bottom'],
    ['Nylon Track Pant', 'bottom'],
    ['Samba OG Sneaker', 'shoes'],
    ['Chelsea Boot, Black Leather', 'shoes'],
  ])('reads %s as %s', (name, expected) => {
    expect(guessCategory(name)).toBe(expected);
  });

  it('resolves names that could sit on two layers by layer order', () => {
    // "Boot cut" is a trouser cut; the bottom layer is scanned before shoes.
    expect(guessCategory('Boot Cut Jean')).toBe('bottom');
    // A sweatshirt is a top even though "shirt" also appears in the bottom's
    // neighbours; the top layer is scanned first.
    expect(guessCategory('Heavyweight Sweatshirt')).toBe('top');
  });

  it('falls back to the layer the empty draft already sits on', () => {
    expect(guessCategory('Something entirely unnamed')).toBe('top');
  });
});
