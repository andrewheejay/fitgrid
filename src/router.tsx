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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/wardrobe' });
  },
});

const wardrobeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wardrobe',
  component: WardrobeScreen,
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
