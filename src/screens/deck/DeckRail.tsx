import { GarmentImage } from '~/components/GarmentImage';
import type { Item, ItemId } from '~/domain/items';
import { layerName, type Layer } from '~/domain/layers';
import { isNoOuter, NO_OUTER_NAME } from '~/domain/outfits';
import { railWindow } from '~/domain/rail';
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
  const visibleIndices = railWindow(pool.length, selected);

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

      <div className={styles.strip}>
        {visibleIndices.map((index) => {
          const id = pool[index];
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
