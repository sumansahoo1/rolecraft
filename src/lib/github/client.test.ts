import { describe, expect, it, vi } from 'vitest';
import { createGitHubClient, GitHubError, parseRateLimitHeaders } from './client';

function jsonResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      'content-type': 'application/json',
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '50',
      'x-ratelimit-reset': '1780000000',
      'x-ratelimit-resource': 'core',
      ...options.headers,
    },
  });
}

function client(
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof createGitHubClient>[0]> = {}
) {
  const controller = new AbortController();
  return createGitHubClient({
    signal: controller.signal,
    fetchImpl,
    maxCore: 20,
    maxSearch: 5,
    retryDelayMs: 0,
    ...overrides,
  });
}

function headersOf(init?: RequestInit): Headers {
  return new Headers(init?.headers);
}

describe('GitHub client', () => {
  it('sends the token only when present and always sends the API version', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ login: 'octocat' })
    ) as unknown as typeof fetch;
    const withToken = client(fetchImpl, { token: 'secret' });
    await withToken.requestJson('/user', 'core');
    const headers = headersOf(vi.mocked(fetchImpl).mock.calls[0][1]);
    expect(headers.get('authorization')).toBe('Bearer secret');
    expect(headers.get('x-github-api-version')).toBe('2022-11-28');

    const noToken = client(fetchImpl);
    await noToken.requestJson('/user', 'core');
    expect(headersOf(vi.mocked(fetchImpl).mock.calls[1][1]).get('authorization')).toBeNull();
  });

  it('uses the raw accept header for README text', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('# Hello', { status: 200 })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestText('/repos/o/r/readme')).resolves.toBe('# Hello');
    const headers = headersOf(vi.mocked(fetchImpl).mock.calls[0][1]);
    expect(headers.get('accept')).toBe('application/vnd.github.raw');
  });

  it('maps 404 responses to an API error with status', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'Not Found' }, { status: 404 })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/users/missing', 'core')).rejects.toMatchObject({
      code: 'API_ERROR',
      status: 404,
    });
  });

  it('maps 401 responses to UNAUTHORIZED', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'Bad credentials' }, { status: 401 })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl, { token: 'bad' });
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('does not retry primary rate limits', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { message: 'API rate limit exceeded' },
        {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-resource': 'core' },
        }
      )
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('maps 429 responses to a secondary rate limit without retrying', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'slow down' }, { status: 429, headers: { 'retry-after': '30' } })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'SECONDARY_RATE_LIMITED',
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('maps a 403 secondary rate limit without Retry-After from the body message', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          message:
            'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
        },
        {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '1',
            'x-ratelimit-reset': '1780000900',
            'x-ratelimit-resource': 'core',
          },
        }
      )
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'SECONDARY_RATE_LIMITED',
      status: 403,
      resetAt: new Date(1780000900 * 1000).toISOString(),
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('maps an abuse-detection 403 to a secondary rate limit', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { message: 'You have triggered an abuse detection mechanism. Please retry later.' },
        { status: 403, headers: { 'x-ratelimit-remaining': '1' } }
      )
    ) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'SECONDARY_RATE_LIMITED',
      status: 403,
    });
  });

  it('retries one 5xx response on core requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'oops' }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ login: 'octocat' })) as unknown as typeof fetch;
    const github = client(fetchImpl);
    await expect(github.requestJson('/user', 'core')).resolves.toMatchObject({ login: 'octocat' });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(2);
  });

  it('never retries search requests on 5xx responses', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { message: 'oops' },
        { status: 503, headers: { 'x-ratelimit-resource': 'search' } }
      )
    ) as unknown as typeof fetch;
    const github = client(fetchImpl, { maxSearch: 5 });
    await expect(github.requestJson('/search/issues?q=x', 'search')).rejects.toMatchObject({
      code: 'API_ERROR',
      status: 503,
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('maps a timeout to TIMEOUT', async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl, { timeoutMs: 5 });
    await expect(github.requestJson('/search/issues?q=x', 'search')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('does not make a request when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;
    const github = createGitHubClient({
      signal: controller.signal,
      fetchImpl,
      maxCore: 5,
      maxSearch: 2,
    });
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'ABORTED',
    });
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
  });

  it('maps malformed JSON to an API error without leaking the token', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json', { status: 200 })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl, { token: 'super-secret-token' });
    try {
      await github.requestJson('/user', 'core');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(GitHubError);
      expect((err as GitHubError).code).toBe('API_ERROR');
      expect((err as Error).message).not.toContain('super-secret-token');
    }
  });

  it('enforces the per-run request caps including retries', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true })) as unknown as typeof fetch;
    const github = client(fetchImpl, { maxCore: 1 });
    await github.requestJson('/user', 'core');
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'BUDGET_EXHAUSTED',
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('does not start a retry when the retry would exceed the cap', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'oops' }, { status: 503 })
    ) as unknown as typeof fetch;
    const github = client(fetchImpl, { maxCore: 1 });
    await expect(github.requestJson('/user', 'core')).rejects.toMatchObject({
      code: 'BUDGET_EXHAUSTED',
    });
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('parses rate-limit headers', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '42',
      'x-ratelimit-reset': '1780000000',
    });
    expect(parseRateLimitHeaders(headers)).toEqual({
      limit: 60,
      remaining: 42,
      resetAt: new Date(1780000000 * 1000).toISOString(),
    });
  });
});
