import { describe, expect, it } from 'vitest';
import {
  advanceWindow,
  isFresh,
  isOverLimit,
  retryAfterSeconds,
  type RateWindow,
} from './policy';

const MINUTE = 60_000;

describe('isFresh', () => {
  it('holds a listing for the whole ttl and not past it', () => {
    expect(isFresh(0, 1000, MINUTE)).toBe(true);
    expect(isFresh(0, MINUTE - 1, MINUTE)).toBe(true);
    expect(isFresh(0, MINUTE, MINUTE)).toBe(false);
  });
});

describe('advanceWindow', () => {
  it('opens a window on the first request', () => {
    expect(advanceWindow(null, 500, MINUTE)).toEqual({ count: 1, startedAt: 500 });
  });

  it('counts up inside the window without moving its start', () => {
    const first = advanceWindow(null, 0, MINUTE);
    const second = advanceWindow(first, 30_000, MINUTE);
    expect(second).toEqual({ count: 2, startedAt: 0 });
  });

  it('rolls over once the window has elapsed', () => {
    const stale: RateWindow = { count: 99, startedAt: 0 };
    expect(advanceWindow(stale, MINUTE, MINUTE)).toEqual({ count: 1, startedAt: MINUTE });
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
