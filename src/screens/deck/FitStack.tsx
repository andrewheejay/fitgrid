import { GarmentImage } from '~/components/GarmentImage';
import type { DeckState } from '~/domain/deck';
import { deckMetaLine, type Item, type ItemId } from '~/domain/items';
import { LAYERS, layerName } from '~/domain/layers';
import { isNoOuter, NO_OUTER_META, NO_OUTER_NAME } from '~/domain/outfits';
import styles from './FitStack.module.css';

interface FitStackProps {
  state: DeckState;
  selected: Record<string, ItemId | undefined>;
  itemsById: Map<ItemId, Item>;
}

/** The fit under construction: one row per layer, in LAYERS order. */
export function FitStack({ state, selected, itemsById }: FitStackProps) {
  return (
    <div className={styles.stack}>
      {LAYERS.map((layer, index) => {
        const id = selected[layer];
        const item = id ? itemsById.get(id) : undefined;
        const skipped = layer === 'outer' && isNoOuter(id);
        const locked = state.locked[layer];

        return (
          <div
            key={layer}
            className={`${styles.row} ${state.activeLayer === index ? styles.rowActive : ''}`}
          >
            {item ? (
              <GarmentImage item={item} size={60} />
            ) : (
              <div className={styles.blank} aria-hidden="true" />
            )}

            <div className={styles.body}>
              <div className={styles.layer}>{layerName(layer)}</div>
              <div className={styles.name}>{skipped ? NO_OUTER_NAME : (item?.name ?? '—')}</div>
              <div className={styles.meta}>
                {skipped ? NO_OUTER_META : item ? deckMetaLine(item) : '—'}
              </div>
            </div>

            <span className={`${styles.pill} ${locked ? styles.locked : styles.open}`}>
              {locked ? 'Locked' : 'Open'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
