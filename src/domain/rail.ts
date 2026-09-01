/**
 * Which pool indices a deck rail shows, given the current selection.
 *
 * The rule has two halves and the boundary between them is where this has
 * historically broken: a pool of five or fewer renders whole, in fixed order,
 * with the selected item outlined. Only a larger pool becomes a window that
 * travels with the selection.
 *
 * Windowing a small pool is what produced the bug the handoff records — the
 * same jacket appearing twice in a four-item category — because the window is
 * five wide and wraps.
 */
const WINDOW_SIZE = 5;
const WINDOW_LEAD = 1; // one item of context behind the selection

export function railWindow(poolSize: number, selected: number): number[] {
  if (poolSize <= 0) return [];
  if (poolSize <= WINDOW_SIZE) {
    return Array.from({ length: poolSize }, (_, i) => i);
  }
  return Array.from(
    { length: WINDOW_SIZE },
    (_, offset) => (selected - WINDOW_LEAD + offset + poolSize) % poolSize,
  );
}

/** Step through a pool with wrapping, in either direction. */
export function cycleIndex(poolSize: number, current: number, direction: -1 | 1): number {
  if (poolSize <= 0) return 0;
  return (current + direction + poolSize) % poolSize;
}
