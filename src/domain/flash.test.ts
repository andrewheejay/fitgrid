import { describe, expect, it } from 'vitest';
import { flashMessage } from './flash';

/**
 * The strings are specified verbatim in the design handoff. Asserting them here
 * means a copy change is a deliberate edit to a failing test, not a silent
 * drift away from the spec.
 */
describe('flashMessage', () => {
  it('names the layer in uppercase when locking', () => {
    expect(flashMessage({ kind: 'locked', layer: 'top' })).toBe('TOP locked');
    expect(flashMessage({ kind: 'unlocked', layer: 'top' })).toBe('TOP unlocked');
  });

  it('explains how to get out of a locked layer', () => {
    expect(flashMessage({ kind: 'alreadyLocked', layer: 'top' })).toBe(
      'TOP is locked — space to unlock',
    );
  });

  it('uses the outerwear display name, not the layer key', () => {
    expect(flashMessage({ kind: 'locked', layer: 'outer' })).toBe('OUTERWEAR locked');
  });

  it('reports a reshuffle and a save', () => {
    expect(flashMessage({ kind: 'reshuffled' })).toBe('Reshuffled everything unlocked');
    expect(flashMessage({ kind: 'saved' })).toBe('Saved to fits');
  });
});
