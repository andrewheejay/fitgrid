-- Fitgrid's server-side tables.
--
-- Three, and each one earns its place: a cache so the same product page is
-- never paid for twice, a counter so one visitor cannot spend the whole
-- scraping budget, and a log that is what the daily cap is counted from.
--
-- Apply with:  psql "$POSTGRES_URL" -f db/schema.sql

create table if not exists listing_cache (
  url        text        primary key,
  listing    jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- Every read attempt, whatever came of it. Not analytics for its own sake:
-- the day's scraper calls are counted straight off this table, which is how
-- the paid API's budget is enforced.
create table if not exists ingest_log (
  id      bigserial   primary key,
  host    text        not null,
  outcome text        not null,
  ms      integer     not null,
  at      timestamptz not null default now()
);

create index if not exists ingest_log_scrapes on ingest_log (at) where outcome = 'scraper';

-- A fixed window per client, rolled over in SQL so two concurrent requests
-- cannot both read the same count and both decide they are under the limit.
create table if not exists rate_window (
  client     text        primary key,
  count      integer     not null,
  started_at timestamptz not null
);
