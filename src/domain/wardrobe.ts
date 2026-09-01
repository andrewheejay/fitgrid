import type { Item } from './items';
import { LAYERS, layerName, type Layer } from './layers';

export type WardrobeFilter = 'all' | Layer;
export type WardrobeSort = 'recent' | 'worn' | 'aesthetic';

export interface FilterChip {
  id: WardrobeFilter;
  label: string;
  /** Derived at render time. Hardcoding these made them stale immediately. */
  count: number;
}

export function filterChips(items: readonly Item[]): FilterChip[] {
  return [
    { id: 'all' as const, label: 'All', count: items.length },
    ...LAYERS.map((layer) => ({
      id: layer,
      label: pluralLayer(layer),
      count: items.filter((item) => item.category === layer).length,
    })),
  ];
}

/** "Tops", "Bottoms", "Shoes" — Outerwear is already plural. */
function pluralLayer(layer: Layer): string {
  const name = layerName(layer);
  return layer === 'outer' || layer === 'shoes' ? name : `${name}s`;
}

export const SORTS: ReadonlyArray<{ id: WardrobeSort; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'worn', label: 'Most worn' },
  { id: 'aesthetic', label: 'Aesthetic' },
];

export function applyFilter(items: readonly Item[], filter: WardrobeFilter): Item[] {
  return filter === 'all' ? [...items] : items.filter((item) => item.category === filter);
}

export function applySort(items: readonly Item[], sort: WardrobeSort): Item[] {
  const sorted = [...items];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    case 'worn':
      return sorted.sort((a, b) => b.wornCount - a.wornCount);
    case 'aesthetic':
      // Groups workwear / quiet / casual / utility / sport together.
      return sorted.sort(
        (a, b) => a.aesthetic.localeCompare(b.aesthetic) || a.name.localeCompare(b.name),
      );
  }
}

export function visibleItems(
  items: readonly Item[],
  filter: WardrobeFilter,
  sort: WardrobeSort,
): Item[] {
  return applySort(applyFilter(items, filter), sort);
}

/** "18 items · tagged automatically" */
export function wardrobeSubtitle(count: number): string {
  return `${count} item${count === 1 ? '' : 's'} · tagged automatically`;
}
