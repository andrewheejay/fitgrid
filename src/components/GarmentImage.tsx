import type { CSSProperties } from 'react';
import type { Item } from '~/domain/items';
import styles from './GarmentImage.module.css';

interface GarmentImageProps {
  item: Pick<Item, 'name' | 'tone'> & { imageUrl?: string };
  /** Rendered height in px. Width is always the container. */
  height?: number;
  /** Fixed square, for the 60×60 preview rows and 26×26 fit rows. */
  size?: number;
}

/**
 * Every garment image in the system: a 1px frame around either the real
 * photograph, contained on white, or the diagonal-stripe placeholder tinted
 * with the item's dominant tone.
 */
export function GarmentImage({ item, height, size }: GarmentImageProps) {
  const style: CSSProperties & Record<'--tone', string> = {
    // 22 is the hex alpha the handoff specifies for the stripe.
    '--tone': `${item.tone}22`,
    ...(size !== undefined ? { width: size, height: size } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  return (
    <div
      className={`${styles.frame} ${item.imageUrl ? '' : styles.placeholder}`}
      style={style}
    >
      {item.imageUrl ? (
        <img className={styles.photo} src={item.imageUrl} alt={item.name} loading="lazy" />
      ) : null}
    </div>
  );
}
