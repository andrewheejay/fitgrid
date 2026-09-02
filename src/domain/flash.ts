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
  | { kind: 'rerolled'; layer: Layer }
  | { kind: 'saved' };

/**
 * @param coarse Whether the visitor is on a touch screen. Only one message
 * differs, and it differs because it names the way out of a locked layer —
 * which on a phone is not the space bar. A message that tells someone to press
 * a key they do not have reads as the screen being broken, the same way the
 * deck's keycap legend did.
 */
export function flashMessage(flash: Flash, coarse = false): string {
  switch (flash.kind) {
    case 'locked':
      return `${layerName(flash.layer).toUpperCase()} locked`;
    case 'unlocked':
      return `${layerName(flash.layer).toUpperCase()} unlocked`;
    case 'alreadyLocked':
      return coarse
        ? `${layerName(flash.layer).toUpperCase()} is locked — tap Locked to unlock`
        : `${layerName(flash.layer).toUpperCase()} is locked — space to unlock`;
    case 'reshuffled':
      return 'Reshuffled everything unlocked';
    case 'rerolled':
      return `${layerName(flash.layer).toUpperCase()} rerolled`;
    case 'saved':
      return 'Saved to fits';
  }
}

/** A flash clears itself after this long; a new one resets the timer. */
export const FLASH_DURATION_MS = 2200;
