import { store } from './_lib/db';
import { checkOutboundUrl } from './_lib/guard';
import { clientKey, json } from './_lib/http';
import { isOverLimit, retryAfterSeconds } from './_lib/policy';
import { bodyWithin, Refused, safeFetch } from './_lib/outbound';

/**
 * Hand the browser a studio photo it is not allowed to fetch for itself.
 *
 * Reading a listing and then failing on its image is the most annoying way for
 * this feature to break, and it is common: a retailer's CDN serves the picture
 * happily but without permissive CORS headers, so the canvas cannot read the
 * pixels back and the cut-out never happens. Same-origin here, so it can.
 *
 * This is the first of several candidates the client tries, and every failure
 * mode is a non-200 it already falls through — including the 503 you get
 * locally with no database configured.
 */
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;

/*
 * Exported as GET rather than as a default function: Vercel's Node runtime
 * reads a default-exported *function* as the legacy (req, res) handler and
 * would call this with an IncomingMessage, whose `url` is a bare path that
 * `new URL()` refuses. A named method export is the Web-signature form, and it
 * also says out loud that this endpoint answers one verb.
 */
export async function GET(request: Request): Promise<Response> {
  const asked = new URL(request.url).searchParams.get('url');
  if (!asked) return json({ error: 'url is required' }, 400);

  // Same as the listing endpoint: refuse before spending a rate slot on it.
  const verdict = checkOutboundUrl(asked);
  if (!verdict.ok) return json({ error: verdict.reason }, 400);

  // Only for the counter — the image itself is not worth a row in the cache,
  // and the CDN header below is the caching that matters for it.
  const db = store();
  if (!db) return json({ error: 'server ingest is not configured' }, 503);

  const window = await db.takeSlot(`img:${clientKey(request)}`);
  if (isOverLimit(window)) {
    return json({ error: 'too many requests' }, 429, {
      'retry-after': String(retryAfterSeconds(window, Date.now())),
    });
  }

  let response: Response;
  try {
    response = await safeFetch(verdict.url.toString(), TIMEOUT_MS, { accept: 'image/*' });
  } catch (caught) {
    return json({ error: caught instanceof Refused ? caught.message : 'could not fetch' }, 400);
  }
  if (!response.ok) return json({ error: `site returned ${response.status}` }, 502);

  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return json({ error: 'not an image' }, 415);

  let body: Uint8Array;
  try {
    // Counted as it arrives rather than measured afterwards: buffering the
    // whole thing first is the failure this is meant to prevent.
    body = await bodyWithin(response, MAX_BYTES);
  } catch {
    return json({ error: 'image too large' }, 413);
  }

  return new Response(body, {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=604800, immutable',
    },
  });
}


