/// <reference lib="webworker" />
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';

/**
 * Background removal, off the main thread.
 *
 * BRIA's RMBG-1.4 runs under transformers.js in the browser. The weights are
 * several megabytes, so the model is loaded on first use only — the visitor
 * pays for it when they choose to cut an image out, never on first paint.
 *
 * Licence note: RMBG-1.4 ships under BRIA's terms, which restrict commercial
 * use. This build is a non-commercial portfolio piece and attributes the model
 * in the UI; see docs/ for the recorded decision.
 */

const MODEL_ID = 'briaai/RMBG-1.4';

/** The shape of the single-channel matte the model hands back. */
type MaskTensor = Array<{ mul: (value: number) => { to: (dtype: string) => never } }>;

/** Padding around the trimmed garment, as a fraction of the canvas. */
const PADDING = 0.12;

export type CutoutRequest = { image: ImageBitmap };

export type CutoutResponse =
  | { type: 'progress'; step: CutoutStep; ratio: number }
  | { type: 'done'; blob: Blob; palette: [string, string, string] }
  | { type: 'error'; message: string };

export type CutoutStep = 'model' | 'matte' | 'trim' | 'palette';

let modelPromise: ReturnType<typeof loadModel> | null = null;

async function loadModel(onProgress: (ratio: number) => void) {
  let lastReported = 0;
  const progress_callback = (event: { status: string; progress?: number }) => {
    if (event.status !== 'progress' || event.progress === undefined) return;
    // transformers.js reports per-file; keep the bar monotonic.
    const ratio = event.progress / 100;
    if (ratio > lastReported) {
      lastReported = ratio;
      onProgress(ratio);
    }
  };

  const [model, processor] = await Promise.all([
    AutoModel.from_pretrained(MODEL_ID, { progress_callback }),
    AutoProcessor.from_pretrained(MODEL_ID, {}),
  ]);
  return { model, processor };
}

self.onmessage = async (event: MessageEvent<CutoutRequest>) => {
  const post = (message: CutoutResponse, transfer: Transferable[] = []) =>
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);

  try {
    const { image } = event.data;

    modelPromise ??= loadModel((ratio) => post({ type: 'progress', step: 'model', ratio }));
    const { model, processor } = await modelPromise;
    post({ type: 'progress', step: 'model', ratio: 1 });

    // --- Matte -------------------------------------------------------------
    post({ type: 'progress', step: 'matte', ratio: 0 });
    const raw = await RawImage.fromBlob(await bitmapToBlob(image));
    const { pixel_values } = await processor(raw);

    // RMBG returns a named output, not a bare tensor. Fall back to the first
    // value so a renamed output in a future model revision does not break this.
    const result = (await model({ input: pixel_values })) as Record<string, MaskTensor>;
    const mask = result['output'] ?? Object.values(result)[0];
    const channel = mask?.[0];
    if (!channel) throw new Error('The model returned no matte');

    const alphaMap = await RawImage.fromTensor(channel.mul(255).to('uint8')).resize(
      image.width,
      image.height,
    );
    post({ type: 'progress', step: 'matte', ratio: 1 });

    // --- Composite ---------------------------------------------------------
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2d context');
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height);
    for (let i = 0; i < alphaMap.data.length; i += 1) {
      pixels.data[i * 4 + 3] = alphaMap.data[i] ?? 0;
    }
    context.putImageData(pixels, 0, 0);

    // --- Trim and centre ---------------------------------------------------
    post({ type: 'progress', step: 'trim', ratio: 0 });
    const box = alphaBounds(pixels.data, image.width, image.height);
    const trimmed = centreOnSquare(canvas, box);
    post({ type: 'progress', step: 'trim', ratio: 1 });

    // --- Palette -----------------------------------------------------------
    post({ type: 'progress', step: 'palette', ratio: 0 });
    const palette = dominantColours(pixels.data);
    post({ type: 'progress', step: 'palette', ratio: 1 });

    const blob = await trimmed.convertToBlob({ type: 'image/png' });
    post({ type: 'done', blob, palette });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Background removal failed',
    });
  }
};

async function bitmapToBlob(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The tightest box containing every pixel the matte kept. */
function alphaBounds(data: Uint8ClampedArray, width: number, height: number): Box {
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) < 8) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  // A fully transparent matte means the model found nothing; keep the frame.
  if (left > right || top > bottom) return { left: 0, top: 0, right: width - 1, bottom: height - 1 };
  return { left, top, right, bottom };
}

/** Even padding on a square canvas — the "centred, 12% padding" the card claims. */
function centreOnSquare(source: OffscreenCanvas, box: Box): OffscreenCanvas {
  const width = box.right - box.left + 1;
  const height = box.bottom - box.top + 1;
  const side = Math.max(width, height);
  const canvasSide = Math.round(side / (1 - PADDING * 2));

  const output = new OffscreenCanvas(canvasSide, canvasSide);
  const context = output.getContext('2d');
  if (!context) return output;

  context.drawImage(
    source,
    box.left,
    box.top,
    width,
    height,
    Math.round((canvasSide - width) / 2),
    Math.round((canvasSide - height) / 2),
    width,
    height,
  );
  return output;
}

/**
 * Three dominant colours from the garment itself, ignoring everything the
 * matte cut away. Coarse bucketing is enough: this feeds three 22px swatches,
 * not a colour-science pipeline.
 */
function dominantColours(data: Uint8ClampedArray): [string, string, string] {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const top = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  const hex = top.map((bucket) =>
    toHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count),
  );

  return [hex[0] ?? '#8a8a8a', hex[1] ?? '#d4d4d4', hex[2] ?? '#3a3a3a'];
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.round(value).toString(16).padStart(2, '0').slice(0, 2);
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
