import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '~/components/Button';
import { GarmentImage } from '~/components/GarmentImage';
import { SpecTable } from '~/components/SpecTable';
import { formatAddedAt } from '~/domain/items';
import { layerName } from '~/domain/layers';
import { useItem, useWardrobe } from '~/store/wardrobeStore';
import styles from './ItemDetailScreen.module.css';

export function ItemDetailScreen() {
  const { itemId } = useParams({ from: '/wardrobe/$itemId' });
  const item = useItem(itemId);
  const removeItem = useWardrobe((state) => state.removeItem);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  if (!item) {
    return (
      <main className={styles.missing}>
        <p>That item is no longer in the wardrobe.</p>
        <p style={{ marginTop: 12 }}>
          <Link to="/wardrobe">← Wardrobe</Link>
        </p>
      </main>
    );
  }

  return (
    <main className={styles.layout}>
      <div className={styles.left}>
        <div className={styles.image}>
          <GarmentImage item={item} height={420} />
        </div>
      </div>

      <div className={styles.right}>
        <Link to="/wardrobe" className={styles.back}>
          ← Wardrobe
        </Link>

        <h1 className={styles.title}>{item.name}</h1>
        <p className={styles.subtitle}>
          {layerName(item.category)} · added {formatAddedAt(item.addedAt)}
        </p>

        <div className={styles.table}>
          <SpecTable
            rows={[
              { key: 'Silhouette', value: item.silhouette },
              { key: 'Texture', value: item.texture },
              { key: 'Aesthetic', value: item.aesthetic },
              {
                key: 'Worn',
                value: `${item.wornCount} time${item.wornCount === 1 ? '' : 's'}`,
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
                  navigate({ to: '/wardrobe' });
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
