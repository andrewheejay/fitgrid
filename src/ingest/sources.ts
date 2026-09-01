export type SourceId = 'label' | 'link' | 'receipt' | 'image';

export interface Source {
  id: SourceId;
  tab: string;
  placeholder: string;
  hint: string;
  /** Two lines, split on the slash in the handoff's caption. */
  idleCaption: [string, string];
  credit: string;
  button: string;
  busyButton: string;
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
    credit: 'Studio image supplied by the brand — never your camera.',
    button: 'Look up',
    busyButton: 'Matching…',
    real: false,
  },
  {
    id: 'link',
    tab: 'Paste link',
    placeholder: 'uniqlo.com/… or grailed.com/…',
    hint: 'Any product, resale or archive page. Fitgrid reads the listing, not the photo.',
    idleCaption: ['Waiting for a', 'product URL'],
    credit: 'Studio image pulled from the listing at full resolution.',
    button: 'Look up',
    busyButton: 'Matching…',
    real: false,
  },
  {
    id: 'receipt',
    tab: 'Order email',
    placeholder: 'forward to closet@fitgrid.xyz',
    hint: 'Forward a confirmation and every item in the order is filed at once.',
    idleCaption: ['Nothing forwarded', 'yet'],
    credit: 'One email can add a whole order in a single pass.',
    button: 'Look up',
    busyButton: 'Matching…',
    real: false,
  },
  {
    id: 'image',
    tab: 'Drop an image',
    placeholder: 'drop a file, or paste an image URL',
    hint: 'Found it on Pinterest or a lookbook? Drop the image and Fitgrid cuts the background out.',
    idleCaption: ['Drop an image,', 'or paste its URL'],
    credit: 'Background removed in your browser. Nothing was uploaded anywhere.',
    button: 'Cut out',
    busyButton: 'Cutting…',
    real: true,
  },
];

export function sourceById(id: SourceId): Source {
  const source = SOURCES.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source ${id}`);
  return source;
}
