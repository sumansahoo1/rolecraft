import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChatCompletion } from './provider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function success(content: string): Response {
  return jsonResponse({
    choices: [{ message: { content } }],
    model: 'deepseek-v4-flash',
  });
}

const options = {
  provider: 'deepseek' as const,
  model: 'deepseek-v4-flash',
  apiKey: 'test-key',
  messages: [{ role: 'user' as const, content: 'ping' }],
  maxTokens: 32,
  retryDelayMs: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createChatCompletion cancellation and retries', () => {
  it('does not call fetch when the signal is already aborted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      createChatCompletion({ ...options, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a 503 using the injected delay and returns the next response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 503))
      .mockResolvedValueOnce(success('pong'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createChatCompletion(options)).resolves.toMatchObject({ content: 'pong' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts during the retry sleep without making another request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return jsonResponse({ error: 'busy' }, 503);
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      createChatCompletion({
        ...options,
        retryDelayMs: 10_000,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
