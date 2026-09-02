import { describe, expect, it } from 'vitest';
import { cycleIndex } from './rail';

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
