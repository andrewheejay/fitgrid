import type { ItemSource } from '~/domain/items';
import { CUTOUT_STEPS, LINK_STEPS, type PipelineStep } from './steps';

/**
 * The same two the domain records on an item, and deliberately the same type:
 * a tab the visitor picked is what gets stored as where the garment came from,
 * so a third tab cannot be added without the domain hearing about it.
 */
export type SourceId = ItemSource;

export interface Source {
  id: SourceId;
  tab: string;
  placeholder: string;
  hint: string;
  /** Two lines, split on the slash in the handoff's caption. */
  idleCaption: [string, string];
  /** What the frame says while the pipeline runs. */
  busyCaption: string;
  credit: string;
  button: string;
  busyButton: string;
  /** The four rows of the pipeline column for this path. */
  steps: readonly PipelineStep[];
}

/**
 * Both paths do real work. The care-label scan and the order-email parse are
 * gone: each needed commercial product data or a per-brand parser set, so both
 * returned one fixed example, and a tab that always answers the same thing is
 * a screenshot with a button on it.
 */
export const SOURCES: readonly Source[] = [
  {
    id: 'link',
    tab: 'Paste link',
    placeholder: 'nike.com/… or another product page',
    hint:
      'Fitgrid reads the listing, not the photo: the page’s own product metadata, then ' +
      'its studio image, cut out in your browser. Retailers that block automated readers ' +
      'send you to the image drop instead.',
    idleCaption: ['Waiting for a', 'product URL'],
    busyCaption: 'Reading the listing',
    credit: 'Studio image pulled from the listing, background removed in your browser.',
    button: 'Read listing',
    busyButton: 'Reading…',
    steps: LINK_STEPS,
  },
  {
    id: 'image',
    tab: 'Drop an image',
    placeholder: 'paste an image URL, or choose a file',
    hint:
      'Found it on Pinterest or a lookbook? Choose a file, drop one anywhere on this ' +
      'screen, or paste its URL — the background comes off in your browser.',
    // Not "click": the frame is a tap target too, and on a phone it is the
    // only one of the three routes the caption can honestly offer.
    idleCaption: ['Drop an image here,', 'or choose a file'],
    busyCaption: 'Removing background',
    credit: 'Background removed in your browser. Nothing was uploaded anywhere.',
    button: 'Cut out',
    busyButton: 'Cutting…',
    steps: CUTOUT_STEPS,
  },
];

export function sourceById(id: SourceId): Source {
  const source = SOURCES.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source ${id}`);
  return source;
}
