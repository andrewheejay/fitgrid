import postgres from 'postgres';
import type { Listing } from '../../src/ingest/listing/parse.js';
import { RATE_WINDOW_MS, type RateWindow } from './policy.js';
import { CACHED_LISTING, LOG_INGEST, SAVE_LISTING, SCRAPES_TODAY, TAKE_SLOT } from './sql.js';

/**
 * The three tables, behind five methods.
 *
 * `store()` answers null when POSTGRES_URL is unset, and every caller treats
 * that as "no server side today" rather than an error. That is what keeps
 * `npm run dev` working with no secrets at all: the endpoint bows out and the
 * browser's own reader chain — which predates this and still ships — handles
 * the request exactly as it did before.
 */
export interface CachedListing {
  listing: Listing;
  fetchedAt: number;
}

export type Outcome = 'cache' | 'direct' | 'scraper' | 'unreadable' | 'refused';

export interface Store {
  cached: (url: string) => Promise<CachedListing | null>;
  save: (url: string, listing: Listing) => Promise<void>;
  log: (host: string, outcome: Outcome, ms: number) => Promise<void>;
  /** Counts this request against the client's window and returns the result. */
  takeSlot: (client: string) => Promise<RateWindow>;
  scrapesToday: () => Promise<number>;
}

type Sql = postgres.Sql;

/**
 * One connection pool per warm container, not per request.
 *
 * A serverless function is re-entered many times on the same process, and
 * opening a pool each time exhausts the database's connection limit long
 * before it exhausts anything of ours. `max: 1` because concurrency is per
 * container anyway — the platform starts another container, not another
 * connection.
 *
 * `connect_timeout` is short because it is spent before any of the request's
 * real work: added to the fetch budgets in listing.ts it still has to fit
 * inside the function's ceiling. `prepare: false` because a pooled connection
 * string usually means pgbouncer in transaction mode, which has no place to
 * keep a named statement.
 */
let pool: Sql | null | undefined;

function connect(): Sql | null {
  if (pool !== undefined) return pool;
  const url = process.env['POSTGRES_URL'];
  pool = url
    ? postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 5, prepare: false })
    : null;
  return pool;
}

/**
 * `sql.unsafe` names the fact that the query text is ours rather than the
 * driver's tagged template — it is not a raw string with values in it. Every
 * value below still travels as a bound parameter, and the text comes from a
 * module constant that a test executes verbatim.
 */
export function store(): Store | null {
  const sql = connect();
  if (!sql) return null;

  return {
    async cached(url) {
      const rows = await sql.unsafe<{ listing: Listing; fetched_at: Date }[]>(CACHED_LISTING, [url]);
      const row = rows[0];
      return row ? { listing: row.listing, fetchedAt: row.fetched_at.getTime() } : null;
    },

    async save(url, listing) {
      await sql.unsafe(SAVE_LISTING, [url, JSON.stringify(listing)]);
    },

    async log(host, outcome, ms) {
      await sql.unsafe(LOG_INGEST, [host, outcome, ms]);
    },

    async takeSlot(client) {
      const rows = await sql.unsafe<{ count: number; started_at: Date }[]>(TAKE_SLOT, [
        client,
        RATE_WINDOW_MS / 1000,
      ]);
      const row = rows[0];
      // The insert always returns a row; the fallback keeps the type honest.
      return row
        ? { count: Number(row.count), startedAt: row.started_at.getTime() }
        : { count: 1, startedAt: Date.now() };
    },

    async scrapesToday() {
      const rows = await sql.unsafe<{ count: string }[]>(SCRAPES_TODAY, []);
      return Number(rows[0]?.count ?? 0);
    },
  };
}
