import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Button } from '~/components/Button';
import { GarmentImage } from '~/components/GarmentImage';
import type { Item, ItemId } from '~/domain/items';
import { formatShortDate } from '~/domain/date';
import { layersOf, type Outfit } from '~/domain/outfits';
import { useWardrobe } from '~/store/wardrobeStore';
import styles from './FitsScreen.module.css';

export function FitsScreen() {
  const outfits = useWardrobe((state) => state.outfits);
  const items = useWardrobe((state) => state.items);
  const navigate = useNavigate();
  const itemsById = useMemo(
    () => new Map<ItemId, Item>(items.map((item) => [item.id, item])),
    [items],
  );

  return (
    <main>
      <div className={styles.headerBlock}>
        <h1 className={styles.title}>Saved fits</h1>
        <p className={styles.subtitle}>
          {outfits.length} fit{outfits.length === 1 ? '' : 's'}
        </p>
      </div>

      {outfits.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyBody}>
            Nothing saved yet. Build a fit in the deck — lock the piece you are sure about,
            reroll the rest, and press Enter when it works.
          </p>
          <div className={styles.emptyActions}>
            <Button onClick={() => navigate({ to: '/deck' })}>Open the deck</Button>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {outfits.map((outfit) => (
            <FitCell
              key={outfit.id}
              outfit={outfit}
              itemsById={itemsById}
              onOpen={() => navigate({ to: '/deck', search: { lock: outfit.top } })}
            />
          ))}
        </div>
      )}
    </main>
  );
}

interface FitCellProps {
  outfit: Outfit;
  itemsById: Map<ItemId, Item>;
  onOpen: () => void;
}

function FitCell({ outfit, itemsById, onOpen }: FitCellProps) {
  return (
    <button type="button" className={styles.cell} onClick={onOpen}>
      <div className={styles.stack}>
        {layersOf(outfit).map(({ layer, itemId }) => {
          // A skipped outer layer draws no row: the fit simply has three pieces.
          const item = itemId ? itemsById.get(itemId) : undefined;
          if (!item) return null;
          return (
            <div key={layer} className={styles.row}>
              <GarmentImage item={item} size={26} />
              <span className={styles.rowName}>{item.name}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.foot}>
        <span className={styles.name}>{outfit.name}</span>
        <span className={styles.date}>{formatShortDate(outfit.date)}</span>
      </div>
    </button>
  );
}
