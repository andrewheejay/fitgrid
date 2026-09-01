import { useEffect, useRef } from 'react';
import type { DeckEvent } from '~/domain/deck';

/** The six keys the deck binds. Each one preventDefault()s. */
function toEvent(key: string): DeckEvent | null {
  switch (key) {
    case 'ArrowLeft':
      return { type: 'cycle', direction: -1 };
    case 'ArrowRight':
      return { type: 'cycle', direction: 1 };
    case 'ArrowUp':
      return { type: 'moveLayer', direction: -1 };
    case 'ArrowDown':
      return { type: 'moveLayer', direction: 1 };
    case ' ':
      return { type: 'toggleLock' };
    case 'Enter':
      return { type: 'commit' };
    case 'r':
    case 'R':
      return { type: 'reshuffle', random: Math.random };
    default:
      return null;
  }
}

/**
 * The only place in the app that touches the keyboard. It translates key
 * presses into domain events and does nothing else — no product logic lives
 * here, so the deck's behaviour stays readable in one file.
 *
 * Bound on window while the deck is mounted, and ignored when the user is
 * typing into a field.
 */
export function useDeckKeyboard(dispatch: (event: DeckEvent) => void): void {
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      const deckEvent = toEvent(event.key);
      if (!deckEvent) return;

      event.preventDefault();
      dispatchRef.current(deckEvent);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
