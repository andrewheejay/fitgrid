import type { ReactNode } from 'react';
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
          style={{ gridTemplateColumns: `${keyWidth}px 1fr`, gap, padding }}
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
