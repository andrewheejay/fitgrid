import { useNavigate } from '@tanstack/react-router';
import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Button } from '~/components/Button';
import { Tab } from '~/components/Chip';
import type { Aesthetic, Item } from '~/domain/items';
import { LAYERS, layerName, type Category } from '~/domain/layers';
import { loadBitmap, runCutout, type CutoutResult } from '~/ingest/cutout';
import { sourceById, SOURCES, type SourceId } from '~/ingest/sources';
import { CATALOGUE_STEPS, CUTOUT_STEPS, type StepStatus } from '~/ingest/steps';
import { useWardrobe } from '~/store/wardrobeStore';
import styles from './AddItemScreen.module.css';
import { CATALOGUE_MATCH, catalogueItem } from './catalogueMatch';
import { Pipeline } from './Pipeline';
import { Field, Fields, ResultCard, Select } from './ResultCard';

type Phase = 'idle' | 'running' | 'catalogue' | 'cutout' | 'nomatch' | 'error';

const PENDING: StepStatus[] = ['pending', 'pending', 'pending', 'pending'];
const CATALOGUE_STEP_MS = 700;

interface Draft {
  name: string;
  category: Category;
  silhouette: string;
  texture: string;
  aesthetic: Aesthetic;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  category: 'top',
  silhouette: '',
  texture: '',
  aesthetic: 'casual',
};

export function AddItemScreen() {
  const addItem = useWardrobe((state) => state.addItem);
  const navigate = useNavigate();

  const [sourceId, setSourceId] = useState<SourceId>('label');
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [statuses, setStatuses] = useState<StepStatus[]>(PENDING);
  const [runningNote, setRunningNote] = useState<string | undefined>(undefined);
  const [cutout, setCutout] = useState<CutoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const timers = useRef<number[]>([]);

  const source = sourceById(sourceId);
  const steps = source.real ? CUTOUT_STEPS : CATALOGUE_STEPS;

  const resetRun = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPhase('idle');
    setStatuses(PENDING);
    setRunningNote(undefined);
    setCutout(null);
    setError(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const switchSource = (next: SourceId) => {
    resetRun();
    setSourceId(next);
    setValue('');
  };

  /** The three catalogue paths: the four-step shape, on fixed content. */
  const runCatalogue = () => {
    resetRun();
    setPhase('running');
    CATALOGUE_STEPS.forEach((_, index) => {
      timers.current.push(
        window.setTimeout(
          () =>
            setStatuses((current) =>
              current.map((status, i) =>
                i < index ? 'done' : i === index ? 'running' : status,
              ),
            ),
          index * CATALOGUE_STEP_MS,
        ),
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        setStatuses(['done', 'done', 'done', 'done']);
        setPhase('catalogue');
      }, CATALOGUE_STEPS.length * CATALOGUE_STEP_MS),
    );
  };

  /** The image drop: every step is real work in this browser. */
  const runImage = async (input: File | string) => {
    resetRun();
    setPhase('running');
    setStatuses(['running', 'pending', 'pending', 'pending']);

    try {
      const bitmap = await loadBitmap(input);
      setStatuses(['done', 'running', 'pending', 'pending']);

      const result = await runCutout(bitmap, ({ step, ratio }) => {
        if (step === 'model') {
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

      setStatuses(['done', 'done', 'done', 'done']);
      setRunningNote(undefined);
      setCutout(result);
      setPhase('cutout');
    } catch (caught) {
      setRunningNote(undefined);
      setStatuses(PENDING);
      setError(caught instanceof Error ? caught.message : 'That image could not be processed.');
      setPhase('error');
    }
  };

  const submit = () => {
    if (phase === 'catalogue' || phase === 'cutout') {
      resetRun();
      setValue('');
      return;
    }
    if (source.real) {
      if (!value.trim()) return;
      void runImage(value.trim());
      return;
    }
    runCatalogue();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (sourceId !== 'image') setSourceId('image');
    void runImage(file);
  };

  const addCatalogueItem = () => {
    addItem(catalogueItem(crypto.randomUUID(), sourceId));
    navigate({ to: '/wardrobe' });
  };

  const addCutoutItem = () => {
    if (!cutout) return;
    const item: Item = {
      id: crypto.randomUUID(),
      category: draft.category,
      name: draft.name.trim() || 'Untitled piece',
      silhouette: draft.silhouette.trim() || 'regular',
      texture: draft.texture.trim() || 'unrecorded',
      aesthetic: draft.aesthetic,
      tone: cutout.palette[0],
      palette: cutout.palette,
      addedAt: new Date().toISOString().slice(0, 10),
      wornCount: 0,
      imageUrl: cutout.url,
      source: 'image',
    };
    addItem(item);
    navigate({ to: '/wardrobe' });
  };

  const busy = phase === 'running';
  const succeeded = phase === 'catalogue' || phase === 'cutout';

  return (
    <main className={styles.layout}>
      <div
        className={styles.left}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div
          className={`${styles.frame} ${succeeded ? styles.frameSolid : ''} ${
            dragging ? styles.frameDrag : ''
          }`}
        >
          {phase === 'cutout' && cutout ? (
            <img className={styles.result} src={cutout.url} alt="The cut-out garment" />
          ) : phase === 'catalogue' ? (
            <div className={`${styles.glyph} ${styles.glyphImage}`} aria-hidden="true" />
          ) : busy ? (
            <p className={styles.frameText}>
              {source.real ? 'Removing background' : 'Reading scan care label'}
            </p>
          ) : (
            <>
              <div
                className={`${styles.glyph} ${sourceId === 'image' ? styles.glyphImage : ''}`}
                aria-hidden="true"
              />
              <p className={styles.frameText}>
                {source.idleCaption[0]}
                <br />
                {source.idleCaption[1]}
              </p>
            </>
          )}
        </div>

        <p className={styles.credit}>
          {succeeded
            ? source.credit
            : 'Placeholder art — a real garment photograph goes here.'}
        </p>
      </div>

      <div className={styles.right}>
        <h1 className={styles.title}>Add an item</h1>
        <p className={styles.body}>
          Scan a care label, paste a product link, or forward an order email and Fitgrid takes
          the brand&rsquo;s own studio photo. No listing anywhere? Drop any image you found and
          it gets cut out instead.
        </p>

        <div className={styles.tabs}>
          {SOURCES.map((entry) => (
            <Tab
              key={entry.id}
              label={entry.tab}
              active={entry.id === sourceId}
              onClick={() => switchSource(entry.id)}
            />
          ))}
        </div>

        <div className={styles.entry}>
          <input
            className={styles.input}
            value={value}
            placeholder={source.placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            disabled={busy}
          />
          <Button size="lg" onClick={submit} disabled={busy}>
            {busy ? source.busyButton : succeeded ? 'Add another' : source.button}
          </Button>
        </div>

        <p className={styles.hint}>
          {source.hint}
          {source.real ? null : (
            <>
              {' '}
              <span className={styles.demoNote}>
                This path is a demonstration — it returns a fixed example rather than querying a
                real catalogue.
              </span>
            </>
          )}
        </p>

        <Pipeline
          steps={steps}
          statuses={statuses}
          {...(runningNote !== undefined ? { runningNote } : {})}
          started={phase !== 'idle'}
        />

        {phase === 'catalogue' ? (
          <ResultCard
            brand={CATALOGUE_MATCH.brand}
            name={CATALOGUE_MATCH.name}
            pill={CATALOGUE_MATCH.pill}
            pillTone="match"
            rows={[...CATALOGUE_MATCH.rows]}
            tags={[...CATALOGUE_MATCH.tags]}
            actions={
              <>
                <Button onClick={addCatalogueItem}>Add to wardrobe</Button>
                <Button variant="invert" onClick={() => setPhase('nomatch')}>
                  Not my item
                </Button>
              </>
            }
          />
        ) : null}

        {phase === 'cutout' && cutout ? (
          <ResultCard
            brand="Cut-out"
            name={draft.name.trim() || 'Name it below'}
            pill="Cut-out clean"
            pillTone="cutout"
            rows={[
              { key: 'Source', value: 'Image you supplied' },
              { key: 'Matte edges', value: 'Removed in your browser' },
              { key: 'Framing', value: 'Centred, 12% padding' },
              { key: 'Missing', value: 'Brand, size, price — add by hand' },
            ]}
            tags={[draft.category, ...cutout.palette]}
            actions={
              <>
                <Button onClick={addCutoutItem}>Add to wardrobe</Button>
                <Button variant="invert" onClick={resetRun}>
                  Start over
                </Button>
              </>
            }
          >
            <Fields>
              <Field
                label="Name"
                value={draft.name}
                onChange={(name) => setDraft({ ...draft, name })}
                placeholder="Boxy oxford shirt"
                wide
                sans
              />
              <Select
                label="Layer"
                value={draft.category}
                options={LAYERS.map((layer) => ({ value: layer, label: layerName(layer) }))}
                onChange={(category) =>
                  setDraft({ ...draft, category: category as Category })
                }
              />
              <Select
                label="Aesthetic"
                value={draft.aesthetic}
                options={AESTHETICS.map((option) => ({ value: option, label: option }))}
                onChange={(aesthetic) =>
                  setDraft({ ...draft, aesthetic: aesthetic as Aesthetic })
                }
              />
              <Field
                label="Silhouette"
                value={draft.silhouette}
                onChange={(silhouette) => setDraft({ ...draft, silhouette })}
                placeholder="boxy"
              />
              <Field
                label="Texture"
                value={draft.texture}
                onChange={(texture) => setDraft({ ...draft, texture })}
                placeholder="cotton poplin"
              />
            </Fields>
          </ResultCard>
        ) : null}

        {phase === 'nomatch' ? (
          <div className={styles.error}>
            <p className={styles.errorLabel}>No catalogue match</p>
            <p className={styles.errorBody}>
              Vintage, tailored and thrifted pieces usually aren&rsquo;t listed anywhere. Find any
              photo of it online and drop that in — Fitgrid will cut the background out.
            </p>
            <div className={styles.errorActions}>
              <Button variant="invert" onClick={() => switchSource('image')}>
                Drop an image instead →
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <div className={styles.error}>
            <p className={styles.errorLabel}>That didn&rsquo;t work</p>
            <p className={styles.errorBody}>{error}</p>
            <div className={styles.errorActions}>
              <Button variant="invert" onClick={resetRun}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const AESTHETICS: readonly Aesthetic[] = ['workwear', 'quiet', 'casual', 'utility', 'sport'];
