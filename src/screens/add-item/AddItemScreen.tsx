import { useNavigate } from '@tanstack/react-router';
import { useState, type DragEvent } from 'react';
import { Button } from '~/components/Button';
import { Tab } from '~/components/Chip';
import type { Aesthetic } from '~/domain/items';
import { LAYERS, layerName, type Category } from '~/domain/layers';
import { SOURCES } from '~/ingest/sources';
import { useWardrobe } from '~/store/wardrobeStore';
import styles from './AddItemScreen.module.css';
import { CATALOGUE_MATCH, catalogueItem } from './catalogueMatch';
import { Pipeline } from './Pipeline';
import { Field, Fields, ResultCard, Select } from './ResultCard';
import { itemFromDraft, useAddItemFlow, type Draft } from './useAddItemFlow';

const AESTHETICS: readonly Aesthetic[] = ['workwear', 'quiet', 'casual', 'utility', 'sport'];

/**
 * What the cut-out path still cannot tell you. It updates as the fields below
 * are filled in — the row is a prompt, not a fixed disclaimer.
 */
function stillMissing(draft: Draft): string {
  const gaps: string[] = [];
  if (!draft.brand.trim()) gaps.push('Brand');
  if (!draft.colourway.trim()) gaps.push('colourway');
  if (!draft.retail.trim()) gaps.push('price');

  if (gaps.length === 0) return 'Nothing — you filled it in';
  return `${gaps.join(', ')} — add by hand`;
}

export function AddItemScreen() {
  const addItem = useWardrobe((state) => state.addItem);
  const navigate = useNavigate();
  const flow = useAddItemFlow();
  const [dragging, setDragging] = useState(false);

  const { source, phase, cutout, draft } = flow;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (source.id !== 'image') flow.switchSource('image');
    flow.runImage(file);
  };

  const addCatalogueItem = () => {
    addItem(catalogueItem(crypto.randomUUID(), source.id));
    navigate({ to: '/wardrobe' });
  };

  const addCutoutItem = () => {
    if (!cutout) return;
    addItem(itemFromDraft(draft, cutout, crypto.randomUUID()));
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
                className={`${styles.glyph} ${source.id === 'image' ? styles.glyphImage : ''}`}
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
              active={entry.id === source.id}
              onClick={() => flow.switchSource(entry.id)}
            />
          ))}
        </div>

        <div className={styles.entry}>
          <input
            className={styles.input}
            value={flow.value}
            placeholder={source.placeholder}
            onChange={(event) => flow.setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') flow.submit();
            }}
            disabled={busy}
          />
          <Button size="lg" onClick={flow.submit} disabled={busy}>
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
          steps={flow.steps}
          statuses={flow.statuses}
          {...(flow.runningNote !== undefined ? { runningNote: flow.runningNote } : {})}
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
                <Button variant="invert" onClick={flow.showNoMatch}>
                  Not my item
                </Button>
              </>
            }
          />
        ) : null}

        {phase === 'cutout' && cutout ? (
          <ResultCard
            brand={draft.brand.trim() || 'Cut-out'}
            name={draft.name.trim() || 'Name it below'}
            pill="Cut-out clean"
            pillTone="cutout"
            rows={[
              { key: 'Source', value: 'Image you supplied' },
              { key: 'Matte edges', value: 'Removed in your browser' },
              { key: 'Framing', value: 'Centred, 12% padding' },
              { key: 'Missing', value: stillMissing(draft) },
            ]}
            tags={[draft.category, ...cutout.palette]}
            actions={
              <>
                <Button onClick={addCutoutItem}>Add to wardrobe</Button>
                <Button variant="invert" onClick={flow.reset}>
                  Start over
                </Button>
              </>
            }
          >
            <Fields>
              <Field
                label="Name"
                value={draft.name}
                onChange={(name) => flow.setDraft({ ...draft, name })}
                placeholder="Boxy oxford shirt"
                wide
                sans
              />
              <Select
                label="Layer"
                value={draft.category}
                options={LAYERS.map((layer) => ({ value: layer, label: layerName(layer) }))}
                onChange={(category) =>
                  flow.setDraft({ ...draft, category: category as Category })
                }
              />
              <Select
                label="Aesthetic"
                value={draft.aesthetic}
                options={AESTHETICS.map((option) => ({ value: option, label: option }))}
                onChange={(aesthetic) =>
                  flow.setDraft({ ...draft, aesthetic: aesthetic as Aesthetic })
                }
              />
              <Field
                label="Silhouette"
                value={draft.silhouette}
                onChange={(silhouette) => flow.setDraft({ ...draft, silhouette })}
                placeholder="boxy"
              />
              <Field
                label="Texture"
                value={draft.texture}
                onChange={(texture) => flow.setDraft({ ...draft, texture })}
                placeholder="cotton poplin"
              />
              {/*
                The card above says brand, size and price have to be added by
                hand. These are where that happens — all optional.
              */}
              <Field
                label="Brand"
                value={draft.brand}
                onChange={(brand) => flow.setDraft({ ...draft, brand })}
                placeholder="optional"
              />
              <Field
                label="Colourway"
                value={draft.colourway}
                onChange={(colourway) => flow.setDraft({ ...draft, colourway })}
                placeholder="optional"
              />
              <Field
                label="Style code"
                value={draft.styleCode}
                onChange={(styleCode) => flow.setDraft({ ...draft, styleCode })}
                placeholder="optional"
              />
              <Field
                label="Retail"
                value={draft.retail}
                onChange={(retail) => flow.setDraft({ ...draft, retail })}
                placeholder="optional"
              />
              <Field
                label="Composition"
                value={draft.composition}
                onChange={(composition) => flow.setDraft({ ...draft, composition })}
                placeholder="optional"
                wide
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
              <Button variant="invert" onClick={() => flow.switchSource('image')}>
                Drop an image instead →
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'error' && flow.error ? (
          <div className={styles.error}>
            <p className={styles.errorLabel}>That didn&rsquo;t work</p>
            <p className={styles.errorBody}>{flow.error}</p>
            <div className={styles.errorActions}>
              <Button variant="invert" onClick={flow.reset}>
                Try again
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
