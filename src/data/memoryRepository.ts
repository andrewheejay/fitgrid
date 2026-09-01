import { emptyOverlay } from './overlay';
import type { WardrobeRepository } from './repository';

export function createMemoryRepository(): WardrobeRepository {
  let overlay = emptyOverlay();
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
