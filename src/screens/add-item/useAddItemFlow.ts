import { useCallback, useState } from 'react';
import { guessCategory } from '~/ingest/classify';
import type { Aesthetic, Hex, Item } from '~/domain/items';
import type { Category } from '~/domain/layers';
import { loadBitmap, runCutout, type CutoutProgress, type CutoutResult } from '~/ingest/cutout';
import {
  loadListingImage,
  ListingUnreadable,
  normaliseUrl,
  readListing,
  type Listing,
} from '~/ingest/listing';
import { sourceById, type Source, type SourceId } from '~/ingest/sources';
import { type PipelineStep, type StepStatus } from '~/ingest/steps';

export type Phase = 'idle' | 'running' | 'cutout' | 'nomatch' | 'error';

/**
 * The fields only a human can supply — so they are typed, not guessed.
 *
 * The catalogue fields are optional and empty by default. The cut-out path
 * cannot know a brand or a price, and the result card says so ("Brand, size,
 * price — add by hand"); these are where that happens.
 */
export interface Draft {
  name: string;
  category: Category;
  silhouette: string;
  texture: string;
  aesthetic: Aesthetic;
  brand: string;
  styleCode: string;
  colourway: string;
  composition: string;
  retail: string;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  category: 'top',
  silhouette: '',
  texture: '',
  aesthetic: 'casual',
  brand: '',
  styleCode: '',
  colourway: '',
  composition: '',
  retail: '',
};

const PENDING: StepStatus[] = ['pending', 'pending', 'pending', 'pending'];
const ALL_DONE: StepStatus[] = ['done', 'done', 'done', 'done'];

export interface AddItemFlow {
  source: Source;
  steps: readonly PipelineStep[];
  value: string;
  setValue: (value: string) => void;
  phase: Phase;
  statuses: StepStatus[];
  runningNote: string | undefined;
  cutout: CutoutResult | null;
  /** The page a link path read, so the result card can cite it. */
  listing: Listing | null;
  error: string | null;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  switchSource: (id: SourceId) => void;
  submit: () => void;
  runImage: (input: File | string) => void;
  reset: () => void;
}

/**
 * The add-item flow: which source is selected, how far the pipeline has run,
 * and what came back.
 *
 * Extracted from the screen for the same reason the deck's state machine is —
 * the component is then only wiring and JSX, and the flow can be reasoned about
 * without reading markup.
 */
export function useAddItemFlow(): AddItemFlow {
  const [sourceId, setSourceId] = useState<SourceId>('link');
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [statuses, setStatuses] = useState<StepStatus[]>(PENDING);
  const [runningNote, setRunningNote] = useState<string | undefined>(undefined);
  const [cutout, setCutout] = useState<CutoutResult | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const reset = useCallback(() => {
    setPhase('idle');
    setStatuses(PENDING);
    setRunningNote(undefined);
    setCutout(null);
    setListing(null);
    setError(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const switchSource = useCallback(
    (next: SourceId) => {
      reset();
      setSourceId(next);
      setValue('');
    },
    [reset],
  );

  const fail = useCallback((caught: unknown, fallback: string) => {
    setRunningNote(undefined);
    setStatuses(PENDING);
    setError(caught instanceof Error ? caught.message : fallback);
    setPhase('error');
  }, []);

  /** A finished cut-out, plus the listing it came from when there was one. */
  const succeed = useCallback((result: CutoutResult, found: Listing | null) => {
    setStatuses(ALL_DONE);
    setRunningNote(undefined);
    setCutout(result);
    setListing(found);
    if (found) setDraft(draftFromListing(found));
    setPhase('cutout');
  }, []);

  /**
   * Runs the segmentation worker, writing its progress into the pipeline rows
   * from `offset` on. The image drop reaches the model on row 1 and the link
   * path on row 2, so the two paths share one driver rather than one each.
   */
  const cutoutFrom = useCallback((bitmap: ImageBitmap, offset: number) => {
    const onProgress = ({ step, ratio }: CutoutProgress) => {
      if (step === 'model') {
        // Model download dominates the wait, so it gets a real percentage
        // rather than the word "running".
        setRunningNote(ratio >= 1 ? 'model ready' : `loading model ${Math.round(ratio * 100)}%`);
        return;
      }
      setRunningNote(undefined);
      const row = step === 'matte' ? 0 : step === 'trim' ? 1 : 2;
      const index = Math.min(offset + row, PENDING.length - 1);
      setStatuses((current) =>
        current.map((status, i) =>
          i < index ? 'done' : i === index ? (ratio >= 1 ? 'done' : 'running') : status,
        ),
      );
    };
    return runCutout(bitmap, onProgress);
  }, []);

  /** The image drop: every step is real work in this browser. */
  const runImage = useCallback(
    async (input: File | string) => {
      reset();

      // A dropped file is whatever was under the cursor. Saying so beats
      // letting the decoder fail and reporting that the image was unreadable,
      // which it was not — it was a PDF.
      if (input instanceof File && !input.type.startsWith('image/')) {
        setError(`${input.name} is not an image.`);
        setPhase('error');
        return;
      }

      setPhase('running');
      setStatuses(['running', 'pending', 'pending', 'pending']);

      try {
        const bitmap = await loadBitmap(input);
        setStatuses(['done', 'running', 'pending', 'pending']);
        succeed(await cutoutFrom(bitmap, 1), null);
      } catch (caught) {
        fail(caught, 'That image could not be processed.');
      }
    },
    [cutoutFrom, fail, reset, succeed],
  );

  /**
   * The pasted link: read what the page publishes about itself, pull the
   * studio image that metadata points at, and cut it out here.
   *
   * A retailer that refuses every reader is not a failure of ours, so it does
   * not get the error card — it gets the no-match card, which is already the
   * designed route to dropping the image by hand.
   */
  const runLink = useCallback(
    async (input: string) => {
      reset();
      setPhase('running');

      let url: string;
      try {
        url = normaliseUrl(input);
      } catch (caught) {
        fail(caught, 'That is not a URL.');
        return;
      }

      setStatuses(['running', 'pending', 'pending', 'pending']);
      try {
        const found = await readListing(url);
        setStatuses(['done', 'running', 'pending', 'pending']);

        const bitmap = await loadListingImage(found);
        setStatuses(['done', 'done', 'running', 'pending']);

        succeed(await cutoutFrom(bitmap, 2), found);
      } catch (caught) {
        if (caught instanceof ListingUnreadable) {
          setRunningNote(undefined);
          setStatuses(PENDING);
          setError(caught.message);
          setPhase('nomatch');
          return;
        }
        fail(caught, 'That listing could not be read.');
      }
    },
    [cutoutFrom, fail, reset, succeed],
  );

  const source = sourceById(sourceId);

  const submit = useCallback(() => {
    // After a success the same button starts the next run.
    if (phase === 'cutout') {
      reset();
      setValue('');
      return;
    }
    const entered = value.trim();
    if (source.id === 'link') {
      if (entered) void runLink(entered);
      return;
    }
    if (entered) void runImage(entered);
  }, [phase, reset, runImage, runLink, source.id, value]);

  return {
    source,
    steps: source.steps,
    value,
    setValue,
    phase,
    statuses,
    runningNote,
    cutout,
    listing,
    error,
    draft,
    setDraft,
    switchSource,
    submit,
    runImage: (input) => void runImage(input),
    reset,
  };
}

/**
 * Everything the cut-out knows, plus everything the human typed. Catalogue
 * fields are omitted rather than stored empty, so "no brand recorded" and
 * "brand recorded as nothing" stay distinguishable.
 */
export function itemFromDraft(
  draft: Draft,
  cutout: CutoutResult,
  id: string,
  source: Item['source'],
): Item {
  const optional = (value: string) => (value.trim() ? { value: value.trim() } : null);
  const catalogue = {
    ...(optional(draft.brand) ? { brand: draft.brand.trim() } : {}),
    ...(optional(draft.styleCode) ? { styleCode: draft.styleCode.trim() } : {}),
    ...(optional(draft.colourway) ? { colourway: draft.colourway.trim() } : {}),
    ...(optional(draft.composition) ? { composition: draft.composition.trim() } : {}),
    ...(optional(draft.retail) ? { retail: draft.retail.trim() } : {}),
  };

  return {
    id,
    category: draft.category,
    name: draft.name.trim() || 'Untitled piece',
    silhouette: draft.silhouette.trim() || 'regular',
    texture: draft.texture.trim() || 'unrecorded',
    aesthetic: draft.aesthetic,
    tone: cutout.palette[0] as Hex,
    palette: cutout.palette,
    addedAt: new Date().toISOString().slice(0, 10),
    wornCount: 0,
    imageUrl: cutout.url,
    ...catalogue,
    source,
  };
}

/**
 * Seed the draft from what the listing said.
 *
 * Everything stays editable: the layer is a keyword guess, and a page's own
 * copy is often looser than what the visitor would file it under.
 */
function draftFromListing(listing: Listing): Draft {
  return {
    ...EMPTY_DRAFT,
    name: listing.name,
    category: guessCategory(listing.name),
    brand: listing.brand ?? '',
    styleCode: listing.styleCode ?? '',
    colourway: listing.colourway ?? '',
    composition: listing.composition ?? '',
    retail: listing.retail ?? '',
  };
}
