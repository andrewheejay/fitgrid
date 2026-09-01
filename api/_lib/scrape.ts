import { DEFAULT_DAILY_SCRAPE_CAP } from './policy';

/**
 * The paid fallback, behind an interface that does not name the vendor.
 *
 * Bot protection is the whole reason a server exists here: a plain fetch from
 * a data centre is refused by most large retailers regardless of headers, and
 * defeating that is a residential-proxy business, not a line of code. So one
 * is rented. The interface is three fields wide so swapping the vendor — or
 * dropping the feature — touches this file and nothing else.
 */
export interface Scraper {
  /** Shown to nobody; it is what lands in the log as the outcome's detail. */
  name: string;
  dailyCap: number;
  fetchHtml: (url: string, timeoutMs: number) => Promise<string>;
}

export function scraper(): Scraper | null {
  const key = process.env['SCRAPINGBEE_API_KEY'];
  if (!key) return null;

  const cap = Number(process.env['DAILY_SCRAPE_CAP'] ?? DEFAULT_DAILY_SCRAPE_CAP);

  return {
    name: 'scrapingbee',
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
      if (!response.ok) throw new Error(`scraper returned ${response.status}`);
      return response.text();
    },
  };
}
