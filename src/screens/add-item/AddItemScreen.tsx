import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { Button } from '~/components/Button';
import { Tab } from '~/components/Chip';
import type { SpecRow } from '~/components/SpecTable';
import { AESTHETICS, type Aesthetic } from '~/domain/items';
import { LAYERS, layerName, type Category } from '~/domain/layers';
import { hostname, READER_LABEL, type Listing } from '~/ingest/listing';
import { SOURCES } from '~/ingest/sources';
import { useWardrobe } from '~/store/wardrobeStore';
import styles from './AddItemScreen.module.css';
import { Pipeline } from './Pipeline';
import { Field, Fields, ResultCard, Select } from './ResultCard';
import { itemFromDraft, useAddItemFlow, type Draft } from './useAddItemFlow';
import { useFileDrop } from './useFileDrop';


/**
 * What the run still could not tell you. It updates as the fields below are
 * filled in — the row is a prompt, not a fixed disclaimer.
 */
function stillMissing(draft: Draft, listing: Listing | null): string {
  const gaps: string[] = [];
  if (!draft.brand.trim()) gaps.push('Brand');
  if (!draft.colourway.trim()) gaps.push('colourway');
  if (!draft.retail.trim()) gaps.push('price');

  if (gaps.length > 0) return `${gaps.join(', ')} — add by hand`;
  return listing ? 'Nothing — the listing had it all' : 'Nothing — you filled it in';
}

/** The rows above the editable fields: where this cut-out came from. */
function provenanceRows(listing: Listing | null, draft: Draft): SpecRow[] {
  const shared: SpecRow[] = [
    { key: 'Matte edges', value: 'Removed in your browser' },
    { key: 'Missing', value: stillMissing(draft, listing) },
  ];
  if (!listing) {
    return [
      { key: 'Source', value: 'Image you supplied' },
      { key: 'Framing', value: 'Centred, 12% padding' },
      ...shared,
    ];
  }
  return [
    { key: 'Source', value: hostname(listing.url) },
    { key: 'Read via', value: READER_LABEL[listing.via] },
    ...shared,
  ];
}

export function AddItemScreen() {
  const addItem = useWardrobe((state) => state.addItem);
  const navigate = useNavigate();
  const flow = useAddItemFlow();
  const picker = useRef<HTMLInputElement>(null);

  const { source, phase, cutout, draft, listing } = flow;

  /*
   * Dropping a file is itself the choice of path, so it switches tabs rather
   * than refusing: someone holding a photograph over the link tab means the
   * image drop, and making them click the right tab first before they are
   * allowed to let go is a rule with no reason behind it.
   */
  const takeFile = (file: File) => {
    if (source.id !== 'image') flow.switchSource('image');
    flow.runImage(file);
  };

  const drop = useFileDrop(takeFile);

  /*
   * Opening the picker is a separate verb from submitting, because on the
   * image path they are two different things: the field takes a URL and the
   * button takes a file. The frame is still clickable, but a dashed square is
   * not a control anyone finds on a phone, where there is no drop either.
   */
  const pickFile = () => picker.current?.click();

  const addCutoutItem = () => {
    if (!cutout) return;
    addItem(itemFromDraft(draft, cutout, crypto.randomUUID(), source.id));
    navigate({ to: '/' });
  };

  const busy = phase === 'running';
  const succeeded = phase === 'cutout';

  /*
   * On the image path the entry button attaches a file until there is a URL in
   * the field to run instead. It used to say "Cut out" over an empty field and
   * do nothing when pressed — the only way to hand over a file was the dashed
   * frame, and on a touch screen, where there is no drag and drop at all, that
   * left the tab with no working way in.
   *
   * The label says which of the two it currently is rather than the button
   * quietly changing meaning underneath it.
   */
  const attaches = source.id === 'image' && !busy && !succeeded && flow.value.trim() === '';

  const frameContent =
    phase === 'cutout' && cutout ? (
      <img className={styles.result} src={cutout.url} alt="The cut-out garment" />
    ) : busy ? (
      <p className={styles.frameText}>{source.busyCaption}</p>
    ) : (
      <>
        <div
          className={`${styles.glyph} ${source.id === 'image' ? styles.glyphImage : ''}`}
          aria-hidden="true"
        />
        <p className={styles.frameText}>
          {drop.over ? (
            'Release to cut it out'
          ) : (
            <>
              {source.idleCaption[0]}
              <br />
              {source.idleCaption[1]}
            </>
          )}
        </p>
      </>
    );

  const frameClass = [styles.frame, succeeded ? styles.frameSolid : '', drop.over ? styles.frameDrag : '']
    .filter(Boolean)
    .join(' ');

  return (
    /*
     * The whole screen is the drop target, not just the frame. A file aimed at
     * a 320px square and released forty pixels wide of it used to be opened by
     * the browser, and the page — with anything typed into it — was gone.
     */
    <main className={styles.layout} {...drop.handlers}>
      {/*
        Mounted for both tabs, because the picker is now opened from the entry
        row as well as from the frame, and a file arriving on the link tab
        switches to the image tab rather than being refused.
      */}
      <input
        ref={picker}
        className={styles.picker}
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so that choosing the same file twice running still
          // fires a change event and re-runs the pipeline.
          event.target.value = '';
          if (file) takeFile(file);
        }}
      />

      <div className={styles.left}>
        {source.id === 'image' ? (
          <button type="button" className={`${frameClass} ${styles.framePick}`} onClick={pickFile}>
            {frameContent}
          </button>
        ) : (
          <div className={frameClass}>{frameContent}</div>
        )}

        <p className={styles.credit}>
          {succeeded
            ? source.credit
            : 'Placeholder art — a real garment photograph goes here.'}
        </p>
      </div>

      <div className={styles.right}>
        <h1 className={styles.title}>Add an item</h1>
        <p className={styles.body}>
          Paste a product link and Fitgrid reads the listing, then takes the shop&rsquo;s own
          studio photo. Vintage, tailored or thrifted, with no listing anywhere? Drop any image
          of it and the background comes off in your browser.
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
          <Button size="lg" onClick={attaches ? pickFile : flow.submit} disabled={busy}>
            {busy
              ? source.busyButton
              : succeeded
                ? 'Add another'
                : attaches
                  ? 'Choose file'
                  : source.button}
          </Button>
        </div>

        <p className={styles.hint}>{source.hint}</p>

        <Pipeline
          steps={flow.steps}
          statuses={flow.statuses}
          {...(flow.runningNote !== undefined ? { runningNote: flow.runningNote } : {})}
          started={phase !== 'idle'}
        />

        {phase === 'cutout' && cutout ? (
          <ResultCard
            brand={draft.brand.trim() || (listing ? hostname(listing.url) : 'Cut-out')}
            name={draft.name.trim() || 'Name it below'}
            pill={listing ? 'Listing read' : 'Cut-out clean'}
            pillTone={listing ? 'match' : 'cutout'}
            rows={provenanceRows(listing, draft)}
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
            {/* Only the link path reaches this state now: it is the page that
                could not be read, never a catalogue that had no answer. */}
            <p className={styles.errorLabel}>Could not read that page</p>
            <p className={styles.errorBody}>
              {flow.error ??
                'Vintage, tailored and thrifted pieces usually aren\u2019t listed anywhere.'}{' '}
              Find any photo of it online and drop that in — Fitgrid will cut the background
              out.
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
