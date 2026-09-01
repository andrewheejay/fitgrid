import styles from './Chip.module.css';

interface ChipProps {
  label: string;
  /** Derived counts only — never a stored number. */
  count?: number;
  selected: boolean;
  onClick: () => void;
}

export function Chip({ label, count, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </button>
  );
}

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Tab({ label, active, onClick }: TabProps) {
  return (
    <button
      type="button"
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
