import { describe, expect, it } from 'vitest';
import { bodyWithin, Refused } from './outbound';

/** A response whose body arrives in chunks, as a real one does. */
function streamed(chunks: number[], headers: Record<string, string> = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
  return new Response(stream, { headers });
}

describe('bodyWithin', () => {
  it('returns a body that fits, reassembled in order', async () => {
    const response = new Response('hello');
    expect(new TextDecoder().decode(await bodyWithin(response, 64))).toBe('hello');
  });

  it('refuses on the declared length before reading a byte', async () => {
    const response = streamed([8], { 'content-length': '9999' });
    await expect(bodyWithin(response, 64)).rejects.toBeInstanceOf(Refused);
  });

  // The point of counting rather than measuring: a body that lies about its
  // length, or declares none at all, still cannot spend more than the cap.
  it('refuses mid-stream when the declared length lied', async () => {
    const response = streamed([32, 32, 32], { 'content-length': '32' });
    await expect(bodyWithin(response, 64)).rejects.toBeInstanceOf(Refused);
  });

  it('refuses a body that declares nothing and overruns', async () => {
    await expect(bodyWithin(streamed([40, 40]), 64)).rejects.toBeInstanceOf(Refused);
  });

  it('accepts a body that lands exactly on the cap', async () => {
    expect((await bodyWithin(streamed([32, 32]), 64)).byteLength).toBe(64);
  });

  it('answers empty for a response with no body at all', async () => {
    expect((await bodyWithin(new Response(null, { status: 204 }), 64)).byteLength).toBe(0);
  });
});
