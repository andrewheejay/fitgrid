/**
 * Reading a product page's own metadata — pure, and deliberately so.
 *
 * Nothing here touches the network, the DOM or any Node API, so the identical
 * parser runs in the browser's reader chain and in the serverless function.
 * One implementation, one set of tests, two runtimes. That is also why the
 * scraping is done with regexes rather than DOMParser, which exists in only
 * one of them.
 */
/**
 * Where a listing's metadata came from.
 *
 * The site itself is tried first, so no third party sees the URL when a
 * retailer serves permissive CORS headers. The rest exist because most large
 * retailers sit behind bot protection that refuses an ordinary request — they
 * are public endpoints that fetch the page and hand back what they got, and
 * which of them a given retailer tolerates is not predictable. Measured on a
 * handful of shops they barely overlap: one gets Uniqlo, another Pacsun, a
 * third Nike. Hence a chain rather than a pick.
 *
 * `server` is Fitgrid's own endpoint, which is tried first where it is
 * deployed: it caches what it reads and can rent a residential proxy, so it
 * succeeds on shops none of the public readers will touch. It is absent in
 * local development, which is why the rest of the chain stays.
 */
export type ReaderId = 'server' | 'direct' | 'jina' | 'allorigins' | 'microlink';

export const READER_LABEL: Record<ReaderId, string> = {
  server: 'Fitgrid\u2019s reader',
  direct: 'the site itself',
  jina: 'r.jina.ai',
  allorigins: 'allorigins.win',
  microlink: 'microlink.io',
};

/**
 * What a product page told us. Only `name` and `imageUrl` are required — the
 * rest are the catalogue fields, and a page either publishes them as
 * schema.org data or it does not.
 */
export interface Listing {
  url: string;
  name: string;
  imageUrl: string;
  via: ReaderId;
  brand?: string;
  styleCode?: string;
  colourway?: string;
  composition?: string;
  retail?: string;
}

/** Everything the parsers may or may not find. */
export interface ListingFields {
  name?: string;
  imageUrl?: string;
  brand?: string;
  styleCode?: string;
  colourway?: string;
  composition?: string;
  retail?: string;
}

/**
 * Every reader was refused, or answered without a product.
 *
 * Separate from a plain Error because the screen answers it with the designed
 * no-match card — "Drop an image instead" — rather than a failure message.
 */
export class ListingUnreadable extends Error {}

/** Rejects anything that is not an http(s) page before any request goes out. */
export function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('That is not a URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('That is not a web address.');
  }
  return parsed.toString();
}

export function toListing(fields: ListingFields, url: string, via: ReaderId): Listing | null {
  if (!fields.name || !fields.imageUrl || isErrorPage(fields.name)) return null;
  return {
    url,
    name: fields.name,
    imageUrl: fields.imageUrl,
    via,
    ...(fields.brand ? { brand: fields.brand } : {}),
    ...(fields.styleCode ? { styleCode: fields.styleCode } : {}),
    ...(fields.colourway ? { colourway: fields.colourway } : {}),
    ...(fields.composition ? { composition: fields.composition } : {}),
    ...(fields.retail ? { retail: fields.retail } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Parsers — pure, so they are the part that gets tested                       */
/* -------------------------------------------------------------------------- */

/**
 * Pull a product out of a page's own metadata.
 *
 * Two sources, in order of richness: schema.org Product data in a JSON-LD
 * block, which carries brand, SKU, colour, material and price; and OpenGraph
 * meta tags, which almost every commerce page has but which only carry a
 * title, an image and sometimes a price.
 */
export function parseProductHtml(html: string, pageUrl: string): ListingFields {
  const meta = metaTags(html);
  const product = jsonLdProducts(html)[0];

  const siteName = meta.get('og:site_name');
  const title = str(product?.['name']) ?? meta.get('og:title') ?? htmlTitle(html);

  const offer = firstOffer(product);
  const price =
    formatPrice(offer?.['price'] ?? offer?.['lowPrice'], str(offer?.['priceCurrency'])) ??
    formatPrice(
      meta.get('product:price:amount') ?? meta.get('og:price:amount'),
      meta.get('product:price:currency') ?? meta.get('og:price:currency'),
    );

  const image = firstImage(product) ?? meta.get('og:image') ?? meta.get('twitter:image');

  return fields({
    name: title ? stripSiteSuffix(title, pageUrl, siteName) : undefined,
    imageUrl: image ? absolute(image, pageUrl) : undefined,
    brand: brandName(product?.['brand']) ?? meta.get('product:brand'),
    styleCode:
      str(product?.['sku']) ?? str(product?.['mpn']) ?? groupCode(product?.['productGroupID']),
    colourway: str(product?.['color']),
    composition: str(product?.['material']),
    retail: price,
  });
}

/** microlink answers with a small, flat metadata object. */
export function parseMicrolink(payload: Json, pageUrl: string): ListingFields {
  const root = object(payload);
  const data = object(root?.['data']);
  if (!data) return {};

  // The reader answering 200 says only that the reader is up. What the shop
  // said is in statusCode, and it is often a 404 or a 403.
  const upstream = Number(data['statusCode'] ?? root?.['statusCode'] ?? 200);
  if (Number.isFinite(upstream) && (upstream < 200 || upstream >= 300)) return {};

  const title = str(data['title']);
  const image = str(object(data['image'])?.['url']);

  return fields({
    name: title ? stripSiteSuffix(title, pageUrl, str(data['publisher'])) : undefined,
    imageUrl: image ? absolute(image, pageUrl) : undefined,
    brand: str(data['publisher']),
  });
}

const STATUS_WORD = 'not found|forbidden|error|denied|unauthorized|unavailable|bad request';

const ERROR_PAGE = [
  // A bare status, or one introducing an error phrase. Not any leading three
  // digits: "501 Original Fit Jeans" is a Levi's, not a gateway failure.
  /^[45]\d{2}\s*$/,
  new RegExp(`^[45]\\d{2}\\b[\\s:|–—-]+(${STATUS_WORD})`, 'i'),
  /\b(page )?not found\b/i,
  /\baccess (to this page has been )?denied\b/i,
  /\b(forbidden|unauthorized|service unavailable)\b/i,
  /\battention required\b/i,
  /\bjust a moment\b/i,
  /\b(are you a (human|robot)|verify you are (a )?human|bot detection)\b/i,
  /^(an )?error (has )?occurred\b/i,
];

/**
 * Is this the title of a wall rather than a garment?
 *
 * A reader can answer 200 with a shop's 404 page or its bot-check interstitial,
 * and those pages carry the shop's logo as their OpenGraph image — so "has a
 * name and a picture" is not enough to call something a listing. Without this,
 * a dead URL files Everlane's logo into the wardrobe as "404 Not Found".
 */
export function isErrorPage(name: string): boolean {
  return ERROR_PAGE.some((pattern) => pattern.test(name.trim()));
}
/** The shop, as a person would name it. */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/* -------------------------------------------------------------------------- */
/* HTML and JSON-LD scraping helpers                                           */
/* -------------------------------------------------------------------------- */

// Attribute values may contain '>', so quoted runs are matched explicitly
// rather than stopping at the first angle bracket.
const META_TAG = /<meta\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /\b(property|name|content)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const LD_BLOCK =
  /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/** property/name → content, for every meta tag in the document. */
export function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();

  for (const tag of html.matchAll(META_TAG)) {
    let key: string | undefined;
    let content: string | undefined;

    for (const attribute of (tag[1] ?? '').matchAll(ATTRIBUTE)) {
      const value = attribute[3] ?? attribute[4] ?? attribute[5] ?? '';
      if (attribute[1] === 'content') content = value;
      else key = value;
    }

    // First tag wins: pages that repeat og:image list the primary shot first.
    if (key && content && !tags.has(key.toLowerCase())) {
      tags.set(key.toLowerCase(), decodeEntities(content));
    }
  }
  return tags;
}

/** Every schema.org Product in the page, including ones nested in an @graph. */
export function jsonLdProducts(html: string): JsonObject[] {
  const products: JsonObject[] = [];

  for (const block of html.matchAll(LD_BLOCK)) {
    let parsed: Json;
    try {
      parsed = JSON.parse((block[1] ?? '').trim()) as Json;
    } catch {
      continue;
    }
    collectProducts(parsed, products);
  }
  return products;
}

function collectProducts(node: Json, out: JsonObject[]): void {
  if (Array.isArray(node)) {
    node.forEach((child) => collectProducts(child, out));
    return;
  }
  const record = object(node);
  if (!record) return;

  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((entry) => typeof entry === 'string' && /product/i.test(entry))) {
    out.push(record);
  }
  if (record['@graph']) collectProducts(record['@graph'], out);
}

export function htmlTitle(html: string): string | undefined {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match?.[1] ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
  return title || undefined;
}

/**
 * Drop the shop's name off the end of a page title.
 *
 * "Jet Black Classic Fleece Hoodie | Pacsun" is a garment name with a
 * signature attached; the wardrobe wants only the garment. Runs twice, for
 * titles that append both a section and a shop.
 */
/**
 * Two ways a page signs its title with the shop's name, and both get cut.
 *
 * The pipe family is the common one — "… | Pacsun". The second is a bare
 * domain after a full stop, "… Hoodie. Nike.com", which is the same suffix
 * wearing different punctuation. Each is only removed when the tail actually
 * names this shop, so a garment called "Boot Cut. Original" keeps its name.
 */
const SEPARATED = /^(.*\S)\s[|·–—-]\s([^|·–—-]+)$/;
const DOMAIN_TAIL = /^(.*\S)[.,]\s*((?:[a-z0-9-]+\.)+[a-z]{2,})$/i;

export function stripSiteSuffix(title: string, pageUrl: string, siteName?: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  let out = cleaned;

  for (let pass = 0; pass < 2; pass += 1) {
    const match = SEPARATED.exec(out) ?? DOMAIN_TAIL.exec(out);
    const tail = match?.[2];
    if (!match?.[1] || !tail || !isSiteName(tail, pageUrl, siteName)) break;
    out = match[1].trim();
  }
  return out || cleaned;
}

function isSiteName(tail: string, pageUrl: string, siteName?: string): boolean {
  // Letters and numbers in any script. Stripping to a-z0-9 threw away the
  // whole of a Korean shop's name — "무신사" normalised to nothing, which the
  // empty guard below then read as "no site name here", so "| 무신사" survived
  // on every Musinsa title.
  const normalise = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  // "END. (US)" is END. with a locale bolted on. The region marker is not part
  // of the name and would otherwise stop it matching the domain.
  const candidate = normalise(tail.replace(/\s*\([^)]*\)\s*$/, ''));
  if (!candidate) return false;
  if (siteName && candidate === normalise(siteName)) return true;

  let host: string;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return false;
  }
  const label = normalise(host.replace(/^www\./, '').split('.')[0] ?? '');
  if (label.length <= 2) return false;

  // Either direction: "Pacsun" contains "pacsun", and "endclothing" starts with
  // the "END" a page signs itself with. `startsWith` rather than `includes` on
  // that side, because a shop's name leads its domain and a colour does not.
  return candidate.includes(label) || (candidate.length >= 3 && label.startsWith(candidate));
}

function absolute(url: string, pageUrl: string): string | undefined {
  try {
    return new URL(url.startsWith('//') ? `https:${url}` : url, pageUrl).toString();
  } catch {
    return undefined;
  }
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  KRW: '₩',
};

export function formatPrice(amount: Json | undefined, currency?: string): string | undefined {
  const value = Number(typeof amount === 'string' ? amount.replace(/[^\d.]/g, '') : amount);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const shown = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const code = currency?.trim().toUpperCase();
  const symbol = code ? CURRENCY_SYMBOL[code] : undefined;
  if (symbol) return `${symbol}${shown}`;
  return code ? `${shown} ${code}` : shown;
}

function firstOffer(product: JsonObject | undefined): JsonObject | undefined {
  const offers = product?.['offers'];
  if (Array.isArray(offers)) return object(offers[0]);
  const single = object(offers);
  // An AggregateOffer nests the real offers one level down.
  return object(single?.['offers']) ?? object(asArray(single?.['offers'])[0]) ?? single;
}

function firstImage(product: JsonObject | undefined): string | undefined {
  const image = product?.['image'];
  const candidate = Array.isArray(image) ? image[0] : image;
  return str(candidate) ?? str(object(candidate)?.['url']);
}

function brandName(brand: Json | undefined): string | undefined {
  return str(brand) ?? str(object(brand)?.['name']);
}

/**
 * A ProductGroup's id, but only when it reads as a catalogue number.
 *
 * schema.org has no field for "the code printed on the label", so shops put it
 * wherever they like — Pacsun files it as `productGroupID`. Nike puts an
 * internal handle like "Gw4Nwq" in the same field, and showing that under
 * "Style code" is worse than showing nothing. Article numbers are digits,
 * dashes and capitals; mixed-case handles are not.
 */
export function groupCode(value: Json | undefined): string | undefined {
  const code = str(value);
  return code && /^[0-9A-Z][0-9A-Z \-/]{5,}$/.test(code) ? code : undefined;
}

/* -------------------------------------------------------------------------- */
/* Narrowing over parsed JSON                                                  */
/* -------------------------------------------------------------------------- */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function object(value: Json | undefined): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : undefined;
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

/** Strings and numbers both read as text here; everything else is absent. */
function str(value: Json | undefined): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  const trimmed = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return trimmed || undefined;
}

/** Drops the keys that came back empty, so callers can use `??` freely. */
function fields(candidate: Partial<Record<keyof ListingFields, string | undefined>>): ListingFields {
  const out: ListingFields = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value) out[key as keyof ListingFields] = value;
  }
  return out;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  rsquo: '’',
  lsquo: '‘',
  mdash: '—',
  ndash: '–',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1]?.toLowerCase() === 'x'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * CORS-safe ways to read the same image.
 *
 * The cut-out reads pixels back off a canvas, which a cross-origin image only
 * permits with the right headers. Most product CDNs send them; the proxies
 * cover the ones that do not.
 */
export function imageCandidates(imageUrl: string): string[] {
  const bare = imageUrl.replace(/^https?:\/\//, '');
  return [
    // The origin first: when a CDN does send permissive headers this costs
    // nobody anything. Then our own endpoint, which is same-origin and so
    // never has the problem at all — and only then other people's proxies,
    // which are free and correspondingly unreliable.
    imageUrl,
    `/api/image?url=${encodeURIComponent(imageUrl)}`,
    `https://images.weserv.nl/?url=${encodeURIComponent(bare)}&output=png&n=-1`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
  ];
}
