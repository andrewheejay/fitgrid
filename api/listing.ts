import {
  htmlTitle,
  parseProductHtml,
  toListing,
  type Listing,
} from '../src/ingest/listing/parse.js';
import { checkOutboundUrl } from './_lib/guard.js';
import { store, type Outcome } from './_lib/db.js';
import { clientKey, json } from './_lib/http.js';
import { CACHE_TTL_MS, isFresh, isOverLimit, retryAfterSeconds } from './_lib/policy.js';
import { bodyWithin, Refused, safeFetch } from './_lib/outbound.js';
import { scraper } from './_lib/scrape.js';

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
    const direct = toListing(
      parseProductHtml(await text(target, DIRECT_TIMEOUT_MS), target),
      target,
      'server',
    );
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
      const html = await paid.fetchHtml(target, SCRAPE_TIMEOUT_MS);
      const scraped = toListing(parseProductHtml(html, target), target, 'server');
      if (scraped) {
        await db.save(target, scraped);
        return done(scraped, 'scraper');
      }
      // A page came back and cost a credit; it just had no product in it. Its
      // title is the cheapest way to tell "Attention Required!" — the shop
      // beat the proxy — from a real product page this parser cannot read,
      // which are two entirely different problems.
      await db.log(host, 'scraper', Date.now() - started, `no product in: ${htmlTitle(html)}`);
    } catch (caught) {
      // The provider refused, or the page never arrived. Not counted against
      // the cap, because a request that fails is not one that was billed — and
      // recorded with its reason, because a paid leg whose failures are
      // swallowed can only be debugged by spending another credit guessing.
      await db.log(host, 'scraper-failed', Date.now() - started, reason(caught));
    }
  }

  return done(null, 'unreadable', 404);
}

function reason(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

async function text(url: string, timeoutMs: number): Promise<string> {
  const response = await safeFetch(url, timeoutMs);
  if (!response.ok) throw new Error(`site returned ${response.status}`);
  return new TextDecoder().decode(await bodyWithin(response));
}

