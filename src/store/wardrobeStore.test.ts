import { describe, expect, it } from 'vitest';
import { createMemoryRepository } from '~/data/memoryRepository';
import { SEED_ITEMS } from '~/data/seed/items';
import { testItem } from '~/domain/testItems';
import type { Outfit } from '~/domain/outfits';
import { createWardrobeStore } from './wardrobeStore';

/**
 * The store is exercised against the in-memory repository, which is the reason
 * WardrobeRepository is an interface: none of this touches localStorage.
 */
function setup() {
  const repository = createMemoryRepository();
  const store = createWardrobeStore(repository);
  return { repository, store, state: () => store.getState() };
}

const FIT: Outfit = {
  id: 'mine',
  name: 'Untitled fit',
  date: '2026-09-01',
  top: 't1',
  outer: null,
  bottom: 'b1',
  shoes: 's1',
};

describe('the wardrobe store', () => {
  it('starts on the seed wardrobe when the browser holds nothing', () => {
    const { state } = setup();
    expect(state().items).toHaveLength(SEED_ITEMS.length);
  });

  it('adds an item and persists it through the repository', () => {
    const { repository, state } = setup();
    state().addItem(testItem('new', { name: 'Navy cotton tee' }));

    expect(state().items[0]?.name).toBe('Navy cotton tee');
    expect(repository.load().addedItems).toHaveLength(1);
  });

  it('tombstones a seed item rather than trying to delete a fixture', () => {
    const { repository, state } = setup();
    state().removeItem('t1');

    expect(state().items.some((item) => item.id === 't1')).toBe(false);
    expect(repository.load().removedItemIds).toEqual(['t1']);
  });

  it('removes an added item outright, without leaving a tombstone for it', () => {
    const { repository, state } = setup();
    state().addItem(testItem('new'));
    state().removeItem('new');

    expect(repository.load().addedItems).toHaveLength(0);
  });

  it('does not record the same tombstone twice', () => {
    const { repository, state } = setup();
    state().removeItem('t1');
    state().removeItem('t1');

    expect(repository.load().removedItemIds).toEqual(['t1']);
  });

  it('hides a saved fit once one of its garments is removed', () => {
    const { state } = setup();
    state().saveOutfit(FIT);
    expect(state().outfits[0]?.id).toBe('mine');

    state().removeItem('t1');
    expect(state().outfits.some((fit) => fit.id === 'mine')).toBe(false);
  });

  it('restores the seeded wardrobe on reset, tombstones included', () => {
    const { repository, state } = setup();
    state().addItem(testItem('new'));
    state().removeItem('t1');
    state().saveOutfit(FIT);

    state().reset();

    expect(state().items).toHaveLength(SEED_ITEMS.length);
    expect(state().items.some((item) => item.id === 't1')).toBe(true);
    expect(repository.load().addedItems).toHaveLength(0);
    expect(repository.load().removedItemIds).toHaveLength(0);
  });
});
