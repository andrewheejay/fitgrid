import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initialDeckState,
  reduce,
  type DeckEffect,
  type DeckEvent,
  type DeckPools,
  type DeckState,
  type DeckStateOptions,
} from '~/domain/deck';
import { FLASH_DURATION_MS } from '~/domain/flash';

interface UseDeckResult {
  state: DeckState;
  dispatch: (event: DeckEvent) => void;
}

/**
 * Binds the pure deck reducer to React.
 *
 * Effects returned by the reducer are executed here rather than inside it, so
 * the reducer stays a pure function of (state, event, pools) and "does Enter
 * save?" remains an assertion about a return value.
 */
export function useDeck(
  pools: DeckPools,
  onEffect: (effect: DeckEffect, state: DeckState) => void,
  options: DeckStateOptions = {},
): UseDeckResult {
  const [state, setState] = useState<DeckState>(() => initialDeckState(options));

  // Mirrors of the live values, so dispatch has a stable identity and never
  // reads a stale closure.
  const stateRef = useRef(state);
  const poolsRef = useRef(pools);
  const onEffectRef = useRef(onEffect);
  poolsRef.current = pools;
  onEffectRef.current = onEffect;

  const dispatch = useCallback((event: DeckEvent) => {
    const [next, effects] = reduce(stateRef.current, event, poolsRef.current);
    stateRef.current = next;
    setState(next);
    for (const effect of effects) onEffectRef.current(effect, next);
  }, []);

  // A flash clears itself; a new message restarts the countdown, which is what
  // keying the timer on flashId buys.
  useEffect(() => {
    if (!state.flash) return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'clearFlash' }),
      FLASH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state.flashId, state.flash, dispatch]);

  return { state, dispatch };
}
