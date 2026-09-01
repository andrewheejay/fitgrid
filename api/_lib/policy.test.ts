import { describe, expect, it } from 'vitest';
import { isFresh, isOverLimit, retryAfterSeconds } from './policy';

const MINUTE = 60_000;

describe('isFresh', () => {
  it('holds a listing for the whole ttl and not past it', () => {
    expect(isFresh(0, 1000, MINUTE)).toBe(true);
    expect(isFresh(0, MINUTE - 1, MINUTE)).toBe(true);
    expect(isFresh(0, MINUTE, MINUTE)).toBe(false);
  });
});

describe('isOverLimit', () => {
  it('allows exactly the limit and refuses the next one', () => {
    expect(isOverLimit({ count: 20, startedAt: 0 }, 20)).toBe(false);
    expect(isOverLimit({ count: 21, startedAt: 0 }, 20)).toBe(true);
  });
});

describe('retryAfterSeconds', () => {
  it('reports the time left in the window, never below one second', () => {
    expect(retryAfterSeconds({ count: 21, startedAt: 0 }, 30_000, MINUTE)).toBe(30);
    expect(retryAfterSeconds({ count: 21, startedAt: 0 }, MINUTE, MINUTE)).toBe(1);
  });
});
