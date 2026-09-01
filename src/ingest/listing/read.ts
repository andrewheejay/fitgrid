import {
  ListingUnreadable,
  normaliseUrl,
  parseMicrolink,
  parseProductHtml,
  toListing,
  type Json,
  type ReaderId,
  type Listing,
  type ListingFields,
} from './parse';

/**
 * Read a product page.
 *
 * Readers are tried in order and the first that yields both a name and an
 * image wins. Coverage is genuinely partial: a shop that refuses all four is a
 * dead end here, which is what the no-match card is for.
 */
export async function readListing(url: string): Promise<Listing> {
  const pageUrl = normaliseUrl(url);

  for (const reader of READERS) {
    let fields: ListingFields;
    try {
      fields = await reader.run(pageUrl, reader.timeoutMs);
    } catch {
      continue;
    }
    const listing = toListing(fields, pageUrl, reader.id);
    if (listing) return listing;
  }

  throw new ListingUnreadable(
    'That shop would not let Fitgrid read the page — most big retailers block ' +
      'automated readers.',
  );
}

/* -------------------------------------------------------------------------- */
/* Readers                                                                     */
/* -------------------------------------------------------------------------- */

interface Reader {
  id: ReaderId;
  /**
   * Its own budget, because the whole chain runs in front of a visitor. A
   * reader that has not answered inside this is treated as a refusal — a
   * public endpoint having a bad afternoon should cost the next one its turn,
   * not the whole run.
   */
  timeoutMs: number;
  run: (url: string, timeoutMs: number) => Promise<ListingFields>;
}

const READERS: readonly Reader[] = [
  {
    id: 'direct',
    timeoutMs: 8_000,
    run: async (url, timeoutMs) => parseProductHtml(await text(url, timeoutMs), url),
  },
  {
    id: 'jina',
    // Asked for the page's markup rather than its reader-friendly prose,
    // because the markup is where schema.org data lives.
    timeoutMs: 15_000,
    run: async (url, timeoutMs) =>
      parseProductHtml(
        await text(`https://r.jina.ai/${url}`, timeoutMs, { 'x-return-format': 'html' }),
        url,
      ),
  },
  {
    id: 'allorigins',
    timeoutMs: 10_000,
    run: async (url, timeoutMs) =>
      parseProductHtml(
        await text(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeoutMs),
        url,
      ),
  },
  {
    id: 'microlink',
    // Last: it answers with a title and an image and nothing else, so a
    // listing it resolves arrives without brand, SKU or price.
    timeoutMs: 15_000,
    run: async (url, timeoutMs) =>
      parseMicrolink(
        JSON.parse(
          await text(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, timeoutMs),
        ) as Json,
        url,
      ),
  },
];

async function text(url: string, timeoutMs: number, headers?: HeadersInit): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    ...(headers ? { headers } : {}),
  });
  if (!response.ok) throw new Error(`Reader returned ${response.status}`);
  return response.text();
}

