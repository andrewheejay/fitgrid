import { lookup } from 'node:dns/promises';
import { checkOutboundUrl, isBlockedAddress } from './guard.js';

/**
 * The Node half of the outbound guard.
 *
 * `guard.ts` rules on the URL a visitor typed. That is not enough on its own:
 * a hostname that looks ordinary can resolve to 169.254.169.254, and a page
 * that passes every check can redirect to one. So each hop is re-checked, DNS
 * included, and redirects are followed by hand rather than by fetch.
 *
 * What remains open, and is written down rather than papered over: the address
 * is checked before the connection is made, so a record that changes between
 * the two would still be followed. Closing that means dialling the resolved
 * address directly with a Host header, which is a custom agent's worth of code
 * for an attack that needs control of a DNS zone.
 */
export class Refused extends Error {}

const MAX_HOPS = 5;

/**
 * A product page is tens of kilobytes; a hundred times that is not a product
 * page. `response.text()` would buffer whatever the other end sent, which on a
 * function with a fixed memory ceiling is a way to be killed by a stranger.
 */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

/** A shop that fingerprints clients answers a bare fetch with a challenge. */
const BROWSERISH: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

export async function safeFetch(
  raw: string,
  timeoutMs: number,
  headers: Record<string, string> = BROWSERISH,
): Promise<Response> {
  let target = raw;

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const verdict = checkOutboundUrl(target);
    if (!verdict.ok) throw new Refused(verdict.reason);
    await assertPublicHost(verdict.url.hostname);

    const response = await fetch(verdict.url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const location = response.status >= 300 && response.status < 400 && response.headers.get('location');
    if (!location) return response;
    target = new URL(location, verdict.url).toString();
  }

  throw new Refused('too many redirects');
}

/** Every address the name resolves to has to be one we are willing to reach. */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Refused('host does not resolve');
  }
  if (addresses.length === 0) throw new Refused('host does not resolve');
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Refused('private address');
  }
}

/**
 * Read a body, refusing one that will not fit. The declared length is checked
 * first because it is free, and then the actual bytes are counted because it
 * is a claim, not a promise.
 */
export async function bodyWithin(response: Response, maxBytes = MAX_BODY_BYTES): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Refused('response too large');

  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Refused('response too large');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return body;
}
