import { useRef, useState, type ReactNode } from 'react';
import styles from './Editable.module.css';

/**
 * Text that becomes an input on double-click.
 *
 * The design is a document, not a form: fields are read far more often than
 * they are corrected, so the editing affordance stays out of the way until it
 * is wanted. Nothing shifts when it appears — the input inherits the type it
 * replaces and occupies the same box — because a detail screen that reflows
 * when you touch it reads as unstable.
 *
 * Enter and blur commit; Escape reverts. Both keys matter: the pointer path is
 * double-click and click away, and the keyboard path is Enter to open, Enter to
 * close, which is why the read view is focusable at all.
 */
interface EditableProps {
  /** The text put into the input. */
  value: string;
  /** What the read view shows, if that is not simply the value. */
  display?: ReactNode;
  onCommit: (next: string) => void;
  /** Names the field for screen readers, which cannot see the key column. */
  label: string;
  placeholder?: string;
  /**
   * Whether clearing the field is a legal edit. False for the fields every
   * garment must have — there emptying is a slip, and reverting is kinder than
   * storing a blank name.
   */
  allowEmpty?: boolean;
  /**
   * `title` is the 26px item name, `body` everything in the spec table, and
   * `inline` a field sitting inside a line of other text, which takes its type
   * and its width from whatever surrounds it.
   */
  variant?: Variant;
}

type Variant = 'body' | 'title' | 'inline';

/** `inline` deliberately adds no class: the base rule already inherits. */
const variantClass = (variant: Variant) => (variant === 'inline' ? '' : styles[variant]);

export function Editable({
  value,
  display,
  onCommit,
  label,
  placeholder,
  allowEmpty = false,
  variant = 'body',
}: EditableProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the input, which fires blur on the way out. Without this
  // the cancel would immediately be undone by the commit-on-blur below.
  const cancelled = useRef(false);

  const open = () => {
    window.getSelection()?.removeAllRanges();
    cancelled.current = false;
    setDraft(value);
  };

  const commit = () => {
    if (cancelled.current || draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === value) return;
    if (next || allowEmpty) onCommit(next);
  };

  if (draft !== null) {
    return (
      <input
        className={`${styles.input} ${variantClass(variant)}`}
        aria-label={label}
        value={draft}
        placeholder={placeholder ?? ''}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            cancelled.current = true;
            setDraft(null);
          }
        }}
      />
    );
  }

  return (
    <span
      className={`${styles.read} ${variantClass(variant)} ${value ? '' : styles.blank}`}
      role="button"
      tabIndex={0}
      title="Double-click to edit"
      onDoubleClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          open();
        }
      }}
    >
      {value ? (display ?? value) : '—'}
    </span>
  );
}

interface EditableChoiceProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onCommit: (next: T) => void;
  label: string;
  variant?: Variant;
}

/**
 * The same gesture for a field with a fixed set of answers. A garment's layer
 * and its aesthetic are closed sets in the type system, so free text would let
 * the UI write a value the domain does not have.
 */
export function EditableChoice<T extends string>({
  value,
  options,
  onCommit,
  label,
  variant = 'body',
}: EditableChoiceProps<T>) {
  const [editing, setEditing] = useState(false);
  // The ref callback below re-runs on any render while the list is open, and
  // reopening a list the visitor is already reading would close it under them.
  const opened = useRef(false);

  const open = () => {
    opened.current = false;
    setEditing(true);
  };

  if (editing) {
    return (
      <select
        className={`${styles.input} ${variantClass(variant)}`}
        aria-label={label}
        value={value}
        /*
         * Focus alone is not enough. A select that is merely focused still
         * needs a click to drop its list open, which would make one edit two
         * gestures. Opening it here spends the double-click's own user
         * activation, which is what showPicker requires; where it is missing
         * or refused the field is still focused and still arrow-key operable.
         */
        ref={(node) => {
          if (!node || opened.current) return;
          opened.current = true;
          node.focus();
          try {
            node.showPicker();
          } catch {
            // Older engine, or activation already consumed. Click still works.
          }
        }}
        onBlur={() => setEditing(false)}
        onChange={(event) => {
          onCommit(event.target.value as T);
          setEditing(false);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      className={`${styles.read} ${variantClass(variant)}`}
      role="button"
      tabIndex={0}
      title="Double-click to change"
      onDoubleClick={() => open()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          open();
        }
      }}
    >
      {options.find((option) => option.value === value)?.label ?? value}
    </span>
  );
}
