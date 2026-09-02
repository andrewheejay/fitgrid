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
  id        bigserial   primary key,
  host      text        not null,
  outcome   text        not null,
  ms        integer     not null,
  -- Why, when the outcome alone does not say. A paid call that failed is the
  -- case that matters: without the provider's own message the leg is a black
  -- box, and the only way to debug it is to spend another credit guessing.
  detail    text,
  logged_at timestamptz not null default now()
);

alter table ingest_log add column if not exists detail text;

-- Partial, because the only query over this table is "how many scraper calls
-- today" and the day's rows are a small slice of the whole.
create index if not exists ingest_log_scrapes
  on ingest_log (logged_at) where outcome = 'scraper';

-- A fixed window per client, rolled over in SQL so two concurrent requests
-- cannot both read the same count and both decide they are under the limit.
create table if not exists rate_window (
  client     text        primary key,
  count      integer     not null,
  started_at timestamptz not null
);
