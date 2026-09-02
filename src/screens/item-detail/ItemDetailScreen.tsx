import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '~/components/Button';
import { Editable, EditableChoice } from '~/components/Editable';
import { GarmentImage } from '~/components/GarmentImage';
import { SpecTable, type SpecRow } from '~/components/SpecTable';
import { formatShortDate } from '~/domain/date';
import { AESTHETICS, type Aesthetic, type ItemPatch } from '~/domain/items';
import { LAYERS, layerName, type Category } from '~/domain/layers';
import { useItem, useWardrobe } from '~/store/wardrobeStore';
import styles from './ItemDetailScreen.module.css';

/**
 * The catalogue facts, in order. Every one is rendered whether or not the item
 * has it: this screen is editable, so an absent field is not a claim about the
 * garment but an invitation to fill it in, and it says so with an em dash. (It
 * is only item detail that does this. The wardrobe grid and the ingest result
 * card still show a fact or nothing at all, because neither can be corrected
 * in place.)
 */
/**
 * The patch fields that hold free text.
 *
 * Derived from `ItemPatch` rather than listed by hand. `textRow` builds its
 * patch with a computed key — `{ [field]: next }` — and TypeScript checks that
 * against a string index signature, not against the specific key, so a numeric
 * or enumerated field slipping into this union would compile and then store a
 * string where the domain expects a number. Deriving it makes that unspellable.
 */
type TextField = {
  [K in keyof ItemPatch]-?: string extends ItemPatch[K] ? K : never;
}[keyof ItemPatch];

const CATALOGUE: ReadonlyArray<{ key: string; field: TextField }> = [
  { key: 'Brand', field: 'brand' },
  { key: 'Style code', field: 'styleCode' },
  { key: 'Colourway', field: 'colourway' },
  { key: 'Composition', field: 'composition' },
  { key: 'Retail', field: 'retail' },
];

export function ItemDetailScreen() {
  const { itemId } = useParams({ from: '/wardrobe/$itemId' });
  const item = useItem(itemId);
  const removeItem = useWardrobe((state) => state.removeItem);
  const editItem = useWardrobe((state) => state.editItem);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  if (!item) {
    return (
      <main className={styles.missing}>
        <p>That item is no longer in the wardrobe.</p>
        <p className={styles.missingBack}>
          <Link to="/">← Wardrobe</Link>
        </p>
      </main>
    );
  }

  const edit = (patch: ItemPatch) => editItem(item.id, patch);

  const textRow = (key: string, field: TextField): SpecRow => ({
    key,
    value: (
      <Editable
        value={String(item[field] ?? '')}
        onCommit={(next) => edit({ [field]: next })}
        label={key}
        // The three fields every garment has are the three that cannot be
        // emptied; the catalogue ones can be cleared back to unknown.
        allowEmpty={field !== 'name' && field !== 'silhouette' && field !== 'texture'}
      />
    ),
  });

  return (
    <main className={styles.layout}>
      <div className={styles.left}>
        <div className={styles.image}>
          <GarmentImage item={item} height={420} />
        </div>
      </div>

      <div className={styles.right}>
        <Link to="/" className={styles.back}>
          ← Wardrobe
        </Link>

        <h1 className={styles.title}>
          <Editable
            value={item.name}
            onCommit={(name) => edit({ name })}
            label="Name"
            variant="title"
          />
        </h1>
        <p className={styles.subtitle}>
          <EditableChoice
            value={item.category}
            options={LAYERS.map((layer) => ({ value: layer, label: layerName(layer) }))}
            onCommit={(category: Category) => edit({ category })}
            label="Layer"
            variant="inline"
          />
          {` · added ${formatShortDate(item.addedAt)}`}
        </p>

        <div className={styles.table}>
          <SpecTable
            rows={[
              textRow('Silhouette', 'silhouette'),
              textRow('Texture', 'texture'),
              {
                key: 'Aesthetic',
                value: (
                  <EditableChoice
                    value={item.aesthetic}
                    options={AESTHETICS.map((option) => ({ value: option, label: option }))}
                    onCommit={(aesthetic: Aesthetic) => edit({ aesthetic })}
                    label="Aesthetic"
                  />
                ),
              },
              ...CATALOGUE.map(({ key, field }) => textRow(key, field)),
              {
                key: 'Worn',
                value: (
                  <Editable
                    value={String(item.wornCount)}
                    display={`${item.wornCount} time${item.wornCount === 1 ? '' : 's'}`}
                    // A count is the one field where typing anything is not
                    // the same as meaning it. Nonsense reverts rather than
                    // storing NaN, which would render as "NaN times" forever.
                    onCommit={(next) => {
                      const count = Number.parseInt(next, 10);
                      if (Number.isFinite(count) && count >= 0) edit({ wornCount: count });
                    }}
                    label="Times worn"
                  />
                ),
              },
              {
                key: 'Palette',
                value: (
                  <span className={styles.palette}>
                    {item.palette.map((hex) => (
                      <span
                        key={hex}
                        className={styles.swatch}
                        style={{ background: hex }}
                        title={hex}
                      />
                    ))}
                  </span>
                ),
              },
            ]}
          />
          <p className={styles.hint}>Double-click any field to correct it.</p>
        </div>

        <div className={styles.actions}>
          <Button
            onClick={() =>
              navigate({ to: '/deck', search: { lock: item.id } })
            }
          >
            Lock into a fit
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)} disabled={confirming}>
            Remove
          </Button>
        </div>

        {confirming ? (
          <div className={styles.confirm}>
            <p className={styles.confirmLabel}>Remove from wardrobe</p>
            <p className={styles.confirmBody}>
              {item.name} leaves the grid and any saved fit built on it stops being shown. You
              can bring it back by resetting the demo.
            </p>
            <div className={styles.confirmActions}>
              <Button
                variant="danger"
                onClick={() => {
                  removeItem(item.id);
                  navigate({ to: '/' });
                }}
              >
                Remove it
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
