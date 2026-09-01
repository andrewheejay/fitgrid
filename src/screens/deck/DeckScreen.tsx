import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/Button';
import { Tab } from '~/components/Chip';
import { lockedCount, selectedIds, type DeckEffect, type DeckMode } from '~/domain/deck';
import { flashMessage } from '~/domain/flash';
import { LAYERS, layerAt, layerName } from '~/domain/layers';
import { outfitFromSelection, poolsFrom } from '~/domain/outfits';
import { useDeckKeyboard } from '~/hooks/useDeckKeyboard';
import { useItemsById, useWardrobe } from '~/store/wardrobeStore';
import { DeckRail } from './DeckRail';
import styles from './DeckScreen.module.css';
import { FitStack } from './FitStack';
import { useDeck } from './useDeck';

const MODE_HINTS: Record<DeckMode, string> = {
  auto:
    'Auto: up and down pick a layer, left and right cycle it, space locks it. R reshuffles ' +
    'everything still open, so a locked shirt survives every reroll.',
  manual:
    'Manual: arrow left and right to scroll this layer, Enter to lock it in and drop to the ' +
    'next. Locked layers stay put when you reshuffle.',
};

export function DeckScreen() {
  const items = useWardrobe((state) => state.items);
  const saveOutfit = useWardrobe((state) => state.saveOutfit);
  const navigate = useNavigate();
  const { lock } = useSearch({ from: '/deck' });

  const pools = useMemo(() => poolsFrom(items), [items]);
  const itemsById = useItemsById();

  /*
   * "Lock into a fit" arrives with an item id; find where it sits in its pool.
   * Read once, when the deck mounts — a later change to the wardrobe should not
   * yank the visitor's selection back to where they entered.
   */
  const [initialLock] = useState(() => {
    if (!lock) return undefined;
    const item = items.find((candidate) => candidate.id === lock);
    if (!item) return undefined;
    const index = poolsFrom(items)[item.category].indexOf(item.id);
    return index >= 0 ? { layer: item.category, index } : undefined;
  });

  const onEffect = useCallback(
    (effect: DeckEffect) => {
      const outfit = outfitFromSelection(selectedIds(effect.selection, pools), {
        id: crypto.randomUUID(),
        name: 'Untitled fit',
        date: new Date().toISOString().slice(0, 10),
      });
      if (outfit) saveOutfit(outfit);
    },
    [pools, saveOutfit],
  );

  const { state, dispatch } = useDeck(
    pools,
    onEffect,
    initialLock ? { lock: initialLock } : {},
  );

  useDeckKeyboard(dispatch);

  const selected = selectedIds(state.selection, pools);

  // The deck cannot build a fit without at least one option in every required
  // layer. Outerwear is exempt: its pool always holds the "skip" option.
  const missing = LAYERS.filter((layer) => layer !== 'outer' && pools[layer].length === 0);
  if (missing.length > 0) {
    return (
      <main className={styles.blocked}>
        <p className={styles.blockedLabel}>Not enough to style</p>
        <p className={styles.blockedBody}>
          A fit needs a top, a bottom and shoes. There is nothing in{' '}
          {missing.map((layer) => layerName(layer).toLowerCase()).join(' or ')} yet. Add a piece
          and the deck can start proposing.
        </p>
        <div className={styles.actions}>
          <Button onClick={() => navigate({ to: '/add' })}>Add an item</Button>
        </div>
      </main>
    );
  }

  const activeLayerLabel =
    state.mode === 'auto'
      ? `Active layer — ${layerName(layerAt(state.activeLayer))}`
      : `Step ${state.step + 1} of ${LAYERS.length} — ${layerName(layerAt(state.activeLayer))}`;

  return (
    <main className={styles.layout}>
      <div className={styles.left}>
        <div className={styles.leftHead}>
          <h1 className={styles.title}>Today&rsquo;s fit</h1>
          <span className={styles.lockCount}>
            {lockedCount(state)} of {LAYERS.length} locked
          </span>
        </div>

        <FitStack state={state} selected={selected} itemsById={itemsById} />

        <div className={styles.actions}>
          <Button onClick={() => dispatch({ type: 'commit' })}>Save fit ⏎</Button>
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: 'reshuffle', random: Math.random })}
          >
            Reshuffle unlocked R
          </Button>
        </div>

        <p className={styles.flash} role="status">
          {state.flash ? flashMessage(state.flash) : ''}
        </p>

        <p className={styles.hint}>{MODE_HINTS[state.mode]}</p>
      </div>

      <div className={styles.right}>
        <div className={styles.topBar}>
          <div className={styles.modes}>
            <Tab
              label="Auto"
              active={state.mode === 'auto'}
              onClick={() => dispatch({ type: 'setMode', mode: 'auto' })}
            />
            <Tab
              label="Layer by layer"
              active={state.mode === 'manual'}
              onClick={() => dispatch({ type: 'setMode', mode: 'manual' })}
            />
          </div>
          <span className={styles.activeLayer}>{activeLayerLabel}</span>
        </div>

        <div className={styles.rails}>
          {LAYERS.map((layer, index) => (
            <DeckRail
              key={layer}
              layer={layer}
              pool={pools[layer]}
              selected={state.selection[layer]}
              active={state.activeLayer === index}
              locked={state.locked[layer]}
              dimmed={state.mode === 'manual' && index > state.step}
              itemsById={itemsById}
              onSelect={(optionIndex) =>
                dispatch({ type: 'select', layer, index: optionIndex })
              }
              onToggleLock={() => dispatch({ type: 'toggleLock', layer })}
            />
          ))}
        </div>

        <div className={styles.keys}>
          {[
            { cap: '← →', label: 'cycle layer' },
            { cap: '↑ ↓', label: 'change layer' },
            { cap: 'space', label: 'lock / unlock' },
            { cap: 'R', label: 'reshuffle open' },
            {
              cap: '⏎',
              label: state.mode === 'manual' ? 'confirm layer' : 'save fit',
            },
          ].map((hint) => (
            <span key={hint.cap} className={styles.keyHint}>
              <kbd className={styles.cap}>{hint.cap}</kbd>
              <span className={styles.capLabel}>{hint.label}</span>
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
