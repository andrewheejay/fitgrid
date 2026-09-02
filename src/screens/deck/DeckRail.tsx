import { useEffect, useRef } from 'react';
import { GarmentImage } from '~/components/GarmentImage';
import type { Item, ItemId } from '~/domain/items';
import { layerName, type Layer } from '~/domain/layers';
import { isNoOuter, NO_OUTER_NAME } from '~/domain/outfits';
import styles from './DeckRail.module.css';

interface DeckRailProps {
  layer: Layer;
  pool: readonly ItemId[];
  selected: number;
  active: boolean;
  locked: boolean;
  dimmed: boolean;
  itemsById: Map<ItemId, Item>;
  onSelect: (index: number) => void;
  onToggleLock: () => void;
}

export function DeckRail({
  layer,
  pool,
  selected,
  active,
  locked,
  dimmed,
  itemsById,
  onSelect,
  onToggleLock,
}: DeckRailProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  /*
   * Keep the selection on screen. Arrow keys are the deck's primary control,
   * so cycling past the edge of the strip has to bring the rail with it —
   * otherwise the outline lands on a garment nobody can see.
   *
   * The strip is scrolled directly rather than through scrollIntoView, which
   * would also scroll every ancestor and drag the page up and down as the
   * visitor cycles a layer.
   */
  useEffect(() => {
    const container = stripRef.current;
    /*
     * Read the option out of the strip by index rather than holding a ref to
     * whichever one is selected. A ref object attached conditionally is set and
     * cleared in tree order as the selection moves, so it lands on null for
     * half the moves — which is why the rail did not follow a wrap from the
     * first garment to the last. The children are the pool, in pool order.
     */
    const option = container?.children.item(selected);
    if (!container || !(option instanceof HTMLElement)) return;

    /*
     * Measured against the strip's own box rather than with offsetLeft, which
     * is relative to the nearest *positioned* ancestor — and the strip is not
     * positioned, so offsetLeft returned a coordinate in the page and every
     * rail scrolled itself off its first garment on mount.
     */
    const strip = container.getBoundingClientRect();
    const box = option.getBoundingClientRect();

    /*
     * Moved instantly, by assignment. Two reasons, and the second is the one
     * that decided it: a smooth scroll requested here was silently dropped —
     * the deltas were right and the position never moved — and in any case
     * base.css holds that motion in this design is "colour-only and under
     * 150ms", so a rail gliding sideways under the arrow keys would be the
     * largest movement on the site. Held arrow keys also stay in step this way.
     */
    if (box.left < strip.left) {
      container.scrollLeft += box.left - strip.left;
    } else if (box.right > strip.right) {
      container.scrollLeft += box.right - strip.right;
    }
  }, [selected]);

  return (
    <section
      className={`${styles.rail} ${active ? styles.railActive : ''} ${dimmed ? styles.dim : ''}`}
    >
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={`${styles.square} ${active ? styles.squareActive : ''}`} />
          <span className={styles.layer}>{layerName(layer)}</span>
          <span className={styles.counter}>
            {selected + 1} / {pool.length}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.lock} ${locked ? styles.lockOn : ''}`}
          onClick={onToggleLock}
          aria-pressed={locked}
        >
          {locked ? 'Locked ✕' : 'Lock ␣'}
        </button>
      </div>

      {/*
        The whole pool is rendered and the strip scrolls. It used to render a
        five-wide window that travelled with the selection, which meant a
        category of eight had three garments you could not see or click — only
        cycle blindly past.
      */}
      <div className={styles.strip} ref={stripRef}>
        {pool.map((id, index) => {
          const item = id ? itemsById.get(id) : undefined;
          const isSelected = index === selected;

          return (
            <button
              key={`${layer}-${index}`}
              type="button"
              className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
              onClick={() => onSelect(index)}
              aria-pressed={isSelected}
            >
              {item ? (
                <GarmentImage item={item} height={74} />
              ) : (
                <div className={styles.none}>
                  <span className={styles.noneMark}>—</span>
                </div>
              )}
              <div
                className={`${styles.optionName} ${isSelected ? styles.optionNameSelected : ''}`}
              >
                {isNoOuter(id) ? NO_OUTER_NAME : (item?.name ?? '—')}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
