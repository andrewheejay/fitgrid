import postgres from 'postgres';
import type { Listing } from '../../src/ingest/listing/parse';
import { RATE_WINDOW_MS, type RateWindow } from './policy';

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
 */
let pool: Sql | null | undefined;

function connect(): Sql | null {
  if (pool !== undefined) return pool;
  const url = process.env['POSTGRES_URL'];
  pool = url
    ? postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false })
    : null;
  return pool;
}

export function store(): Store | null {
  const sql = connect();
  if (!sql) return null;

  return {
    async cached(url) {
      const rows = await sql<{ listing: Listing; fetched_at: Date }[]>`
        select listing, fetched_at from listing_cache where url = ${url}
      `;
      const row = rows[0];
      return row ? { listing: row.listing, fetchedAt: row.fetched_at.getTime() } : null;
    },

    async save(url, listing) {
      await sql`
        insert into listing_cache (url, listing, fetched_at)
        values (${url}, ${sql.json(listing as never)}, now())
        on conflict (url) do update
          set listing = excluded.listing, fetched_at = excluded.fetched_at
      `;
    },

    async log(host, outcome, ms) {
      await sql`insert into ingest_log (host, outcome, ms) values (${host}, ${outcome}, ${ms})`;
    },

    /**
     * The window rolls over inside the statement rather than in JavaScript.
     * Read-then-write would let two requests read the same count and both
     * conclude they were under the limit, which is precisely the case a rate
     * limiter exists for.
     */
    async takeSlot(client) {
      const cutoff = `${RATE_WINDOW_MS} milliseconds`;
      const rows = await sql<{ count: number; started_at: Date }[]>`
        insert into rate_window (client, count, started_at)
        values (${client}, 1, now())
        on conflict (client) do update set
          count = case
            when rate_window.started_at < now() - ${cutoff}::interval then 1
            else rate_window.count + 1
          end,
          started_at = case
            when rate_window.started_at < now() - ${cutoff}::interval then now()
            else rate_window.started_at
          end
        returning count, started_at
      `;
      const row = rows[0];
      // The insert always returns a row; the fallback keeps the type honest.
      return row
        ? { count: row.count, startedAt: row.started_at.getTime() }
        : { count: 1, startedAt: Date.now() };
    },

    async scrapesToday() {
      const rows = await sql<{ count: string }[]>`
        select count(*) from ingest_log where outcome = 'scraper' and at > now() - interval '1 day'
      `;
      return Number(rows[0]?.count ?? 0);
    },
  };
}
