/**
 * Deciding whether the server is allowed to fetch a URL a stranger supplied.
 *
 * This endpoint's whole job is fetching arbitrary URLs on request, which is
 * the textbook shape of an SSRF hole: a visitor pastes
 * http://169.254.169.254/latest/meta-data/ and the function politely reads the
 * cloud metadata service from inside the trust boundary and hands it back.
 *
 * Pure on purpose — the address rules are the part worth testing, and the DNS
 * resolution that completes them lives in the Node layer that calls this.
 */

export type UrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

/** Product pages live on the standard web ports. Anything else is a scan. */
const ALLOWED_PORTS = new Set(['', '80', '443']);

const BLOCKED_HOST = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
];

export function checkOutboundUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'not a url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'only http and https' };
  }
  // Credentials in the URL would be forwarded to whatever we fetch.
  if (url.username || url.password) return { ok: false, reason: 'credentials in url' };
  if (!url.hostname) return { ok: false, reason: 'no host' };
  if (!ALLOWED_PORTS.has(url.port)) return { ok: false, reason: 'port not allowed' };
  if (BLOCKED_HOST.some((pattern) => pattern.test(url.hostname))) {
    return { ok: false, reason: 'internal host' };
  }

  // A bare IP literal skips DNS, so it has to be checked here as well as after
  // resolution.
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (isIpLiteral(literal) && isBlockedAddress(literal)) {
    return { ok: false, reason: 'private address' };
  }
  return { ok: true, url };
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

/**
 * Is this resolved address somewhere the internet should not be able to send
 * us? Covers loopback, link-local (which is where cloud metadata lives),
 * every RFC1918 range, CGNAT, and the IPv6 equivalents.
 */
export function isBlockedAddress(address: string): boolean {
  const ip = address.trim().toLowerCase();

  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true;
    // An IPv4 address can hide inside a v6 literal two ways: mapped
    // (::ffff:10.0.0.1) and the deprecated compatible form (::10.0.0.1).
    // `URL` also rewrites the dotted quad to hex — ::ffff:a9fe:a9fe — so all
    // four spellings have to come back to the same four octets.
    const dotted = /^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
    if (dotted?.[1]) return isBlockedAddress(dotted[1]);
    const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (hex?.[1] && hex[2]) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return isBlockedAddress(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
    }
    // Unique-local fc00::/7 and link-local fe80::/10.
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable is not something we fetch
  }
  const [a = 0, b = 0] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;          // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true;          // RFC1918
  if (a === 192 && b === 0) return true;            // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                        // multicast + reserved
  return false;
}
