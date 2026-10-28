import type {
  GitHubClient,
  GitHubClientOptions,
  GitHubErrorCode,
  GitHubRateLimit,
  GitHubRateLimits,
  GitHubRequestCounts,
  GitHubTokenVerification,
} from '@/types';
import { sleep } from '@/lib/utils';

const API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 800;
const MAX_RETRIES = 1;

export class GitHubError extends Error {
  code: GitHubErrorCode;
  status?: number;
  resetAt?: string;

  constructor(
    code: GitHubErrorCode,
    message: string,
    options?: { status?: number; resetAt?: string | null }
  ) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
    this.status = options?.status;
    this.resetAt = options?.resetAt ?? undefined;
  }
}

export function isGitHubError(err: unknown): err is GitHubError {
  return err instanceof GitHubError;
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError') ||
    (isGitHubError(err) && err.code === 'ABORTED')
  );
}

function isoFromEpoch(value: string | null): string | null {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

export function parseRateLimitHeaders(headers: Headers): GitHubRateLimit | null {
  const remaining = headers.get('x-ratelimit-remaining');
  if (remaining == null) return null;
  const remainingNumber = Number(remaining);
  if (!Number.isFinite(remainingNumber)) return null;
  const limit = Number(headers.get('x-ratelimit-limit') ?? '0');
  return {
    limit: Number.isFinite(limit) ? limit : 0,
    remaining: remainingNumber,
    resetAt: isoFromEpoch(headers.get('x-ratelimit-reset')),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRateLimitResponse(data: any): GitHubRateLimits | null {
  const core = data?.resources?.core;
  const search = data?.resources?.search;
  if (!core || !search) return null;
  return {
    core: {
      limit: Number(core.limit ?? 0),
      remaining: Number(core.remaining ?? 0),
      resetAt: typeof core.reset === 'number' ? new Date(core.reset * 1000).toISOString() : null,
    },
    search: {
      limit: Number(search.limit ?? 0),
      remaining: Number(search.remaining ?? 0),
      resetAt:
        typeof search.reset === 'number' ? new Date(search.reset * 1000).toISOString() : null,
    },
  };
}

function apiHeaders(token: string | null | undefined, accept?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function rateLimitsFromHeaders(
  headers: Headers,
  previous: GitHubRateLimits | null
): GitHubRateLimits | null {
  const next = parseRateLimitHeaders(headers);
  if (!next) return previous;
  const resource = headers.get('x-ratelimit-resource');
  if (resource === 'search') {
    return {
      core: previous?.core ?? { limit: 0, remaining: 0, resetAt: null },
      search: next,
    };
  }
  if (resource === 'core' || !resource) {
    return {
      core: next,
      search: previous?.search ?? { limit: 0, remaining: 0, resetAt: null },
    };
  }
  return previous;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const data = JSON.parse(text) as { message?: string };
      return typeof data.message === 'string' ? data.message : text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}

function httpError(status: number, headers: Headers, message: string): GitHubError {
  const resetAt = isoFromEpoch(headers.get('x-ratelimit-reset'));
  if (status === 401) {
    return new GitHubError('UNAUTHORIZED', 'GitHub rejected the access token.', {
      status,
      resetAt,
    });
  }
  if (status === 403 || status === 429) {
    const remaining = headers.get('x-ratelimit-remaining');
    const retryAfter = headers.get('retry-after');
    if (remaining === '0' || retryAfter != null || status === 429) {
      const code = retryAfter != null || status === 429 ? 'SECONDARY_RATE_LIMITED' : 'RATE_LIMITED';
      return new GitHubError(
        code,
        code === 'RATE_LIMITED'
          ? 'GitHub API rate limit reached.'
          : 'GitHub asks the app to slow down. Try again shortly.',
        { status, resetAt }
      );
    }
  }
  return new GitHubError('API_ERROR', message || `GitHub API error (${status}).`, {
    status,
    resetAt,
  });
}

function abortError(): GitHubError {
  return new GitHubError('ABORTED', 'Request cancelled.');
}

function timeoutError(): GitHubError {
  return new GitHubError('TIMEOUT', 'GitHub request timed out.');
}

interface FetchOptions {
  token?: string | null;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  accept?: string;
}

async function fetchWithTimeout(
  url: string,
  opts: FetchOptions
): Promise<{ response: Response; timedOut: boolean }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;

  const onAbort = () => controller.abort(opts.signal.reason);
  if (opts.signal.aborted) throw abortError();
  opts.signal.addEventListener('abort', onAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: apiHeaders(opts.token, opts.accept),
      signal: controller.signal,
    });
    return { response, timedOut };
  } catch (err) {
    if (opts.signal.aborted) throw abortError();
    if (timedOut) throw timeoutError();
    if (err instanceof Error && err.name === 'AbortError') throw timeoutError();
    throw new GitHubError('NETWORK', 'Could not reach the GitHub API. Check your connection.');
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener('abort', onAbort);
  }
}

// ─── Rate limit preflight/token verification ─────────────────

export async function fetchGitHubRateLimits(opts: {
  token?: string | null;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<GitHubRateLimits> {
  const { response } = await fetchWithTimeout(`${API_BASE}/rate_limit`, {
    ...opts,
  });
  if (!response.ok) {
    throw httpError(response.status, response.headers, await readErrorMessage(response));
  }
  const data = (await response.json()) as unknown;
  const limits = parseRateLimitResponse(data);
  if (!limits) {
    throw new GitHubError('API_ERROR', 'GitHub did not return rate-limit details.');
  }
  return limits;
}

export async function verifyGitHubToken(
  token: string,
  fetchImpl?: typeof fetch,
  timeoutMs?: number
): Promise<GitHubTokenVerification> {
  const controller = new AbortController();
  const { response } = await fetchWithTimeout(`${API_BASE}/user`, {
    token,
    signal: controller.signal,
    fetchImpl,
    timeoutMs,
  });
  if (!response.ok) {
    throw httpError(response.status, response.headers, await readErrorMessage(response));
  }
  const data = (await response.json()) as { login?: string; name?: string | null };
  if (!data.login) throw new GitHubError('API_ERROR', 'GitHub did not return a user.');
  return {
    login: data.login,
    name: data.name ?? null,
    scopes: (response.headers.get('x-oauth-scopes') ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
    rateLimit: parseRateLimitHeaders(response.headers),
  };
}

// ─── Client ──────────────────────────────────────────────────

interface RequestOptions {
  resource: 'core' | 'search';
  accept?: string;
  text?: boolean;
  countBudget?: boolean;
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const token = options.token ?? null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const counts: GitHubRequestCounts = { core: 0, search: 0 };
  let lastRateLimits: GitHubRateLimits | null = null;

  function budgetFor(resource: 'core' | 'search'): number {
    return resource === 'core' ? options.maxCore : options.maxSearch;
  }

  function checkBudget(resource: 'core' | 'search'): void {
    if (counts[resource] >= budgetFor(resource)) {
      throw new GitHubError(
        'BUDGET_EXHAUSTED',
        `The ${resource} request budget for this analysis is exhausted.`
      );
    }
    counts[resource] += 1;
  }

  async function requestRaw<T>(path: string, requestOptions: RequestOptions): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const { resource, accept, text, countBudget = true } = requestOptions;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (options.signal.aborted) throw abortError();
      if (countBudget) checkBudget(resource);

      let response: Response;
      try {
        const result = await fetchWithTimeout(url, {
          token,
          signal: options.signal,
          fetchImpl,
          timeoutMs,
          accept,
        });
        response = result.response;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (resource === 'core' && attempt < MAX_RETRIES) {
          await sleep(retryDelayMs, options.signal);
          continue;
        }
        throw err;
      }

      lastRateLimits = rateLimitsFromHeaders(response.headers, lastRateLimits);

      if (!response.ok) {
        const message = await readErrorMessage(response);
        const error = httpError(response.status, response.headers, message);
        const retryable =
          resource === 'core' &&
          !['UNAUTHORIZED', 'RATE_LIMITED', 'SECONDARY_RATE_LIMITED'].includes(error.code) &&
          response.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          await sleep(retryDelayMs, options.signal);
          continue;
        }
        throw error;
      }

      if (text) return (await response.text()) as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new GitHubError('API_ERROR', 'GitHub returned an unreadable response.');
      }
    }

    throw new GitHubError('API_ERROR', 'GitHub request failed.');
  }

  return {
    requestJson<T>(path: string, resource: 'core' | 'search', accept?: string) {
      return requestRaw<T>(path, { resource, accept });
    },
    requestText(path: string, accept?: string) {
      return requestRaw<string>(path, {
        resource: 'core',
        accept: accept ?? 'application/vnd.github.raw',
        text: true,
      });
    },
    async getRateLimits() {
      try {
        const limits = await fetchGitHubRateLimits({
          token,
          signal: options.signal,
          fetchImpl,
          timeoutMs,
        });
        lastRateLimits = limits;
        return limits;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (isGitHubError(err) && err.code === 'UNAUTHORIZED') throw err;
        return null;
      }
    },
    get counts() {
      return counts;
    },
    get lastRateLimits() {
      return lastRateLimits;
    },
  };
}
