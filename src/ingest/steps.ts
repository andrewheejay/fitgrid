export type StepStatus = 'pending' | 'running' | 'done';

export interface PipelineStep {
  label: string;
  /** The mono note column — how the visitor learns what the system is doing. */
  note: string;
}

/**
 * Catalogue lookup. Simulated: resolving a brand and SKU needs commercial
 * product data or a per-brand scraper set, which this build does not have.
 */
export const CATALOGUE_STEPS: readonly PipelineStep[] = [
  { label: 'Read source', note: 'label / link / receipt' },
  { label: 'Catalogue lookup', note: 'brand + SKU match' },
  { label: 'Pull studio image', note: 'official product shot' },
  { label: 'File into wardrobe', note: 'tagged and dated' },
];

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
