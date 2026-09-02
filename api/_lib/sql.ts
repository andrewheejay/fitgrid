/**
 * Every statement the server runs, in one file, as text.
 *
 * They live here rather than inside the driver's tagged templates so that the
 * string the test executes is the string production executes. `db.test.ts`
 * applies `db/schema.sql` to a real Postgres — compiled to WebAssembly, so it
 * needs nothing installed — and runs these against it. Without that, "the
 * database integration works" would be a claim resting on a deploy.
 *
 * Placeholders are $n and the values are passed separately; nothing is
 * interpolated into these strings. They carry explicit casts because a driver
 * is free to send a parameter untyped and let the server sort it out.
 *
 * The casts do not make every value safe on their own — a driver still decides
 * how it encodes what it is given, and encoding a listing twice stores it as a
 * jsonb string rather than an object. That is what `jsonb_typeof` is asserted
 * on in the tests.
 */

export const CACHED_LISTING = `
  select listing, fetched_at from listing_cache where url = $1
`;

export const SAVE_LISTING = `
  insert into listing_cache (url, listing, fetched_at)
  values ($1, $2::jsonb, now())
  on conflict (url) do update
    set listing = excluded.listing, fetched_at = excluded.fetched_at
`;

export const LOG_INGEST = `
  insert into ingest_log (host, outcome, ms, detail) values ($1, $2, $3::integer, $4)
`;

/**
 * Count this request against the client's window, and roll the window over if
 * it has expired — both inside one statement.
 *
 * Reading the count and then writing it back would let two concurrent requests
 * read the same number and both conclude they were under the limit, which is
 * precisely the case a rate limiter exists for. `make_interval` takes a number,
 * so the window width needs no cast from text and no guess about which type
 * the driver decided to send.
 */
export const TAKE_SLOT = `
  insert into rate_window (client, count, started_at)
  values ($1, 1, now())
  on conflict (client) do update set
    count = case
      when rate_window.started_at < now() - make_interval(secs => $2::double precision) then 1
      else rate_window.count + 1
    end,
    started_at = case
      when rate_window.started_at < now() - make_interval(secs => $2::double precision) then now()
      else rate_window.started_at
    end
  returning count, started_at
`;

/**
 * What the daily spend cap is counted from.
 *
 * Only `scraper` rows, which are the calls that came back with a page. A
 * provider that refuses the request logs `scraper-failed` and is not counted,
 * because a refused request is not a billed one.
 */
export const SCRAPES_TODAY = `
  select count(*) from ingest_log
  where outcome = 'scraper' and logged_at > now() - interval '1 day'
`;
