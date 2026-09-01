import { useNavigate } from '@tanstack/react-router';
import { Button } from '~/components/Button';
import { useWardrobe } from '~/store/wardrobeStore';
import styles from './EmptyWardrobe.module.css';

/**
 * Reachable two ways, both real: remove every item, or reset the demo. It is
 * never the first thing a visitor sees — see WardrobeScreen.
 */
export function EmptyWardrobe() {
  const navigate = useNavigate();
  const reset = useWardrobe((state) => state.reset);

  return (
    <main className={styles.empty}>
      <div className={styles.mark} aria-hidden="true" />
      <h1 className={styles.title}>Nothing in the closet yet</h1>
      <p className={styles.body}>
        Scan five care labels, or forward one order email. That is enough for Fitgrid to start
        proposing fits.
      </p>
      <div className={styles.actions}>
        <Button onClick={() => navigate({ to: '/add' })}>Scan first label</Button>
        {/*
          The prototype's "Skip for now" returned to a wardrobe that still had
          items in it. Here an empty closet is really empty, so the second
          action restores the seeded one instead of going nowhere.
        */}
        <Button variant="secondary" onClick={reset}>
          Restore the demo wardrobe
        </Button>
      </div>
    </main>
  );
}
