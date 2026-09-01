/// <reference lib="webworker" />
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import type { Hex } from '~/domain/items';

type HexTriple = [Hex, Hex, Hex];

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

/**
 * The single-channel matte the model hands back, as raw floats plus a shape.
 * Hand-rolled because transformers.js does not type this model's output
 * usefully.
 */
interface MaskTensor {
  dims: number[];
  data: Float32Array;
}

/** Padding around the trimmed garment, as a fraction of the canvas. */
const PADDING = 0.12;

/**
 * The cut-out is stored in the browser as a data URL, so it has to stay small.
 * 640px is comfortably above the largest place it is displayed (420px on item
 * detail) at 1.5x.
 */
const MAX_SIDE = 640;

export type CutoutRequest = { image: ImageBitmap };

export type CutoutResponse =
  | { type: 'progress'; step: CutoutStep; ratio: number }
  | { type: 'done'; blob: Blob; palette: HexTriple }
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
    /*
     * .rgb() is load-bearing. The bitmap is handed over as a PNG, which carries
     * an alpha channel, and the model expects three. Feeding it four leaves the
     * silhouette roughly right but fills the background with noise.
     */
    const raw = (await RawImage.fromBlob(await bitmapToBlob(image))).rgb();
    const { pixel_values } = await processor(raw);

    // RMBG returns a named output, not a bare tensor. Fall back to the first
    // value so a renamed output in a future model revision does not break this.
    const result = (await model({ input: pixel_values })) as Record<string, MaskTensor>;
    const mask = result['output'] ?? Object.values(result)[0];
    if (!mask) throw new Error('The model returned no matte');

    const alpha = cleanMatte(alphaFromMask(mask, image.width, image.height), image.width, image.height);

    post({ type: 'progress', step: 'matte', ratio: 1 });

    // --- Composite ---------------------------------------------------------
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2d context');
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height);
    for (let p = 0; p < image.width * image.height; p += 1) {
      pixels.data[p * 4 + 3] = alpha[p] ?? 0;
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

    const blob = await trimmed.convertToBlob({ type: 'image/webp', quality: 0.9 });
    post({ type: 'done', blob, palette });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Background removal failed',
    });
  }
};

/**
 * Turn the model's matte into one alpha byte per pixel of the source image.
 *
 * The raw output is not in 0–1: it is an unnormalised saliency map, and the
 * reference post-processing min-max normalises it before use. Skipping that
 * and casting straight to uint8 both keeps background (small positive values
 * become visible alpha) and punches holes through the garment (values above 1
 * wrap when they are truncated) — which looks like a bad model but is bad
 * arithmetic.
 */
function alphaFromMask(mask: MaskTensor, width: number, height: number): Uint8ClampedArray {
  const maskWidth = mask.dims[mask.dims.length - 1] ?? width;
  const maskHeight = mask.dims[mask.dims.length - 2] ?? height;
  const values = mask.data;
  const count = maskWidth * maskHeight;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const value = values[i] ?? 0;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min || 1;

  // Draw the normalised matte at model resolution, then let the canvas scale it
  // to the source image with proper interpolation.
  const maskCanvas = new OffscreenCanvas(maskWidth, maskHeight);
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) throw new Error('No 2d context for the matte');

  const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
  for (let i = 0; i < count; i += 1) {
    const normalised = (((values[i] ?? 0) - min) / span) * 255;
    maskPixels.data[i * 4] = normalised;
    maskPixels.data[i * 4 + 1] = normalised;
    maskPixels.data[i * 4 + 2] = normalised;
    maskPixels.data[i * 4 + 3] = 255;
  }
  maskContext.putImageData(maskPixels, 0, 0);

  const scaled = new OffscreenCanvas(width, height);
  const scaledContext = scaled.getContext('2d');
  if (!scaledContext) throw new Error('No 2d context for the scaled matte');
  scaledContext.drawImage(maskCanvas, 0, 0, width, height);

  const scaledPixels = scaledContext.getImageData(0, 0, width, height).data;
  const alpha = new Uint8ClampedArray(width * height);
  for (let p = 0; p < alpha.length; p += 1) alpha[p] = scaledPixels[p * 4] ?? 0;
  return alpha;
}

/** Alpha at or above this counts as garment when deciding what is connected. */
const SOLID = 128;

/**
 * Clean a soft matte into a usable one.
 *
 * The model returns a saliency map, not a decision: the garment comes back
 * crisp, but the background carries speckle and the garment carries pinholes.
 * Using it raw is what leaves grey confetti around a cut-out.
 *
 * So: take the largest connected solid region as the garment, drop every other
 * island, and fill any enclosed gap. Edge softness is preserved by keeping the
 * original alpha wherever the garment survives — only whole regions are
 * decided here, never individual edge pixels.
 */
function cleanMatte(alpha: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const count = width * height;
  const label = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);

  let bestLabel = -1;
  let bestSize = 0;
  let next = 0;

  // Label every solid region, remembering the biggest — that is the garment.
  for (let start = 0; start < count; start += 1) {
    if (label[start] !== -1 || (alpha[start] ?? 0) < SOLID) continue;

    const current = next;
    next += 1;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    label[start] = current;
    let size = 0;

    while (head < tail) {
      const pixel = queue[head] ?? 0;
      head += 1;
      size += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;

      for (let d = 0; d < 4; d += 1) {
        const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
        const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbour = ny * width + nx;
        if (label[neighbour] !== -1 || (alpha[neighbour] ?? 0) < SOLID) continue;
        label[neighbour] = current;
        queue[tail] = neighbour;
        tail += 1;
      }
    }

    if (size > bestSize) {
      bestSize = size;
      bestLabel = current;
    }
  }

  if (bestLabel === -1) return alpha; // nothing solid found; leave it alone

  // Flood the background inward from the border. Anything transparent that the
  // flood never reaches is an enclosed gap in the garment, so fill it.
  const outside = new Uint8Array(count);
  let head = 0;
  let tail = 0;
  const pushIfBackground = (pixel: number) => {
    if (outside[pixel] === 1) return;
    if (label[pixel] === bestLabel) return;
    outside[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x);
    pushIfBackground((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(y * width);
    pushIfBackground(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head] ?? 0;
    head += 1;
    const x = pixel % width;
    const y = (pixel - x) / width;
    for (let d = 0; d < 4; d += 1) {
      const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
      const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      pushIfBackground(ny * width + nx);
    }
  }

  const kept = (pixel: number) => label[pixel] === bestLabel || outside[pixel] === 0;

  const cleaned = new Uint8ClampedArray(count);
  for (let p = 0; p < count; p += 1) {
    if (!kept(p)) {
      cleaned[p] = 0;
      continue;
    }

    /*
     * Inside the garment, go fully opaque. Partial alpha in the interior is
     * what speckles a cut-out with pinholes of background. Only pixels that
     * actually touch the background keep their soft value, which is where
     * antialiasing belongs.
     */
    const x = p % width;
    const y = (p - x) / width;
    let onEdge = false;
    for (let d = 0; d < 4 && !onEdge; d += 1) {
      const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
      const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!kept(ny * width + nx)) onEdge = true;
    }

    cleaned[p] = onEdge ? (alpha[p] ?? 0) : 255;
  }
  return cleaned;
}

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
  const longestEdge = Math.max(width, height);
  const canvasSide = Math.round(longestEdge / (1 - PADDING * 2));

  const side = Math.min(canvasSide, MAX_SIDE);
  const scale = side / canvasSide;

  const output = new OffscreenCanvas(side, side);
  const context = output.getContext('2d');
  if (!context) return output;

  const drawWidth = Math.round(width * scale);
  const drawHeight = Math.round(height * scale);

  context.drawImage(
    source,
    box.left,
    box.top,
    width,
    height,
    Math.round((side - drawWidth) / 2),
    Math.round((side - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );
  return output;
}

/**
 * Three dominant colours from the garment itself, ignoring everything the
 * matte cut away. Coarse bucketing is enough: this feeds three 22px swatches,
 * not a colour-science pipeline.
 */
function dominantColours(data: Uint8ClampedArray): HexTriple {
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

function toHex(r: number, g: number, b: number): Hex {
  const channel = (value: number) =>
    Math.round(value).toString(16).padStart(2, '0').slice(0, 2);
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
