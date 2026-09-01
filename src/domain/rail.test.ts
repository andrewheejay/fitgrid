import { describe, expect, it } from 'vitest';
import { cycleIndex, railWindow } from './rail';

/**
 * The boundary between "render the whole pool" and "window it" is where this
 * has broken before: a five-wide window applied to a four-item pool wraps and
 * shows the same jacket twice.
 */
describe('railWindow', () => {
  it('renders a pool of four whole, in fixed order', () => {
    expect(railWindow(4, 0)).toEqual([0, 1, 2, 3]);
    expect(railWindow(4, 3)).toEqual([0, 1, 2, 3]);
  });

  it('renders a pool of exactly five whole — the outer rail with its skip option', () => {
    expect(railWindow(5, 0)).toEqual([0, 1, 2, 3, 4]);
    expect(railWindow(5, 4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never repeats an index in a small pool, whatever is selected', () => {
    for (let size = 1; size <= 5; size += 1) {
      for (let selected = 0; selected < size; selected += 1) {
        const window = railWindow(size, selected);
        expect(new Set(window).size).toBe(window.length);
      }
    }
  });

  it('windows a pool of six from one behind the selection', () => {
    expect(railWindow(6, 2)).toEqual([1, 2, 3, 4, 5]);
  });

  it('wraps the window without repeating, in a large pool', () => {
    const window = railWindow(18, 17);
    expect(window).toEqual([16, 17, 0, 1, 2]);
    expect(new Set(window).size).toBe(5);
  });

  it('returns nothing for an empty pool', () => {
    expect(railWindow(0, 0)).toEqual([]);
  });
});

describe('cycleIndex', () => {
  it('wraps forwards off the end', () => {
    expect(cycleIndex(5, 4, 1)).toBe(0);
  });

  it('wraps backwards off the start', () => {
    expect(cycleIndex(5, 0, -1)).toBe(4);
  });

  it('stays put in an empty pool rather than producing NaN', () => {
    expect(cycleIndex(0, 0, 1)).toBe(0);
  });
});
