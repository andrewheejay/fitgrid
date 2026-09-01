import type { CutoutResponse, CutoutStep } from './worker/cutout.worker';

export interface CutoutResult {
  /** Object URL for the trimmed, centred cut-out. */
  url: string;
  palette: [string, string, string];
}

export interface CutoutProgress {
  step: CutoutStep;
  ratio: number;
}

/**
 * Drives the segmentation worker.
 *
 * The worker is created per run and terminated afterwards: the model download
 * dominates the cost and the browser caches it, so keeping a worker alive buys
 * little and leaks a thread if the visitor wanders off.
 */
export function runCutout(
  bitmap: ImageBitmap,
  onProgress: (progress: CutoutProgress) => void,
): Promise<CutoutResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker/cutout.worker.ts', import.meta.url), {
      type: 'module',
    });

    const finish = (action: () => void) => {
      worker.terminate();
      action();
    };

    worker.onmessage = (event: MessageEvent<CutoutResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress({ step: message.step, ratio: message.ratio });
        return;
      }
      if (message.type === 'error') {
        finish(() => reject(new Error(message.message)));
        return;
      }
      finish(() =>
        resolve({ url: URL.createObjectURL(message.blob), palette: message.palette }),
      );
    };

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || 'The cut-out worker failed to start')));
    };

    worker.postMessage({ image: bitmap }, [bitmap]);
  });
}

/**
 * Turn a file or a URL into an ImageBitmap.
 *
 * A cross-origin URL is best-effort by nature: an image served without
 * permissive CORS headers cannot be read back off a canvas, and that failure
 * belongs to the other site, not to us. It gets its own message so the visitor
 * knows dropping the file instead will work.
 */
export async function loadBitmap(input: File | string): Promise<ImageBitmap> {
  if (input instanceof File) {
    if (!input.type.startsWith('image/')) {
      throw new Error('That file is not an image.');
    }
    return createImageBitmap(input);
  }

  let response: Response;
  try {
    response = await fetch(input, { mode: 'cors' });
  } catch {
    throw new Error(
      'That image could not be read from its site. Save it and drop the file instead.',
    );
  }
  if (!response.ok) throw new Error(`That URL returned ${response.status}.`);

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('That URL is not an image.');
  return createImageBitmap(blob);
}
