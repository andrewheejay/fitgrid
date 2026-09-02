import { GarmentImage } from '~/components/GarmentImage';
import type { DeckState } from '~/domain/deck';
import { deckMetaLine, type Item, type ItemId } from '~/domain/items';
import { LAYERS, layerName, type Layer } from '~/domain/layers';
import { isNoOuter, NO_OUTER_META, NO_OUTER_NAME } from '~/domain/outfits';
import { useCoarsePointer } from '~/hooks/useCoarsePointer';
import { useTapOrDoubleTap } from '~/hooks/useTapOrDoubleTap';
import styles from './FitStack.module.css';

interface FitStackProps {
  state: DeckState;
  selected: Record<string, ItemId | undefined>;
  itemsById: Map<ItemId, Item>;
  onReroll: (layer: Layer) => void;
  onToggleLock: (layer: Layer) => void;
}

/** The fit under construction: one row per layer, in LAYERS order. */
export function FitStack({ state, selected, itemsById, onReroll, onToggleLock }: FitStackProps) {
  /*
   * The deck's controls are the arrow keys and the rails, both of which a phone
   * has neither of. Under a finger the fit itself becomes the control: the row
   * you want changed is the thing you touch.
   */
  const coarse = useCoarsePointer();

  return (
    <div className={styles.stack}>
      {LAYERS.map((layer, index) => {
        const id = selected[layer];
        return (
          <FitRow
            key={layer}
            layer={layer}
            item={id ? itemsById.get(id) : undefined}
            skipped={layer === 'outer' && isNoOuter(id)}
            locked={state.locked[layer]}
            active={state.activeLayer === index}
            coarse={coarse}
            onReroll={() => onReroll(layer)}
            onToggleLock={() => onToggleLock(layer)}
          />
        );
      })}
    </div>
  );
}

interface FitRowProps {
  layer: Layer;
  item: Item | undefined;
  skipped: boolean;
  locked: boolean;
  active: boolean;
  coarse: boolean;
  onReroll: () => void;
  onToggleLock: () => void;
}

/**
 * One layer of the fit. Its own component rather than a loop body because the
 * gesture handler is a hook, and a hook inside a map is a hook whose identity
 * depends on the shape of the list.
 */
function FitRow({
  layer,
  item,
  skipped,
  locked,
  active,
  coarse,
  onReroll,
  onToggleLock,
}: FitRowProps) {
  const gesture = useTapOrDoubleTap(onReroll, onToggleLock);

  const name = skipped ? NO_OUTER_NAME : (item?.name ?? '—');
  const content = (
    <>
      {item ? (
        <GarmentImage item={item} size={60} />
      ) : (
        <div className={styles.blank} aria-hidden="true" />
      )}

      <div className={styles.body}>
        <div className={styles.layer}>{layerName(layer)}</div>
        <div className={styles.name}>{name}</div>
        <div className={styles.meta}>
          {skipped ? NO_OUTER_META : item ? deckMetaLine(item) : '—'}
        </div>
      </div>
    </>
  );

  return (
    <div className={`${styles.row} ${active ? styles.rowActive : ''}`}>
      {coarse ? (
        <button
          type="button"
          className={styles.tap}
          /*
           * The visible text is the garment; the gesture is not written
           * anywhere a screen reader would reach, so the name carries it. The
           * lock control beside this one is the accessible path to locking:
           * a double-tap means "activate" to VoiceOver, so it can only ever
           * reach the reroll here.
           */
          aria-label={`${layerName(layer)} — ${name}. Tap to reroll, double-tap to lock.`}
          onClick={gesture.onClick}
        >
          {content}
        </button>
      ) : (
        content
      )}

      {coarse ? (
        <button
          type="button"
          className={`${styles.pill} ${styles.pillButton} ${locked ? styles.locked : styles.open}`}
          onClick={onToggleLock}
          aria-pressed={locked}
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${layerName(layer).toLowerCase()}`}
        >
          {locked ? 'Locked' : 'Open'}
        </button>
      ) : (
        <span className={`${styles.pill} ${locked ? styles.locked : styles.open}`}>
          {locked ? 'Locked' : 'Open'}
        </span>
      )}
    </div>
  );
}
