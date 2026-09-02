import type { CSSProperties, ReactNode } from 'react';
import styles from './SpecTable.module.css';

export interface SpecRow {
  key: string;
  value: ReactNode;
}

interface SpecTableProps {
  rows: SpecRow[];
  /** Key column width: 110px on item detail, 96px in the ingest result card. */
  keyWidth?: number;
  gap?: number;
  padding?: string;
}

/**
 * The key/value table used on item detail and in the ingest result card. Keys
 * are what the system knows (mono, uppercase); values may be human-named (sans).
 */
export function SpecTable({ rows, keyWidth = 110, gap = 16, padding = '11px 0' }: SpecTableProps) {
  return (
    <dl className={styles.table}>
      {rows.map((row) => (
        <div
          key={row.key}
          className={styles.row}
          /*
           * All three measurements travel as custom properties, not as the
           * declarations themselves: an inline style outranks every stylesheet,
           * so anything set literally here is unreachable from a media query.
           * Each one has to move on a phone — the key column narrows, the gutter
           * closes, and the row grows to hold a 44px touch target — so none of
           * them can be written inline.
           */
          style={
            {
              '--key-w': `${keyWidth}px`,
              '--row-gap': `${gap}px`,
              '--row-pad': padding,
            } as CSSProperties & Record<'--key-w' | '--row-gap' | '--row-pad', string>
          }
        >
          <dt className={styles.key}>{row.key}</dt>
          <dd className={styles.value} style={{ margin: 0 }}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
