import { CATALOGUE_STEPS, CUTOUT_STEPS, LINK_STEPS, type PipelineStep } from './steps';

export type SourceId = 'label' | 'link' | 'receipt' | 'image';

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
  /** Whether this path does real work or demonstrates the intended flow. */
  real: boolean;
}

export const SOURCES: readonly Source[] = [
  {
    id: 'label',
    tab: 'Scan care label',
    placeholder: 'Point camera at the sewn-in label',
    hint: 'The label carries brand, style code and fibre content. Best hit rate of the three.',
    idleCaption: ['Hold the label flat', 'inside the frame'],
    busyCaption: 'Reading the care label',
    credit: 'Studio image supplied by the brand — never your camera.',
    button: 'Look up',
    busyButton: 'Matching…',
    steps: CATALOGUE_STEPS,
    real: false,
  },
  {
    id: 'link',
    tab: 'Paste link',
    placeholder: 'nike.com/… or pacsun.com/…',
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
    real: true,
  },
  {
    id: 'receipt',
    tab: 'Order email',
    placeholder: 'forward to closet@fitgrid.xyz',
    hint: 'Forward a confirmation and every item in the order is filed at once.',
    idleCaption: ['Nothing forwarded', 'yet'],
    busyCaption: 'Reading the order email',
    credit: 'One email can add a whole order in a single pass.',
    button: 'Look up',
    busyButton: 'Matching…',
    steps: CATALOGUE_STEPS,
    real: false,
  },
  {
    id: 'image',
    tab: 'Drop an image',
    placeholder: 'drop a file, or paste an image URL',
    hint: 'Found it on Pinterest or a lookbook? Drop the image and Fitgrid cuts the background out.',
    idleCaption: ['Drop an image,', 'or paste its URL'],
    busyCaption: 'Removing background',
    credit: 'Background removed in your browser. Nothing was uploaded anywhere.',
    button: 'Cut out',
    busyButton: 'Cutting…',
    steps: CUTOUT_STEPS,
    real: true,
  },
];

export function sourceById(id: SourceId): Source {
  const source = SOURCES.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source ${id}`);
  return source;
}
