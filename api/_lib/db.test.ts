import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CACHED_LISTING, LOG_INGEST, SAVE_LISTING, SCRAPES_TODAY, TAKE_SLOT } from './sql';

/**
 * The SQL, against a real Postgres.
 *
 * PGlite is Postgres compiled to WebAssembly, so this needs no server, no
 * container and no connection string — which is the only reason these
 * statements are tested at all rather than discovered on a deploy. The strings
 * here are imported, not retyped, so the test cannot drift from what runs.
 */
const SCHEMA = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');
const WINDOW_SECONDS = 600;

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
});

const listing = {
  url: 'https://shop.example/tee',
  name: 'Boxy tee',
  imageUrl: 'https://cdn.example/tee.jpg',
  via: 'server',
};

describe('the schema', () => {
  it('applies to an empty database', async () => {
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'ingest_log',
      'listing_cache',
      'rate_window',
    ]);
  });
});

describe('the listing cache', () => {
  it('reads back what it stored, with a real timestamp', async () => {
    await db.query(SAVE_LISTING, [listing.url, JSON.stringify(listing)]);
    const { rows } = await db.query<{ listing: typeof listing; fetched_at: Date }>(CACHED_LISTING, [
      listing.url,
    ]);
    expect(rows[0]?.listing).toEqual(listing);
    expect(rows[0]?.fetched_at).toBeInstanceOf(Date);
  });

  it('replaces an entry rather than collecting duplicates of one url', async () => {
    await db.query(SAVE_LISTING, [listing.url, JSON.stringify(listing)]);
    await db.query(SAVE_LISTING, [listing.url, JSON.stringify({ ...listing, name: 'Renamed' })]);

    const { rows } = await db.query<{ listing: typeof listing }>(CACHED_LISTING, [listing.url]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.listing.name).toBe('Renamed');
  });

  it('answers nothing for a url it has never seen', async () => {
    const { rows } = await db.query(CACHED_LISTING, ['https://shop.example/other']);
    expect(rows).toHaveLength(0);
  });
});

describe('the rate window', () => {
  const take = async () =>
    (await db.query<{ count: number }>(TAKE_SLOT, ['1.2.3.4', WINDOW_SECONDS])).rows[0]?.count;

  it('opens at one and counts up', async () => {
    expect(await take()).toBe(1);
    expect(await take()).toBe(2);
    expect(await take()).toBe(3);
  });

  it('rolls over once the window has elapsed', async () => {
    await take();
    await take();
    await db.query(`update rate_window set started_at = now() - interval '20 minutes'`);
    expect(await take()).toBe(1);
  });

  it('keeps two clients apart', async () => {
    await take();
    await take();
    const other = await db.query<{ count: number }>(TAKE_SLOT, ['5.6.7.8', WINDOW_SECONDS]);
    expect(other.rows[0]?.count).toBe(1);
  });

  // The reason the rollover is SQL and not JavaScript: a read-then-write would
  // hand both of these the same count, and both would pass the limit check.
  it('gives concurrent requests distinct counts', async () => {
    await take();
    const [a, b] = await Promise.all([take(), take()]);
    expect([a, b].sort()).toEqual([2, 3]);
  });
});

describe('the ingest log', () => {
  it('counts only the scraper calls the cap is meant to ration', async () => {
    await db.query(LOG_INGEST, ['nike.com', 'scraper', 812]);
    await db.query(LOG_INGEST, ['nike.com', 'cache', 4]);
    await db.query(LOG_INGEST, ['uniqlo.com', 'scraper', 1503]);

    const { rows } = await db.query<{ count: string }>(SCRAPES_TODAY);
    expect(Number(rows[0]?.count)).toBe(2);
  });

  it('ignores what was spent yesterday', async () => {
    await db.query(LOG_INGEST, ['nike.com', 'scraper', 812]);
    await db.query(`update ingest_log set logged_at = now() - interval '2 days'`);

    const { rows } = await db.query<{ count: string }>(SCRAPES_TODAY);
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
