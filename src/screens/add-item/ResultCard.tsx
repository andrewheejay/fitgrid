import type { ReactNode } from 'react';
import { SpecTable, type SpecRow } from '~/components/SpecTable';
import styles from './ResultCard.module.css';

interface ResultCardProps {
  brand: string;
  name: ReactNode;
  pill: string;
  pillTone: 'match' | 'cutout';
  rows: SpecRow[];
  tags: string[];
  children?: ReactNode;
  actions: ReactNode;
}

/** The success card both ingest paths end on. */
export function ResultCard({
  brand,
  name,
  pill,
  pillTone,
  rows,
  tags,
  children,
  actions,
}: ResultCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <div className={styles.brand}>{brand}</div>
          <div className={styles.name}>{name}</div>
        </div>
        <span
          className={`${styles.pill} ${pillTone === 'match' ? styles.pillMatch : styles.pillCutout}`}
        >
          {pill}
        </span>
      </div>

      <div className={styles.table}>
        <SpecTable rows={rows} keyWidth={96} gap={14} padding="8px 0" />
      </div>

      <div className={styles.tags}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag.startsWith('#') ? (
              <span className={styles.swatch} style={{ background: tag }} aria-hidden="true" />
            ) : null}
            {tag}
          </span>
        ))}
      </div>

      {children}

      <div className={styles.actions}>{actions}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  sans?: boolean;
}

export function Field({ label, value, onChange, placeholder, wide, sans }: FieldProps) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <span className={styles.label}>{label}</span>
      <input
        className={`${styles.input} ${sans ? styles.inputName : ''}`}
        value={value}
        placeholder={placeholder ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Fields({ children }: { children: ReactNode }) {
  return <div className={styles.fields}>{children}</div>;
}

interface SelectProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <select
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
