import { emptyOverlay, type Overlay } from './overlay';
import type { WardrobeRepository } from './repository';

export function createMemoryRepository(initial: Overlay = emptyOverlay()): WardrobeRepository {
  let overlay = initial;
  return {
    load: () => overlay,
    save: (next) => {
      overlay = next;
    },
    clear: () => {
      overlay = emptyOverlay();
    },
  };
}
