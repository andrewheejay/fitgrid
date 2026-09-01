import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './ResetDialog.module.css';

interface ResetDialogProps {
  open: boolean;
  addedCount: number;
  savedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reset is destructive and a visitor may have spent ten minutes building fits,
 * so it confirms first. Styled on the no-match card's red hairline treatment,
 * which gives that pattern a second use rather than inventing a new one.
 *
 * A native <dialog> is used deliberately: it brings the focus trap, the Escape
 * key and inertness of the page behind it without hand-rolling any of them.
 */
export function ResetDialog({
  open,
  addedCount,
  savedCount,
  onConfirm,
  onCancel,
}: ResetDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      aria-labelledby="reset-label"
    >
      <p id="reset-label" className={styles.label}>
        Reset this demo
      </p>
      <p className={styles.body}>{describe(addedCount, savedCount)}</p>
      <div className={styles.actions}>
        <Button variant="danger" onClick={onConfirm}>
          Reset everything
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Keep it
        </Button>
      </div>
    </dialog>
  );
}

function describe(addedCount: number, savedCount: number): string {
  const changes: string[] = [];
  if (addedCount > 0) changes.push(`${addedCount} item${addedCount === 1 ? '' : 's'} you added`);
  if (savedCount > 0) changes.push(`${savedCount} fit${savedCount === 1 ? '' : 's'} you saved`);

  if (changes.length === 0) {
    return 'Nothing is stored in this browser yet — resetting will not change what you see.';
  }
  return `This clears ${changes.join(' and ')}, and restores the wardrobe to how it started. It only affects this browser.`;
}
