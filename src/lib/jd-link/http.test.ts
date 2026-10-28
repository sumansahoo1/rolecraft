import { describe, expect, it, vi } from 'vitest';
import { fetchText } from './http';

function neverResolvingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      })
  ) as unknown as typeof fetch;
}

function textResponse(body: string, contentType = 'text/plain'): Response {
  return new Response(body, { headers: { 'content-type': contentType } });
}

describe('fetchText', () => {
  it('rejects a pre-aborted signal without calling fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: controller.signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 100,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps an unresolved request to timeout', async () => {
    const fetchImpl = neverResolvingFetch();
    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 5,
        maxChars: 100,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'timeout', retryable: true });
  });

  it('maps a transport error to network', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 100,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });

  it('maps an outer abort during fetch to aborted, not timeout', async () => {
    const controller = new AbortController();
    const fetchImpl = neverResolvingFetch();
    const promise = fetchText('https://example.com', {
      signal: controller.signal,
      fetchImpl,
      timeoutMs: 10_000,
      maxChars: 100,
      accept: 'text/plain',
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });

  it('returns non-OK responses instead of throwing', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('missing', { status: 404, headers: { 'content-type': 'text/plain' } })
    ) as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 100,
        accept: 'text/plain',
      })
    ).resolves.toEqual({
      status: 404,
      ok: false,
      text: 'missing',
      contentType: 'text/plain',
    });
  });

  it('bounds an infinite stream and cancels the reader', async () => {
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(32)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchImpl = vi.fn(async () => new Response(stream)) as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 5000,
        maxChars: 64,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'too_large' });

    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(4);
  });

  it('accepts a body exactly at the cap', async () => {
    const fetchImpl = vi.fn(async () => textResponse('hello')) as unknown as typeof fetch;
    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 5,
        accept: 'text/plain',
      })
    ).resolves.toMatchObject({ text: 'hello', ok: true });
  });

  it('rejects a body one character over the cap', async () => {
    const fetchImpl = vi.fn(async () => textResponse('hello!')) as unknown as typeof fetch;
    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 5,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('checks the post-flush decoder output for the cap', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('xx'));
        // Incomplete UTF-8 sequence: only flushed when the stream ends.
        controller.enqueue(Uint8Array.from([0xf0, 0x9f, 0x98]));
        controller.close();
      },
    });
    const fetchImpl = vi.fn(async () => new Response(stream)) as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 2,
        accept: 'text/plain',
      })
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('falls back to response.text() when the body is null', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 204 })
    ) as unknown as typeof fetch;
    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 10,
        accept: 'text/plain',
      })
    ).resolves.toEqual({ status: 204, ok: true, text: '', contentType: null });
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([0xe2]));
        controller.enqueue(Uint8Array.from([0x82, 0xac]));
        controller.close();
      },
    });
    const fetchImpl = vi.fn(async () => new Response(stream)) as unknown as typeof fetch;

    await expect(
      fetchText('https://example.com', {
        signal: new AbortController().signal,
        fetchImpl,
        timeoutMs: 100,
        maxChars: 10,
        accept: 'text/plain',
      })
    ).resolves.toMatchObject({ text: '€' });
  });

  it('sends a privacy-preserving GET request', async () => {
    const fetchImpl = vi.fn(async () => textResponse('ok')) as unknown as typeof fetch;
    await fetchText('https://example.com/job', {
      signal: new AbortController().signal,
      fetchImpl,
      timeoutMs: 100,
      maxChars: 10,
      accept: 'application/json',
    });

    const init = vi.mocked(fetchImpl).mock.calls[0][1];
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      cache: 'no-store',
      mode: 'cors',
    });
    expect(new Headers(init?.headers).get('accept')).toBe('application/json');
  });
});
