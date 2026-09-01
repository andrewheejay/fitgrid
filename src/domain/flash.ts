import { layerName, type Layer } from './layers';

/**
 * Deck flash messages are structured values, not strings. The reducer emits
 * intent; this module owns the copy. That keeps the reducer free of
 * presentation and puts every user-visible string from the handoff in one
 * place where it can be checked against the spec verbatim.
 */
export type Flash =
  | { kind: 'locked'; layer: Layer }
  | { kind: 'unlocked'; layer: Layer }
  | { kind: 'alreadyLocked'; layer: Layer }
  | { kind: 'reshuffled' }
  | { kind: 'saved' };

export function flashMessage(flash: Flash): string {
  switch (flash.kind) {
    case 'locked':
      return `${layerName(flash.layer).toUpperCase()} locked`;
    case 'unlocked':
      return `${layerName(flash.layer).toUpperCase()} unlocked`;
    case 'alreadyLocked':
      return `${layerName(flash.layer).toUpperCase()} is locked — space to unlock`;
    case 'reshuffled':
      return 'Reshuffled everything unlocked';
    case 'saved':
      return 'Saved to fits';
  }
}

/** A flash clears itself after this long; a new one resets the timer. */
export const FLASH_DURATION_MS = 2200;
