import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

export interface FileDrop {
  /** True while a file is over the target, for the frame's drag state. */
  over: boolean;
  /** Spread onto the element that accepts the drop. */
  handlers: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
}

/**
 * Accept one dragged file.
 *
 * Three things make the difference between a div that has an `onDrop` prop and
 * a target that actually catches what you throw at it, and all three are here
 * rather than in the screen:
 *
 * `dragover` must call preventDefault, or the browser treats the element as
 * refusing the drag and no `drop` event is ever fired — the single most common
 * reason a drop zone silently does nothing.
 *
 * `dragleave` fires every time the pointer crosses into a child element, so a
 * naive handler turns the highlight off while the file is still over the
 * target. Enters and leaves are counted instead, and the target is only left
 * when they balance.
 *
 * A file dropped just outside the target is opened by the browser, replacing
 * the page — and with it any run in progress and anything typed into the form.
 * Swallowing stray drags at the window turns a near miss into nothing at all.
 */
export function useFileDrop(onFile: (file: File) => void): FileDrop {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const swallow = (event: globalThis.DragEvent) => {
      if (carriesFiles(event.dataTransfer)) event.preventDefault();
    };
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);
    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  const leave = useCallback(() => {
    depth.current = 0;
    setOver(false);
  }, []);

  return {
    over,
    handlers: {
      onDragEnter: (event) => {
        if (!carriesFiles(event.dataTransfer)) return;
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event) => {
        if (!carriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (event) => {
        if (!carriesFiles(event.dataTransfer)) return;
        depth.current -= 1;
        if (depth.current <= 0) leave();
      },
      onDrop: (event) => {
        if (!carriesFiles(event.dataTransfer)) return;
        event.preventDefault();
        leave();
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      },
    },
  };
}

/**
 * Whether this drag is carrying files at all. Without it, dragging selected
 * text across the page lights the frame up and promises something the drop
 * cannot deliver.
 */
function carriesFiles(transfer: DataTransfer | null): boolean {
  return transfer !== null && Array.from(transfer.types).includes('Files');
}
