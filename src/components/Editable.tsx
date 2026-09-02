import { useLayoutEffect, useRef, useState } from 'react';
import styles from './Editable.module.css';

/**
 * Text you can correct in place by double-clicking it.
 *
 * The element you edit is the element you were reading — made editable, not
 * replaced. An <input> cannot do this: it is a single-line box, so a title
 * that wraps over two lines collapses into one scrolling strip the moment you
 * touch it, and the text moves out from under the cursor that was pointing at
 * it. Editing here changes nothing you can see except the caret: same font,
 * same wrapping, same position, down to the pixel.
 *
 * Enter and blur commit; Escape reverts. Both keys matter: the pointer path is
 * double-click and click away, and the keyboard path is Enter to open, Enter to
 * close, which is why the read view is focusable at all.
 */
interface EditableProps {
  /** The text put into the field. */
  value: string;
  /**
   * What the read view shows, if that is not simply the value. A string rather
   * than a node because `commit` has to be able to put it back by hand.
   */
  display?: string;
  onCommit: (next: string) => void;
  /** Names the field for screen readers, which cannot see the key column. */
  label: string;
  /**
   * Whether clearing the field is a legal edit. False for the fields every
   * garment must have — there emptying is a slip, and reverting is kinder than
   * storing a blank name.
   */
  allowEmpty?: boolean;
  /** `title` is the 26px item name, `body` the spec table, `inline` a field
   * sitting inside a line of other text. */
  variant?: Variant;
}

type Variant = 'body' | 'title' | 'inline';

/** `inline` deliberately adds no class: the base rule already inherits. */
const variantClass = (variant: Variant) => (variant === 'inline' ? '' : styles[variant]);

/** Stands in for a field the item has no value for, and is a target to fill. */
const BLANK = '—';

export function Editable({
  value,
  display,
  onCommit,
  label,
  allowEmpty = false,
  variant = 'body',
}: EditableProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);
  // Where the double-click landed, so the caret can be put exactly there
  // rather than at one end of the text. Null when opened from the keyboard.
  const from = useRef<{ x: number; y: number } | null>(null);
  // Escape unmounts nothing — the element stays — so the blur it causes would
  // otherwise commit the very text Escape was pressed to discard.
  const cancelled = useRef(false);

  const open = (point: { x: number; y: number } | null) => {
    from.current = point;
    cancelled.current = false;
    setEditing(true);
  };

  useLayoutEffect(() => {
    const node = ref.current;
    if (!editing || !node) return;
    node.focus();
    placeCaret(node, from.current);
  }, [editing]);

  // What the element reads as when it is not being edited.
  const readText = value ? (display ?? value) : BLANK;

  const commit = () => {
    const node = ref.current;
    setEditing(false);
    if (!node) return;

    // Whitespace is never meaningful here, and a paste out of a shop's page
    // routinely carries a newline or a run of spaces with it.
    const typed = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const keep = !cancelled.current && (typed || allowEmpty) ? typed : value;

    if (keep === value) {
      /*
       * Put the text back by hand. React will not do it: the child it rendered
       * while editing and the child it renders now are the same string, so the
       * diff is empty and it touches nothing — leaving whatever was typed on
       * screen after an Escape, showing text that is not in the store.
       */
      node.textContent = readText;
      return;
    }
    // A real edit changes `value`, so React does repaint this element, and
    // repaints it from the store rather than from what is under the caret.
    onCommit(keep);
  };

  return (
    <span
      ref={ref}
      className={[
        styles.field,
        variantClass(variant),
        editing ? styles.editing : '',
        // Faint ink says "nothing here yet". Once the caret is in it, it is a
        // field being typed into like any other.
        !editing && !value ? styles.blank : '',
      ]
        .filter(Boolean)
        .join(' ')}
      contentEditable={editing ? 'plaintext-only' : false}
      suppressContentEditableWarning
      /* Brands, style codes and colourways are not dictionary words; every one
         of them would carry a red underline through the middle of the page. */
      spellCheck={false}
      role={editing ? 'textbox' : 'button'}
      aria-label={label}
      tabIndex={0}
      {...(editing ? {} : { title: 'Double-click to edit' })}
      onDoubleClick={(event) => open({ x: event.clientX, y: event.clientY })}
      onKeyDown={(event) => {
        if (!editing && (event.key === 'Enter' || event.key === 'F2')) {
          event.preventDefault();
          open(null);
          return;
        }
        if (!editing) return;
        if (event.key === 'Enter') {
          // A name is one line. Enter finishes it rather than growing it.
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => {
        /*
         * plaintext-only already strips markup, but not line breaks, and these
         * values are routinely pasted out of a product page. Inserting it by
         * hand keeps the paste on one line and inside the undo stack.
         */
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, text);
      }}
      onBlur={commit}
    >
      {editing ? value : readText}
    </span>
  );
}

/**
 * Put the caret where the double-click was, the way a text editor does. Without
 * this the browser leaves the word it selected on the second click highlighted,
 * so the first keystroke silently replaces a word the visitor meant to correct
 * one letter of.
 */
function placeCaret(node: HTMLElement, point: { x: number; y: number } | null) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = point && node.textContent ? caretRangeAt(point) : null;
  const target = range ?? endOf(node);
  selection.removeAllRanges();
  selection.addRange(target);
}

function caretRangeAt({ x, y }: { x: number; y: number }): Range | null {
  // Two spellings of one feature: caretRangeFromPoint is the older WebKit and
  // Blink name, caretPositionFromPoint the standardised one Firefox ships.
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(x, y);
  }
  const position = document.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function endOf(node: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  return range;
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
        className={`${styles.field} ${styles.select} ${variantClass(variant)}`}
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
      className={`${styles.field} ${variantClass(variant)}`}
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
