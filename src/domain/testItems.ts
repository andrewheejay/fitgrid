import type { Item } from './items';
import type { Category } from './layers';

/** A minimal item, overridable per test. Not shipped in any screen. */
export function testItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    category: 'top' as Category,
    name: `Item ${id}`,
    silhouette: 'boxy',
    texture: 'cotton',
    aesthetic: 'casual',
    tone: '#8a8a8a',
    palette: ['#8a8a8a', '#d4d4d4', '#3a3a3a'],
    addedAt: '2026-02-01',
    wornCount: 0,
    source: 'image',
    ...overrides,
  };
}
