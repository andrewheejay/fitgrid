import { useCallback, useEffect, useRef, useState } from 'react';
import type { Aesthetic, Hex, Item } from '~/domain/items';
import type { Category } from '~/domain/layers';
import { loadBitmap, runCutout, type CutoutResult } from '~/ingest/cutout';
import { sourceById, type Source, type SourceId } from '~/ingest/sources';
import {
  CATALOGUE_STEPS,
  CUTOUT_STEPS,
  type PipelineStep,
  type StepStatus,
} from '~/ingest/steps';

export type Phase = 'idle' | 'running' | 'catalogue' | 'cutout' | 'nomatch' | 'error';

/** The fields only a human can supply — so they are typed, not guessed. */
export interface Draft {
  name: string;
  category: Category;
  silhouette: string;
  texture: string;
  aesthetic: Aesthetic;
}

export const EMPTY_DRAFT: Draft = {
  name: '',
  category: 'top',
  silhouette: '',
  texture: '',
  aesthetic: 'casual',
};

const PENDING: StepStatus[] = ['pending', 'pending', 'pending', 'pending'];
const ALL_DONE: StepStatus[] = ['done', 'done', 'done', 'done'];
const CATALOGUE_STEP_MS = 700;

export interface AddItemFlow {
  source: Source;
  steps: readonly PipelineStep[];
  value: string;
  setValue: (value: string) => void;
  phase: Phase;
  statuses: StepStatus[];
  runningNote: string | undefined;
  cutout: CutoutResult | null;
  error: string | null;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  switchSource: (id: SourceId) => void;
  submit: () => void;
  runImage: (input: File | string) => void;
  reset: () => void;
  showNoMatch: () => void;
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
  const [sourceId, setSourceId] = useState<SourceId>('label');
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [statuses, setStatuses] = useState<StepStatus[]>(PENDING);
  const [runningNote, setRunningNote] = useState<string | undefined>(undefined);
  const [cutout, setCutout] = useState<CutoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const timers = useRef<number[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  // Leaving the screen mid-run must not leave timers firing into a component
  // that is no longer mounted.
  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setStatuses(PENDING);
    setRunningNote(undefined);
    setCutout(null);
    setError(null);
    setDraft(EMPTY_DRAFT);
  }, [clearTimers]);

  const switchSource = useCallback(
    (next: SourceId) => {
      reset();
      setSourceId(next);
      setValue('');
    },
    [reset],
  );

  /** The three catalogue paths: the real four-step shape, on fixed content. */
  const runCatalogue = useCallback(() => {
    reset();
    setPhase('running');

    CATALOGUE_STEPS.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(() => {
          setStatuses((current) =>
            current.map((status, i) => (i < index ? 'done' : i === index ? 'running' : status)),
          );
        }, index * CATALOGUE_STEP_MS),
      );
    });

    timers.current.push(
      window.setTimeout(() => {
        setStatuses(ALL_DONE);
        setPhase('catalogue');
      }, CATALOGUE_STEPS.length * CATALOGUE_STEP_MS),
    );
  }, [reset]);

  /** The image drop: every step is real work in this browser. */
  const runImage = useCallback(
    async (input: File | string) => {
      reset();
      setPhase('running');
      setStatuses(['running', 'pending', 'pending', 'pending']);

      try {
        const bitmap = await loadBitmap(input);
        setStatuses(['done', 'running', 'pending', 'pending']);

        const result = await runCutout(bitmap, ({ step, ratio }) => {
          if (step === 'model') {
            // Model download dominates the wait, so it gets a real percentage
            // rather than the word "running".
            setRunningNote(
              ratio >= 1 ? 'model ready' : `loading model ${Math.round(ratio * 100)}%`,
            );
            return;
          }
          setRunningNote(undefined);
          const index = step === 'matte' ? 1 : step === 'trim' ? 2 : 3;
          setStatuses((current) =>
            current.map((status, i) =>
              i < index ? 'done' : i === index ? (ratio >= 1 ? 'done' : 'running') : status,
            ),
          );
        });

        setStatuses(ALL_DONE);
        setRunningNote(undefined);
        setCutout(result);
        setPhase('cutout');
      } catch (caught) {
        setRunningNote(undefined);
        setStatuses(PENDING);
        setError(
          caught instanceof Error ? caught.message : 'That image could not be processed.',
        );
        setPhase('error');
      }
    },
    [reset],
  );

  const source = sourceById(sourceId);

  const submit = useCallback(() => {
    // After a success the same button starts the next run.
    if (phase === 'catalogue' || phase === 'cutout') {
      reset();
      setValue('');
      return;
    }
    if (source.real) {
      if (value.trim()) void runImage(value.trim());
      return;
    }
    runCatalogue();
  }, [phase, reset, runCatalogue, runImage, source.real, value]);

  return {
    source,
    steps: source.real ? CUTOUT_STEPS : CATALOGUE_STEPS,
    value,
    setValue,
    phase,
    statuses,
    runningNote,
    cutout,
    error,
    draft,
    setDraft,
    switchSource,
    submit,
    runImage: (input) => void runImage(input),
    reset,
    showNoMatch: () => setPhase('nomatch'),
  };
}

/** Everything the cut-out knows, plus everything the human typed. */
export function itemFromDraft(draft: Draft, cutout: CutoutResult, id: string): Item {
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
    source: 'image',
  };
}
