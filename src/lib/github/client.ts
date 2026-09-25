/**
 * GitHub REST client (direct fetch — no octokit dependency).
 *
 * Calls go straight from the browser to api.github.com using the user's
 * personal access token. Rate-limit info is surfaced so the UI can warn
 * the user before they run out of requests.
 */

import type { GithubContext } from '@/types';

const GITHUB_API_BASE = 'https://api.github.com';

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

interface GithubApiError extends Error {
  status: number;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
}

interface GithubResponse<T> {
  data: T;
  rateLimitRemaining: number | null;
  rateLimitReset: number | null;
  linkNext: string | null;
}
function buildHeaders(ctx: GithubContext): Record<string, string> {
  return {
    ...DEFAULT_HEADERS,
    Authorization: `Bearer ${ctx.pat}`,
  };
}

async function request<T>(
  ctx: GithubContext,
  path: string,
  opts?: { query?: Record<string, string | number | undefined> }
): Promise<GithubResponse<T>> {
  const url = new URL(`${GITHUB_API_BASE}${path}`);
  if (opts?.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: buildHeaders(ctx),
    signal: ctx.signal,
  });

  const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
  const rateLimitReset = res.headers.get('x-ratelimit-reset');
  const link = res.headers.get('link');

  let linkNext: string | null = null;
  if (link) {
    const next = link.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (next) linkNext = next[1];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(
      `GitHub API ${res.status} on ${path}: ${body.slice(0, 400)}`
    ) as GithubApiError;
    err.status = res.status;
    err.rateLimitRemaining = rateLimitRemaining ? Number(rateLimitRemaining) : null;
    err.rateLimitReset = rateLimitReset ? Number(rateLimitReset) : null;
    throw err;
  }

  const data = (await res.json()) as T;

  return {
    data,
    rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : null,
    rateLimitReset: rateLimitReset ? Number(rateLimitReset) : null,
    linkNext,
  };
}

export { request };

// ─── Trimming helpers ───────────────────────────────────────

const MAX_ITEMS = 20;
const MAX_STRING_LENGTH = 2000;

function truncateString(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
}

function limitItems<T>(items: T[]): T[] {
  return items.slice(0, MAX_ITEMS);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trimValue(value: any): any {
  if (value == null) return value;
  if (typeof value === 'string') return truncateString(value);
  if (Array.isArray(value)) return limitItems(value).map(trimValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = trimValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Recursively truncate long strings and long arrays in a payload so it
 * doesn't blow up the LLM context window.
 */
export function trimPayload(payload: unknown): unknown {
  return trimValue(payload);
}
