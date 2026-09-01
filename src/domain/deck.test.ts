import { describe, expect, it } from 'vitest';
import {
  initialDeckState,
  lockedCount,
  reduce,
  selectedIds,
  type DeckEvent,
  type DeckPools,
  type DeckState,
} from './deck';
import { NO_OUTER } from './outfits';

/** Four tops, the outer rail with its skip option, four bottoms, three shoes. */
const POOLS: DeckPools = {
  top: ['t1', 't2', 't3', 't4'],
  outer: [NO_OUTER, 'o1', 'o2', 'o3'],
  bottom: ['b1', 'b2', 'b3', 'b4'],
  shoes: ['s1', 's2', 's3'],
};

/** Apply a sequence of events, returning the final state and last effects. */
function run(state: DeckState, ...events: DeckEvent[]) {
  let current = state;
  let effects = reduce(current, { type: 'clearFlash' }, POOLS)[1];
  for (const event of events) {
    [current, effects] = reduce(current, event, POOLS);
  }
  return { state: current, effects };
}

const fresh = () => initialDeckState();

describe('the deck starts', () => {
  it('on the top layer, nothing locked, on the prototype selection', () => {
    const state = fresh();
    expect(state.activeLayer).toBe(0);
    expect(state.selection).toEqual({ top: 0, outer: 1, bottom: 1, shoes: 2 });
    expect(lockedCount(state)).toBe(0);
    expect(state.mode).toBe('auto');
  });

  it('pre-locks a layer when arriving from "Lock into a fit"', () => {
    const state = initialDeckState({ lock: { layer: 'bottom', index: 3 } });
    expect(state.locked.bottom).toBe(true);
    expect(state.selection.bottom).toBe(3);
    expect(state.activeLayer).toBe(2);
  });
});

describe('left and right cycle the active layer', () => {
  it('steps the selection forwards', () => {
    const { state } = run(fresh(), { type: 'cycle', direction: 1 });
    expect(state.selection.top).toBe(1);
  });

  it('wraps backwards off the start', () => {
    const { state } = run(fresh(), { type: 'cycle', direction: -1 });
    expect(state.selection.top).toBe(POOLS.top.length - 1);
  });

  it('refuses on a locked layer, and says why', () => {
    const { state } = run(fresh(), { type: 'toggleLock' }, { type: 'cycle', direction: 1 });
    expect(state.selection.top).toBe(0);
    expect(state.flash).toEqual({ kind: 'alreadyLocked', layer: 'top' });
  });
});

describe('up and down move between layers', () => {
  it('wraps across all four in auto mode', () => {
    const { state } = run(fresh(), { type: 'moveLayer', direction: -1 });
    expect(state.activeLayer).toBe(3);
  });

  it('is disabled in layer-by-layer mode, where the flow controls the layer', () => {
    const { state } = run(
      fresh(),
      { type: 'setMode', mode: 'manual' },
      { type: 'moveLayer', direction: 1 },
    );
    expect(state.activeLayer).toBe(0);
  });
});

describe('space locks and unlocks', () => {
  it('locks the active layer and flashes it', () => {
    const { state } = run(fresh(), { type: 'toggleLock' });
    expect(state.locked.top).toBe(true);
    expect(state.flash).toEqual({ kind: 'locked', layer: 'top' });
  });

  it('unlocks again on a second press', () => {
    const { state } = run(fresh(), { type: 'toggleLock' }, { type: 'toggleLock' });
    expect(state.locked.top).toBe(false);
    expect(state.flash).toEqual({ kind: 'unlocked', layer: 'top' });
  });

  it('locks a named layer without the keyboard having moved there first', () => {
    const { state } = run(fresh(), { type: 'toggleLock', layer: 'shoes' });
    expect(state.locked.shoes).toBe(true);
    expect(state.activeLayer).toBe(3);
  });
});

describe('R reshuffles what is still open', () => {
  it('leaves locked layers untouched and rerolls the rest', () => {
    const { state } = run(
      fresh(),
      { type: 'toggleLock' },
      // A generator that always picks the last item, so the result is exact.
      { type: 'reshuffle', random: () => 0.999 },
    );
    expect(state.selection.top).toBe(0); // locked, survived
    expect(state.selection.outer).toBe(POOLS.outer.length - 1);
    expect(state.selection.bottom).toBe(POOLS.bottom.length - 1);
    expect(state.selection.shoes).toBe(POOLS.shoes.length - 1);
    expect(state.flash).toEqual({ kind: 'reshuffled' });
  });

  it('never selects past the end of a pool', () => {
    const { state } = run(fresh(), { type: 'reshuffle', random: () => 1 });
    expect(state.selection.shoes).toBeLessThan(POOLS.shoes.length);
  });
});

describe('enter', () => {
  it('saves in auto mode, returning the selection as an effect', () => {
    const { state, effects } = run(fresh(), { type: 'commit' });
    expect(effects).toEqual([
      { type: 'saveFit', selection: { top: 0, outer: 1, bottom: 1, shoes: 2 } },
    ]);
    expect(state.flash).toEqual({ kind: 'saved' });
  });

  it('confirms a layer and drops to the next in layer-by-layer mode', () => {
    const { state, effects } = run(
      fresh(),
      { type: 'setMode', mode: 'manual' },
      { type: 'commit' },
    );
    expect(state.locked.top).toBe(true);
    expect(state.step).toBe(1);
    expect(state.activeLayer).toBe(1);
    expect(effects).toEqual([]);
  });

  it('locks the last layer and saves, at the end of layer-by-layer', () => {
    const { state, effects } = run(
      fresh(),
      { type: 'setMode', mode: 'manual' },
      { type: 'commit' },
      { type: 'commit' },
      { type: 'commit' },
      { type: 'commit' },
    );
    expect(lockedCount(state)).toBe(4);
    expect(effects).toHaveLength(1);
    expect(effects[0]?.type).toBe('saveFit');
  });
});

describe('clicking a rail option', () => {
  it('selects it and makes that layer active', () => {
    const { state } = run(fresh(), { type: 'select', layer: 'shoes', index: 0 });
    expect(state.selection.shoes).toBe(0);
    expect(state.activeLayer).toBe(3);
  });

  it('does nothing in a locked layer', () => {
    const { state } = run(
      fresh(),
      { type: 'toggleLock', layer: 'shoes' },
      { type: 'select', layer: 'shoes', index: 0 },
    );
    expect(state.selection.shoes).toBe(2);
  });
});

describe('switching mode', () => {
  it('resets progress and clears every lock', () => {
    const { state } = run(
      fresh(),
      { type: 'toggleLock' },
      { type: 'moveLayer', direction: 1 },
      { type: 'setMode', mode: 'manual' },
    );
    expect(lockedCount(state)).toBe(0);
    expect(state.activeLayer).toBe(0);
    expect(state.step).toBe(0);
  });

  it('is a no-op when the mode is already selected, so locks survive', () => {
    const { state } = run(fresh(), { type: 'toggleLock' }, { type: 'setMode', mode: 'auto' });
    expect(state.locked.top).toBe(true);
  });
});

describe('flash bookkeeping', () => {
  it('bumps flashId on every message so the view restarts its timer', () => {
    const first = reduce(fresh(), { type: 'toggleLock' }, POOLS)[0];
    const second = reduce(first, { type: 'toggleLock' }, POOLS)[0];
    expect(second.flashId).toBeGreaterThan(first.flashId);
  });
});

describe('selectedIds', () => {
  it('resolves the selection to item ids, including the skip option', () => {
    const ids = selectedIds({ top: 0, outer: 0, bottom: 1, shoes: 2 }, POOLS);
    expect(ids).toEqual({ top: 't1', outer: NO_OUTER, bottom: 'b2', shoes: 's3' });
  });
});
