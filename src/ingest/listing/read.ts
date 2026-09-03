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
 *
 * The chain is serial, so without a shared deadline the budgets add up — four
 * readers having a bad afternoon would keep a visitor watching a disabled
 * button for the best part of a minute. One deadline covers the whole run: a
 * slow reader can spend its own budget, never the rest of the chain's.
 */
const CHAIN_BUDGET_MS = 40_000;

export async function readListing(url: string): Promise<Listing> {
  const pageUrl = normaliseUrl(url);
  const deadline = AbortSignal.timeout(CHAIN_BUDGET_MS);

  for (const reader of READERS) {
    if (deadline.aborted) break;
    let fields: ListingFields;
    try {
      fields = await reader.run(pageUrl, AbortSignal.any([deadline, timeout(reader.timeoutMs)]));
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
   * not the whole run. Whichever of this and the chain's deadline fires first
   * ends the attempt.
   */
  timeoutMs: number;
  run: (url: string, signal: AbortSignal) => Promise<ListingFields>;
}

/** Named only so `AbortSignal.any([...])` above reads as two deadlines. */
const timeout = (ms: number) => AbortSignal.timeout(ms);

const READERS: readonly Reader[] = [
  {
    id: 'server',
    // The longest budget in the chain, because it is the only reader that may
    // rent a residential proxy: it is slow when it works and the only one that
    // works at all on the shops that block everyone else.
    //
    // Locally there is no function behind this path, and what comes back is
    // not a 503 — Vite answers any unmatched route with the SPA shell, at 200.
    // So the failure is JSON.parse throwing on HTML rather than a status
    // check, which the loop above catches identically. One localhost round
    // trip, then the chain moves on.
    timeoutMs: 26_000,
    run: async (url, signal) => {
      const body = JSON.parse(
        await text(`/api/listing?url=${encodeURIComponent(url)}`, signal),
      ) as { listing?: ListingFields };
      return body.listing ?? {};
    },
  },
  {
    id: 'direct',
    timeoutMs: 8_000,
    run: async (url, signal) => parseProductHtml(await text(url, signal), url),
  },
  {
    id: 'jina',
    // Asked for the page's markup rather than its reader-friendly prose,
    // because the markup is where schema.org data lives.
    timeoutMs: 15_000,
    run: async (url, signal) =>
      parseProductHtml(
        await text(`https://r.jina.ai/${url}`, signal, { 'x-return-format': 'html' }),
        url,
      ),
  },
  /*
   * allorigins used to sit here, fourth. It is out of the chain because it is
   * down: 500, then 522, then three connections that never answered inside
   * twelve seconds. A reader that cannot answer is not free — it held its whole
   * ten-second budget on every lookup that got that far, which was ten of the
   * fourteen seconds a visitor spent waiting to be told a shop could not be
   * read. Its id and label stay: listings cached before today still cite it.
   */
  {
    id: 'microlink',
    // Last: it answers with a title and an image and nothing else, so a
    // listing it resolves arrives without brand, SKU or price.
    //
    // Six seconds rather than fifteen. Every answer it has given, working or
    // refusing, arrived inside three — the larger budget only ever bought a
    // longer wait for the same refusal.
    timeoutMs: 6_000,
    run: async (url, signal) =>
      parseMicrolink(
        JSON.parse(
          await text(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, signal),
        ) as Json,
        url,
      ),
  },
];

async function text(url: string, signal: AbortSignal, headers?: HeadersInit): Promise<string> {
  const response = await fetch(url, { signal, ...(headers ? { headers } : {}) });
  if (!response.ok) throw new Error(`Reader returned ${response.status}`);
  return response.text();
}

