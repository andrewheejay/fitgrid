export type StepStatus = 'pending' | 'running' | 'done';

export interface PipelineStep {
  label: string;
  /** The mono note column — how the visitor learns what the system is doing. */
  note: string;
}

/**
 * The image drop. Every step here is real work in the browser.
 *
 * The prototype's fourth step read "Vision tagging + index — Gemini → Pinecone".
 * There is no Gemini and no Pinecone in this build, so the note column does not
 * claim otherwise; the handoff explicitly permits swapping the model names
 * while keeping the four-step shape.
 */
export const CUTOUT_STEPS: readonly PipelineStep[] = [
  { label: 'Fetch image', note: 'file or url' },
  { label: 'Background removal', note: 'RMBG-1.4, in your browser' },
  { label: 'Trim + centre on canvas', note: 'even padding' },
  { label: 'Palette + tagging', note: 'colours from the cut-out' },
];

/**
 * The pasted link. Real work, but not a catalogue lookup: nothing here
 * resolves a SKU from a brand database. It reads the metadata the page
 * publishes about itself, takes the studio image that metadata points at, and
 * cuts it out in the browser like any other image.
 */
export const LINK_STEPS: readonly PipelineStep[] = [
  { label: 'Read listing', note: 'opengraph + schema.org' },
  { label: 'Pull studio image', note: 'from the listing' },
  { label: 'Background removal', note: 'RMBG-1.4, in your browser' },
  { label: 'Trim + palette', note: 'colours from the cut-out' },
];
