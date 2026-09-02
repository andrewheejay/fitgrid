import { bodyWithin } from './outbound.js';
import { DEFAULT_DAILY_SCRAPE_CAP } from './policy.js';

/**
 * The paid fallback, behind an interface that does not name the vendor.
 *
 * Bot protection is the whole reason a server exists here: a plain fetch from
 * a data centre is refused by most large retailers regardless of headers, and
 * defeating that is a residential-proxy business, not a line of code. So one
 * is rented. The interface is two fields wide so swapping the vendor — or
 * dropping the feature — touches this file and nothing else.
 */
export interface Scraper {
  dailyCap: number;
  fetchHtml: (url: string, timeoutMs: number) => Promise<string>;
}

export function scraper(): Scraper | null {
  const key = process.env['SCRAPINGBEE_API_KEY'];
  if (!key) return null;

  const cap = Number(process.env['DAILY_SCRAPE_CAP'] ?? DEFAULT_DAILY_SCRAPE_CAP);

  return {
    dailyCap: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DAILY_SCRAPE_CAP,
    async fetchHtml(url, timeoutMs) {
      const query = new URLSearchParams({
        api_key: key,
        url,
        // The metadata we want is in the served markup — JSON-LD and OpenGraph
        // are both there before a single script runs. Rendering would cost
        // several times as much per call and add nothing.
        render_js: 'false',
        premium_proxy: 'true',
      });

      const response = await fetch(`https://app.scrapingbee.com/api/v1/?${query}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        // The provider explains itself in the body — "premium proxy not
        // available on your plan" reads very differently from a bare 401, and
        // one of those is a config mistake while the other is a dead key.
        const said = (await response.text()).slice(0, 200).replace(/\s+/g, ' ').trim();
        throw new Error(`scrapingbee ${response.status}: ${said}`);
      }
      // The proxy is relaying a page we do not control, so it gets the same
      // ceiling a direct fetch does.
      return new TextDecoder().decode(await bodyWithin(response));
    },
  };
}
