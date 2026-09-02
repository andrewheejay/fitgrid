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
           * The key column travels as a custom property, not as
           * grid-template-columns: an inline declaration outranks every
           * stylesheet, and a 110px key column beside a phone's remaining
           * ~250px wraps the composition line on every row. A property the
           * media query can override is the only way to keep both.
           */
          style={
            {
              '--key-w': `${keyWidth}px`,
              gap,
              padding,
            } as CSSProperties & Record<'--key-w', string>
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
