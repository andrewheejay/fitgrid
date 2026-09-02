import { Link, useRouterState } from '@tanstack/react-router';
import { useWeather } from '~/hooks/useWeather';
import styles from './Header.module.css';

const NAV = [
  { label: 'Wardrobe', to: '/' },
  { label: 'Style', to: '/deck' },
  { label: 'Add', to: '/add' },
  { label: 'Fits', to: '/fits' },
] as const;

interface HeaderProps {
  onReset: () => void;
}

export function Header({ onReset }: HeaderProps) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const weather = useWeather();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.wordmark}>Fitgrid</span>
        <nav className={styles.nav}>
          {NAV.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              className={`${styles.navItem} ${isActive(path, entry.to) ? styles.navActive : ''}`}
              aria-current={isActive(path, entry.to) ? 'page' : undefined}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.right}>
        <div className={styles.weather}>
          <span className={styles.weatherDot} aria-hidden="true" />
          <span>{weather.summary}</span>
          <span className={styles.separator} aria-hidden="true">
            /
          </span>
          <span>{weather.city}</span>
        </div>

        <button
          type="button"
          className={styles.account}
          onClick={onReset}
          /*
           * The visible text is not a verb, so the accessible name has to
           * contain it — otherwise speech-input users cannot say what they see.
           */
          aria-label="reset@fitgrid — reset this demo"
        >
          reset@fitgrid
        </button>
      </div>
    </header>
  );
}

/**
 * Item detail keeps Wardrobe marked active. Wardrobe is the root now, so the
 * test cannot be a prefix match — every path starts with "/" — and item detail
 * still sits under the old segment.
 */
function isActive(path: string, to: string): boolean {
  return to === '/' ? path === '/' || path.startsWith('/wardrobe') : path === to;
}
