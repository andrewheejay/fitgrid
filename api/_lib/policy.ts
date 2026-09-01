/**
 * How long a cached listing counts, and how much one visitor may ask for.
 *
 * Both are arithmetic over numbers the database holds, kept apart from the
 * database so they can be tested without one.
 */

/** Product copy barely changes, and a wardrobe does not need live pricing. */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_PER_WINDOW = 20;

/** Guards the free credits: a public link can be shared faster than it earns. */
export const DEFAULT_DAILY_SCRAPE_CAP = 200;

export function isFresh(fetchedAt: number, now: number, ttlMs = CACHE_TTL_MS): boolean {
  return now - fetchedAt < ttlMs;
}

export interface RateWindow {
  count: number;
  startedAt: number;
}

/**
 * A fixed-window counter. Rolls over rather than accumulating, so a visitor
 * who waits out the window starts clean.
 */
export function advanceWindow(
  current: RateWindow | null,
  now: number,
  windowMs = RATE_WINDOW_MS,
): RateWindow {
  if (!current || now - current.startedAt >= windowMs) return { count: 1, startedAt: now };
  return { count: current.count + 1, startedAt: current.startedAt };
}

export function isOverLimit(window: RateWindow, limit = RATE_LIMIT_PER_WINDOW): boolean {
  return window.count > limit;
}

/** Seconds until the window resets, for a Retry-After header. */
export function retryAfterSeconds(
  window: RateWindow,
  now: number,
  windowMs = RATE_WINDOW_MS,
): number {
  return Math.max(1, Math.ceil((window.startedAt + windowMs - now) / 1000));
}
