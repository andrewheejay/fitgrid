import type { Flash } from './flash';
import type { ItemId } from './items';
import { indexOfLayer, LAYERS, layerAt, type Layer } from './layers';
import { cycleIndex } from './rail';

export type DeckMode = 'auto' | 'manual';

export interface DeckState {
  mode: DeckMode;
  /** Index into LAYERS. */
  activeLayer: number;
  /** One pool index per layer. */
  selection: Record<Layer, number>;
  locked: Record<Layer, boolean>;
  /** Layer-by-layer progress, 0..LAYERS.length - 1. */
  step: number;
  flash: Flash | null;
  /**
   * Increments on every flash, including a repeat of the same message. The view
   * keys its auto-clear timer on this, so a new message restarts the countdown.
   */
  flashId: number;
}

/**
 * The pool of choices per layer. The outer pool includes the synthesised "no
 * outer layer" option; see poolsFrom() in outfits.ts.
 */
export type DeckPools = Record<Layer, readonly ItemId[]>;

export type DeckEvent =
  /** Left/right: step the active layer's selection. */
  | { type: 'cycle'; direction: -1 | 1 }
  /** Up/down: move which layer is active. Disabled in layer-by-layer mode. */
  | { type: 'moveLayer'; direction: -1 | 1 }
  /**
   * Space, or a rail's lock button. Omitting the layer means the active one,
   * which is what the keyboard does; the rail names its own layer, since you can
   * lock a rail you are not currently on.
   */
  | { type: 'toggleLock'; layer?: Layer }
  /** R. Randomness is injected so that every shuffle is reproducible. */
  | { type: 'reshuffle'; random: () => number }
  /** Enter. Means "save" in auto mode and "confirm this layer" in manual. */
  | { type: 'commit' }
  /** Clicking an option in a rail. */
  | { type: 'select'; layer: Layer; index: number }
  | { type: 'setMode'; mode: DeckMode }
  | { type: 'clearFlash' };

/**
 * Saving is returned as an effect rather than performed, so the reducer stays
 * pure and "does Enter save?" is an assertion about a return value.
 */
export type DeckEffect = { type: 'saveFit'; selection: Record<Layer, number> };

export interface DeckStateOptions {
  mode?: DeckMode;
  /** Pre-select and lock one layer — used by "Lock into a fit" on item detail. */
  lock?: { layer: Layer; index: number };
}

/** The prototype's starting selection: outer sits on the chore jacket. */
const DEFAULT_SELECTION: Record<Layer, number> = { top: 0, outer: 1, bottom: 1, shoes: 2 };

const NO_LOCKS: Record<Layer, boolean> = {
  top: false,
  outer: false,
  bottom: false,
  shoes: false,
};

export function initialDeckState(options: DeckStateOptions = {}): DeckState {
  const state: DeckState = {
    mode: options.mode ?? 'auto',
    activeLayer: 0,
    selection: { ...DEFAULT_SELECTION },
    locked: { ...NO_LOCKS },
    step: 0,
    flash: null,
    flashId: 0,
  };
  if (!options.lock) return state;

  const { layer, index } = options.lock;
  return {
    ...state,
    activeLayer: indexOfLayer(layer),
    selection: { ...state.selection, [layer]: index },
    locked: { ...state.locked, [layer]: true },
  };
}

function withFlash(state: DeckState, flash: Flash): DeckState {
  return { ...state, flash, flashId: state.flashId + 1 };
}

const NO_EFFECTS: DeckEffect[] = [];

export function reduce(
  state: DeckState,
  event: DeckEvent,
  pools: DeckPools,
): [DeckState, DeckEffect[]] {
  switch (event.type) {
    case 'cycle': {
      const layer = layerAt(state.activeLayer);
      // A locked layer refuses the change and says why, rather than silently
      // ignoring the key.
      if (state.locked[layer]) {
        return [withFlash(state, { kind: 'alreadyLocked', layer }), NO_EFFECTS];
      }
      const next = cycleIndex(pools[layer].length, state.selection[layer], event.direction);
      return [{ ...state, selection: { ...state.selection, [layer]: next } }, NO_EFFECTS];
    }

    case 'moveLayer': {
      // In layer-by-layer mode the flow controls which layer you are on.
      if (state.mode === 'manual') return [state, NO_EFFECTS];
      const activeLayer = cycleIndex(LAYERS.length, state.activeLayer, event.direction);
      return [{ ...state, activeLayer }, NO_EFFECTS];
    }

    case 'toggleLock': {
      const layer = event.layer ?? layerAt(state.activeLayer);
      const nowLocked = !state.locked[layer];
      return [
        withFlash(
          {
            ...state,
            activeLayer: indexOfLayer(layer),
            locked: { ...state.locked, [layer]: nowLocked },
          },
          { kind: nowLocked ? 'locked' : 'unlocked', layer },
        ),
        NO_EFFECTS,
      ];
    }

    case 'reshuffle': {
      const selection = { ...state.selection };
      for (const layer of LAYERS) {
        if (state.locked[layer]) continue; // a locked shirt survives every reroll
        const size = pools[layer].length;
        if (size > 0) selection[layer] = Math.floor(event.random() * size) % size;
      }
      return [withFlash({ ...state, selection }, { kind: 'reshuffled' }), NO_EFFECTS];
    }

    case 'commit': {
      if (state.mode === 'auto') {
        return [
          withFlash(state, { kind: 'saved' }),
          [{ type: 'saveFit', selection: { ...state.selection } }],
        ];
      }

      // Manual: lock the current layer and drop to the next one. On the last
      // layer, lock it and save.
      const layer = layerAt(state.activeLayer);
      const locked = { ...state.locked, [layer]: true };
      const isLast = state.step >= LAYERS.length - 1;

      if (isLast) {
        return [
          withFlash({ ...state, locked }, { kind: 'saved' }),
          [{ type: 'saveFit', selection: { ...state.selection } }],
        ];
      }
      const step = state.step + 1;
      return [{ ...state, locked, step, activeLayer: step }, NO_EFFECTS];
    }

    case 'select': {
      // Clicking an option in a locked layer does nothing.
      if (state.locked[event.layer]) return [state, NO_EFFECTS];
      return [
        {
          ...state,
          activeLayer: indexOfLayer(event.layer),
          selection: { ...state.selection, [event.layer]: event.index },
        },
        NO_EFFECTS,
      ];
    }

    case 'setMode': {
      // Switching modes resets progress and clears every lock.
      if (event.mode === state.mode) return [state, NO_EFFECTS];
      return [
        {
          ...state,
          mode: event.mode,
          activeLayer: 0,
          step: 0,
          locked: { ...NO_LOCKS },
          flash: null,
        },
        NO_EFFECTS,
      ];
    }

    case 'clearFlash':
      return [{ ...state, flash: null }, NO_EFFECTS];
  }
}

export function lockedCount(state: DeckState): number {
  return LAYERS.filter((layer) => state.locked[layer]).length;
}

/** Resolve the current selection to item ids, one per layer. */
export function selectedIds(
  selection: Record<Layer, number>,
  pools: DeckPools,
): Record<Layer, ItemId | undefined> {
  return {
    top: pools.top[selection.top],
    outer: pools.outer[selection.outer],
    bottom: pools.bottom[selection.bottom],
    shoes: pools.shoes[selection.shoes],
  };
}
