import { loadBitmap } from '../cutout';
import { hostname, imageCandidates, ListingUnreadable, type Listing } from './parse';

const IMAGE_TIMEOUT_MS = 6_000;

/**
 * Try each CORS route in turn; the listing is only usable if one works.
 *
 * A shop can publish a perfectly good listing and still refuse everyone the
 * pixels — Uniqlo does exactly that — so this fails the same way an unreadable
 * page does, and lands on the same card.
 */
export async function loadListingImage(listing: Listing): Promise<ImageBitmap> {
  for (const candidate of imageCandidates(listing.imageUrl)) {
    try {
      return await loadBitmap(candidate, IMAGE_TIMEOUT_MS);
    } catch {
      // Each route fails for its own reason; only the last one is news.
    }
  }
  throw new ListingUnreadable(
    `Fitgrid read the listing, but ${hostname(listing.url)} would not hand over the photo.`,
  );
}
