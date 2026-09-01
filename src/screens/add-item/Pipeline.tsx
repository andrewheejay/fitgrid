import type { PipelineStep, StepStatus } from '~/ingest/steps';
import styles from './Pipeline.module.css';

interface PipelineProps {
  steps: readonly PipelineStep[];
  statuses: readonly StepStatus[];
  /** Overrides the note for the running step, e.g. a real percentage. */
  runningNote?: string;
  started: boolean;
}

export function Pipeline({ steps, statuses, runningNote, started }: PipelineProps) {
  return (
    <div className={styles.pipeline}>
      {steps.map((step, index) => {
        const status = statuses[index] ?? 'pending';
        const active = started && status !== 'pending';

        return (
          <div key={step.label} className={`${styles.step} ${active ? styles.active : ''}`}>
            <span className={`${styles.square} ${styles[status] ?? ''}`} />
            <span className={styles.label}>{step.label}</span>
            <span className={styles.note}>{noteFor(step, status, runningNote)}</span>
          </div>
        );
      })}
    </div>
  );
}

function noteFor(step: PipelineStep, status: StepStatus, runningNote?: string): string {
  if (status === 'done') return 'done';
  if (status === 'running') return runningNote ?? 'running';
  return step.note;
}
