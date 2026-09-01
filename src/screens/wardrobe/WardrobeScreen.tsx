import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '~/components/Button';
import { Chip } from '~/components/Chip';
import { GarmentImage } from '~/components/GarmentImage';
import { gridMetaLine } from '~/domain/items';
import { layerName } from '~/domain/layers';
import {
  filterChips,
  SORTS,
  visibleItems,
  wardrobeSubtitle,
  type WardrobeFilter,
  type WardrobeSort,
} from '~/domain/wardrobe';
import { useWardrobe } from '~/store/wardrobeStore';
import { EmptyWardrobe } from './EmptyWardrobe';
import styles from './WardrobeScreen.module.css';

export function WardrobeScreen() {
  const items = useWardrobe((state) => state.items);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<WardrobeFilter>('all');
  const [sort, setSort] = useState<WardrobeSort>('recent');

  /*
   * The empty state is checked against the merged wardrobe, never against
   * whether this browser has stored anything. A first-time visitor has empty
   * storage and a full closet — the seed is in the bundle.
   */
  if (items.length === 0) return <EmptyWardrobe />;

  const visible = visibleItems(items, filter, sort);

  return (
    <main>
      <div className={styles.headerBlock}>
        <div>
          <h1 className={styles.title}>Wardrobe</h1>
          <p className={styles.subtitle}>{wardrobeSubtitle(items.length)}</p>
        </div>
        <Link to="/add">
          <Button>+ Add item</Button>
        </Link>
      </div>

      <div className={styles.rail}>
        <div className={styles.chips}>
          {filterChips(items).map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              count={chip.count}
              selected={filter === chip.id}
              onClick={() => setFilter(chip.id)}
            />
          ))}
        </div>
        <div className={styles.chips}>
          {SORTS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={sort === option.id}
              onClick={() => setSort(option.id)}
            />
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.cell}
            onClick={() => navigate({ to: '/wardrobe/$itemId', params: { itemId: item.id } })}
          >
            <GarmentImage item={item} height={148} />
            <div className={styles.cellHead}>
              <span className={styles.name}>{item.name}</span>
              <span className={styles.category}>{layerName(item.category)}</span>
            </div>
            <span className={styles.meta}>{gridMetaLine(item)}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
