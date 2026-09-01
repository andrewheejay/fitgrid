/**
 * The two things both endpoints need from a raw Request, and neither should
 * spell out twice.
 */

/**
 * Who to count a request against.
 *
 * The proxy's own header is the only identity a serverless function gets, and
 * it is spoofable — this rations a free tier, it does not authenticate anyone.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

export function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}
