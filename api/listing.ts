import { parseProductHtml, toListing, type Listing } from '../src/ingest/listing/parse';
import { checkOutboundUrl } from './_lib/guard';
import { store, type Outcome } from './_lib/db';
import { clientKey, json } from './_lib/http';
import { CACHE_TTL_MS, isFresh, isOverLimit, retryAfterSeconds } from './_lib/policy';
import { bodyWithin, Refused, safeFetch } from './_lib/outbound';
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
 * That is deliberate: `npm run dev` with no secrets behaves exactly as before,
 * where this file is not running at all and Vite answers the path with the SPA
 * shell, which the client discards as unparseable.
 *
 * A database that is down throws rather than returning, which reaches the
 * client as a 500 — also a non-200, also a fall-through. There is nothing to
 * catch here that would serve the visitor better.
 */
// Both together, plus the database's own connect timeout, have to fit inside
// the function's ceiling (30s in vercel.json) with room to spare — and inside
// the client's budget for this reader (26s in read.ts), or the browser hangs
// up on an answer that was coming. 6 + 15 + 5 leaves both.
const DIRECT_TIMEOUT_MS = 6_000;
const SCRAPE_TIMEOUT_MS = 15_000;

/*
 * Exported as GET rather than as a default function: Vercel's Node runtime
 * reads a default-exported *function* as the legacy (req, res) handler and
 * would call this with an IncomingMessage, whose `url` is a bare path that
 * `new URL()` refuses. A named method export is the Web-signature form, and it
 * also says out loud that this endpoint answers one verb.
 */
export async function GET(request: Request): Promise<Response> {
  const asked = new URL(request.url).searchParams.get('url');
  if (!asked) return json({ error: 'url is required' }, 400);

  // Ruled on before anything is spent: a refusal here costs no rate slot and
  // no database round trip. The parsed form is also what the cache is keyed
  // on, so two spellings of one address are one entry rather than two.
  const verdict = checkOutboundUrl(asked);
  if (!verdict.ok) return json({ error: verdict.reason }, 400);
  const target = verdict.url.toString();
  const host = verdict.url.hostname;

  const db = store();
  if (!db) return json({ error: 'server ingest is not configured' }, 503);

  const started = Date.now();

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

  try {
    const direct = await read(target, (url) => text(url, DIRECT_TIMEOUT_MS));
    if (direct) {
      await db.save(target, direct);
      return done(direct, 'direct');
    }
  } catch (caught) {
    // A refusal is the visitor's answer — a redirect into private space, or a
    // page too large to be a page. Neither is a reason to spend a credit
    // asking someone else's proxy for the same thing.
    if (caught instanceof Refused) return done(null, 'refused', 400);
  }

  const paid = scraper();
  if (paid && (await db.scrapesToday()) < paid.dailyCap) {
    try {
      const scraped = await read(target, (url) => paid.fetchHtml(url, SCRAPE_TIMEOUT_MS));
      if (scraped) {
        await db.save(target, scraped);
        return done(scraped, 'scraper');
      }
    } catch {
      // Fall through: an unreadable page and a scraper having a bad minute
      // reach the visitor as the same thing, and the log tells them apart.
    }
    // The credit is spent whether or not a listing came back, and this row is
    // what tomorrow's cap is counted from — so it is written on the way out,
    // before the 404 below logs the outcome the visitor actually saw.
    await db.log(host, 'scraper', Date.now() - started);
  }

  return done(null, 'unreadable', 404);
}

/** Fetch by whichever route, then apply the same parser to whatever came back. */
async function read(
  url: string,
  fetchHtml: (url: string) => Promise<string>,
): Promise<Listing | null> {
  return toListing(parseProductHtml(await fetchHtml(url), url), url, 'server');
}

async function text(url: string, timeoutMs: number): Promise<string> {
  const response = await safeFetch(url, timeoutMs);
  if (!response.ok) throw new Error(`site returned ${response.status}`);
  return new TextDecoder().decode(await bodyWithin(response));
}

