import { useNavigate } from '@tanstack/react-router';
import { Button } from '~/components/Button';
import { Editable } from '~/components/Editable';
import { GarmentImage } from '~/components/GarmentImage';
import type { Item, ItemId } from '~/domain/items';
import { formatShortDate } from '~/domain/date';
import { layersOf, type Outfit } from '~/domain/outfits';
import { useItemsById, useWardrobe } from '~/store/wardrobeStore';
import styles from './FitsScreen.module.css';

export function FitsScreen() {
  const outfits = useWardrobe((state) => state.outfits);
  const renameOutfit = useWardrobe((state) => state.renameOutfit);
  const navigate = useNavigate();
  const itemsById = useItemsById();

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
              onRename={(name) => renameOutfit(outfit.id, name)}
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
  onRename: (name: string) => void;
}

/**
 * The cell is a container with one button in it rather than one button
 * containing everything. The stack of garments opens the fit; the name below
 * it is edited in place, and a text field nested inside a button is neither
 * valid HTML nor operable — every click on it would reopen the deck.
 */
function FitCell({ outfit, itemsById, onOpen, onRename }: FitCellProps) {
  return (
    <div className={styles.cell}>
      <button type="button" className={styles.open} onClick={onOpen}>
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
      </button>
      <div className={styles.foot}>
        <span className={styles.name}>
          <Editable value={outfit.name} onCommit={onRename} label="Fit name" variant="inline" />
        </span>
        <span className={styles.date}>{formatShortDate(outfit.date)}</span>
      </div>
    </div>
  );
}
