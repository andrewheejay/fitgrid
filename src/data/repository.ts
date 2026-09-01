import type { Overlay } from './overlay';

/**
 * Everything the app persists, behind one interface — so tests run against an
 * in-memory implementation and never touch a browser API.
 */
export interface WardrobeRepository {
  load(): Overlay;
  save(overlay: Overlay): void;
  clear(): void;
}
