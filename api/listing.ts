import { hostname, parseProductHtml, toListing, type Listing } from '../src/ingest/listing/parse';
import { store, type Outcome } from './_lib/db';
import { clientKey, json } from './_lib/http';
import { CACHE_TTL_MS, isFresh, isOverLimit, retryAfterSeconds } from './_lib/policy';
import { Refused, safeFetch } from './_lib/outbound';
import { scraper } from './_lib/scrape';

/**
 * Read a product page server-side.
 *
 * The browser already has a reader chain, and it still ships — this endpoint
 * goes in front of it, not instead of it. What it adds is the two things a tab
 * cannot do: a cache shared by everyone who pastes the same link, and a rented
 * residential proxy for the shops that refuse data-centre traffic outright.
 *
 * Everything here degrades to a status the client already handles. No
 * database, no key, over the limit, page unreadable — each is a non-200, and a
 * non-200 sends the visitor back down the browser chain that predates this.
 * That is deliberate: `npm run dev` with no secrets behaves exactly as before.
 */
// Both together have to fit inside the function's own ceiling (vercel.json),
// or the platform kills the request instead of the code answering it.
const DIRECT_TIMEOUT_MS = 6_000;
const SCRAPE_TIMEOUT_MS = 18_000;

export default async function handler(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) return json({ error: 'url is required' }, 400);

  const db = store();
  if (!db) return json({ error: 'server ingest is not configured' }, 503);

  const started = Date.now();
  const host = hostname(target);

  const window = await db.takeSlot(clientKey(request));
  if (isOverLimit(window)) {
    return json({ error: 'too many requests' }, 429, {
      'retry-after': String(retryAfterSeconds(window, Date.now())),
    });
  }

  const done = async (listing: Listing | null, outcome: Outcome, status = 200) => {
    await db.log(host, outcome, Date.now() - started);
    return listing
      ? // A listing is public product data, and the database above is the real
        // cache; this only spares the CDN a round trip for a link doing the
        // rounds.
        json({ listing }, status, { 'cache-control': `public, max-age=${CACHE_TTL_MS / 1000}` })
      : json({ error: outcome }, status);
  };

  const hit = await db.cached(target);
  if (hit && isFresh(hit.fetchedAt, Date.now())) return done(hit.listing, 'cache');

  let refusal: Refused | null = null;
  try {
    const direct = await read(target, (url) => text(url, DIRECT_TIMEOUT_MS), 'server');
    if (direct) {
      await db.save(target, direct);
      return done(direct, 'direct');
    }
  } catch (caught) {
    // A guard refusal is the visitor's answer, not a reason to spend a credit
    // trying the same address through someone else's proxy.
    if (caught instanceof Refused) refusal = caught;
  }
  if (refusal) return done(null, 'refused', 400);

  const paid = scraper();
  if (paid && (await db.scrapesToday()) < paid.dailyCap) {
    try {
      const scraped = await read(target, (url) => paid.fetchHtml(url, SCRAPE_TIMEOUT_MS), 'server');
      if (scraped) {
        await db.save(target, scraped);
        return done(scraped, 'scraper');
      }
    } catch {
      // Fall through: an unreadable page and a scraper having a bad minute
      // reach the visitor as the same thing, and the log tells them apart.
    }
    await db.log(host, 'scraper', Date.now() - started);
  }

  return done(null, 'unreadable', 404);
}

/** Fetch by whichever route, then apply the same parser to whatever came back. */
async function read(
  url: string,
  fetchHtml: (url: string) => Promise<string>,
  via: 'server',
): Promise<Listing | null> {
  return toListing(parseProductHtml(await fetchHtml(url), url), url, via);
}

async function text(url: string, timeoutMs: number): Promise<string> {
  const response = await safeFetch(url, timeoutMs);
  if (!response.ok) throw new Error(`site returned ${response.status}`);
  return response.text();
}

