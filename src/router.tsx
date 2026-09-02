import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { App } from './App';
import { AddItemScreen } from './screens/add-item/AddItemScreen';
import { DeckScreen } from './screens/deck/DeckScreen';
import { FitsScreen } from './screens/fits/FitsScreen';
import { ItemDetailScreen } from './screens/item-detail/ItemDetailScreen';
import { WardrobeScreen } from './screens/wardrobe/WardrobeScreen';

const rootRoute = createRootRoute({ component: App });

/**
 * The wardrobe is the site's front page, so it lives at the root rather than
 * redirecting there from it. Landing on fitgrid.xyz should not bounce the
 * visitor to a second URL before anything is drawn.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: WardrobeScreen,
});

/**
 * Where the wardrobe used to live. Kept as a redirect rather than deleted:
 * this path has been linked and bookmarked, and a dead URL is a worse answer
 * than a moved one. Item detail keeps the segment — `/wardrobe/t1` says what
 * it is far better than a bare id at the root would, and a catch-all `/$itemId`
 * could not be told apart from `/deck` or `/fits`.
 */
const wardrobeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wardrobe',
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});

const itemDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wardrobe/$itemId',
  component: ItemDetailScreen,
});

const deckRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deck',
  component: DeckScreen,
  /**
   * "Lock into a fit" on item detail arrives here with the item pre-locked
   * into its layer.
   */
  validateSearch: (search: Record<string, unknown>): { lock?: string } => {
    const lock = search['lock'];
    return typeof lock === 'string' ? { lock } : {};
  },
});

const fitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fits',
  component: FitsScreen,
});

const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/add',
  component: AddItemScreen,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  wardrobeRoute,
  itemDetailRoute,
  deckRoute,
  fitsRoute,
  addRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
