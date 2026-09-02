import { useCallback, useEffect, useRef } from 'react';

/**
 * How long a first tap waits to find out whether it was half of a double.
 *
 * This is the cost of putting two gestures on one target, and it is a real one:
 * every single tap is held for this long before anything happens, on a site
 * whose stated rule is that motion stays under 150ms. It is spent here because
 * the alternative is worse — acting on the first tap means a double-tap rerolls
 * the garment and *then* locks whatever it rolled to, which is never the thing
 * the visitor was looking at when they decided to keep it.
 *
 * 250ms sits above a deliberate double-tap (usually 100–180ms apart) and below
 * the point where a single tap feels broken. A double-tap slower than this
 * rerolls first and locks second; the lock control beside it has no such
 * ambiguity, which is why that one exists too.
 */
const DOUBLE_TAP_MS = 250;

/**
 * Two gestures on one element: tap does one thing, double-tap another.
 *
 * Driven by the click event's own `detail` counter rather than by pairing
 * `click` with `dblclick`. `dblclick` arrives *after* the second click, so the
 * pending single action has to survive until then and be cancelled from a
 * different handler; `detail` says "this is the second click" on the click
 * itself, which is one handler and one decision.
 */
export function useTapOrDoubleTap(
  onTap: () => void,
  onDoubleTap: () => void,
): { onClick: (event: { detail: number }) => void } {
  const pending = useRef<number | null>(null);
  /*
   * The callbacks change on every render — they close over the current
   * selection — but the handler must not, or React would rebind it mid-gesture.
   * A ref keeps the handler stable and still calls the latest pair.
   */
  const latest = useRef({ onTap, onDoubleTap });
  latest.current = { onTap, onDoubleTap };

  const cancel = () => {
    if (pending.current === null) return;
    clearTimeout(pending.current);
    pending.current = null;
  };

  // A row unmounted mid-wait — a mode switch, a route change — must not fire a
  // reroll into a deck that is no longer on screen.
  useEffect(() => cancel, []);

  const onClick = useCallback((event: { detail: number }) => {
    if (event.detail > 1) {
      cancel();
      latest.current.onDoubleTap();
      return;
    }
    cancel();
    pending.current = window.setTimeout(() => {
      pending.current = null;
      latest.current.onTap();
    }, DOUBLE_TAP_MS);
  }, []);

  return { onClick };
}
