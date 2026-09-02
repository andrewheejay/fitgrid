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
  /*
   * The height travels as a custom property rather than as `height` itself.
   * An inline style beats every stylesheet rule, so a literal height here would
   * be unreachable from a media query — and the wardrobe's 148px cells have to
   * become square at phone width. A property can be overridden; a declaration
   * cannot. `size` stays literal: a 26px fit row is 26px on any screen.
   */
  const style: CSSProperties & Record<'--tone' | '--frame-h', string> = {
    // 22 is the hex alpha the handoff specifies for the stripe.
    '--tone': `${item.tone}22`,
    '--frame-h': height === undefined ? 'auto' : `${height}px`,
    ...(size !== undefined ? { width: size, height: size } : {}),
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
