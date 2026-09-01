import { lookup } from 'node:dns/promises';
import { checkOutboundUrl, isBlockedAddress } from './guard';

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
