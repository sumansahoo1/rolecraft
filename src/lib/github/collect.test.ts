import { describe, expect, it } from 'vitest';
import { collectGitHubWork } from './collect';

type Mode =
  | 'normal'
  | 'organization'
  | 'bot'
  | 'invalid-token'
  | 'mid-run-401'
  | 'search-401'
  | 'search-401-limited'
  | 'search-failure'
  | 'language-failure'
  | 'zero-repos'
  | 'private-profile-readme';

interface Call {
  url: string;
  headers: Headers;
}

function rateHeaders(resource: 'core' | 'search'): HeadersInit {
  return {
    'content-type': 'application/json',
    'x-ratelimit-limit': resource === 'search' ? '10' : '60',
    'x-ratelimit-remaining': resource === 'search' ? '9' : '55',
    'x-ratelimit-reset': '1780000000',
    'x-ratelimit-resource': resource,
  };
}

function json(body: unknown, resource: 'core' | 'search' = 'core', status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: rateHeaders(resource) });
}

function text(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain', ...rateHeaders('core') },
  });
}

function repo(name: string, options: { fork?: boolean; language?: string; year?: number } = {}) {
  return {
    id: name.length,
    name,
    full_name: `octocat/${name}`,
    owner: { login: 'octocat' },
    private: false,
    html_url: `https://github.com/octocat/${name}`,
    description: `${name} project`,
    language: options.language ?? 'TypeScript',
    topics: [options.language?.toLowerCase() ?? 'typescript'],
    stargazers_count: 10,
    forks_count: 1,
    fork: options.fork ?? false,
    archived: false,
    created_at: `${options.year ?? 2015}-01-01T00:00:00Z`,
    pushed_at: '2026-05-01T00:00:00Z',
  };
}

function makeServer(mode: Mode = 'normal') {
  const calls: Call[] = [];
  const controllerRef: { current: AbortController | null } = { current: null };
  let midRunAuthFailed = false;
  let searchAuthFailed = false;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({ url: url.toString(), headers });
    if (controllerRef.current?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    if (url.pathname === '/rate_limit') {
      if (mode === 'invalid-token' && headers.get('authorization')) {
        return json({ message: 'Bad credentials' }, 'core', 401);
      }
      const withToken = Boolean(headers.get('authorization'));
      const anonymousCore = mode === 'search-401-limited' ? 49 : 60;
      return json({
        resources: {
          core: {
            limit: withToken ? 5000 : 60,
            remaining: withToken ? 5000 : anonymousCore,
            reset: 1780000000,
          },
          search: { limit: withToken ? 30 : 10, remaining: withToken ? 30 : 10, reset: 1780000000 },
        },
      });
    }

    if (url.pathname === '/users/octocat') {
      if (mode === 'organization') {
        return json({ login: 'octocat', type: 'Organization' });
      }
      if (mode === 'bot') {
        return json({ login: 'octocat', type: 'Bot' });
      }
      if (mode === 'mid-run-401' && headers.get('authorization') && !midRunAuthFailed) {
        midRunAuthFailed = true;
        return json({ message: 'Bad credentials' }, 'core', 401);
      }
      return json({
        login: 'octocat',
        name: 'The Octocat',
        type: 'User',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        html_url: 'https://github.com/octocat',
        bio: 'Builds tools',
        public_repos: mode === 'zero-repos' ? 0 : 4,
        followers: 10,
        following: 2,
        created_at: '2015-01-01T00:00:00Z',
      });
    }

    if (url.pathname === '/users/octocat/repos') {
      const items = [
        repo('alpha', { year: 2015 }),
        repo('beta', { language: 'Go', year: 2020 }),
        repo('gamma', { fork: true, language: 'Rust', year: 2022 }),
        repo('octocat'),
        { ...repo('secret'), private: true, full_name: 'octocat/secret' },
      ];
      if (mode === 'private-profile-readme') {
        return json(
          items.map((item) => (item.name === 'octocat' ? { ...item, private: true } : item))
        );
      }
      return json(items);
    }

    if (url.pathname === '/repos/octocat/octocat/readme') {
      return text('# Octocat profile\n\nI build developer tools.');
    }

    const repoMatch = url.pathname.match(/^\/repos\/octocat\/([^/]+)\/(languages|readme|commits)$/);
    if (repoMatch) {
      const [, name, endpoint] = repoMatch;
      if (endpoint === 'languages') {
        if (mode === 'language-failure' && name === 'alpha') {
          return json({ message: 'boom' }, 'core', 500);
        }
        return json({ [name === 'beta' ? 'Go' : 'TypeScript']: 1000 });
      }
      if (endpoint === 'readme') {
        return text(`# ${name}\n\n${name} documentation.`);
      }
      if (endpoint === 'commits') {
        const page = url.searchParams.get('page') ?? '1';
        const since = url.searchParams.get('since');
        const year = since ? new Date(since).getUTCFullYear() : page === '2' ? 2025 : 2026;
        return json([
          {
            sha: `${name}-${year}-${page}`,
            html_url: `https://github.com/octocat/${name}/commit/${name}-${year}`,
            commit: {
              message: `${name} ${year} commit\n\nbody`,
              author: { date: `${year}-06-01T00:00:00Z` },
            },
          },
        ]);
      }
    }

    if (url.pathname === '/search/issues') {
      if (mode === 'search-failure') {
        return json({ message: 'search unavailable' }, 'search', 500);
      }
      if (
        (mode === 'search-401' || mode === 'search-401-limited') &&
        headers.get('authorization') &&
        !searchAuthFailed
      ) {
        searchAuthFailed = true;
        return json({ message: 'Bad credentials' }, 'search', 401);
      }
      const query = url.searchParams.get('q') ?? '';
      const order = url.searchParams.get('order');
      if (query.includes('is:pr')) {
        if (order === 'asc') {
          return json(
            {
              total_count: 2,
              incomplete_results: false,
              items: [
                {
                  id: 10,
                  number: 1,
                  title: 'Old fix',
                  state: 'closed',
                  html_url: 'https://github.com/org/lib/pull/1',
                  repository_url: 'https://api.github.com/repos/org/lib',
                  pull_request: { merged_at: '2015-08-01T00:00:00Z' },
                  created_at: '2015-08-01T00:00:00Z',
                },
              ],
            },
            'search'
          );
        }
        return json(
          {
            total_count: 2,
            incomplete_results: false,
            items: [
              {
                id: 11,
                number: 2,
                title: 'New feature',
                state: 'open',
                html_url: 'https://github.com/org/lib/pull/2',
                repository_url: 'https://api.github.com/repos/org/lib',
                pull_request: { merged_at: null },
                created_at: '2026-02-01T00:00:00Z',
              },
            ],
          },
          'search'
        );
      }
      return json(
        {
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              id: 12,
              number: 3,
              title: 'Docs',
              state: 'closed',
              html_url: 'https://github.com/org/tool/issues/3',
              repository_url: 'https://api.github.com/repos/org/tool',
              created_at: '2019-02-01T00:00:00Z',
            },
          ],
        },
        'search'
      );
    }

    if (url.pathname === '/search/commits') {
      return json(
        {
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              sha: 'old-public',
              html_url: 'https://github.com/org/lib/commit/old-public',
              repository: { full_name: 'org/lib', private: false },
              commit: {
                message: 'Old public commit',
                author: { date: '2016-01-01T00:00:00Z' },
              },
            },
            {
              sha: 'old-private',
              html_url: 'https://github.com/octocat/secret/commit/old-private',
              repository: { full_name: 'octocat/secret', private: true },
              commit: {
                message: 'Secret commit',
                author: { date: '2017-01-01T00:00:00Z' },
              },
            },
          ],
        },
        'search'
      );
    }

    return json({ message: 'Not found' }, 'core', 404);
  }) as typeof fetch;

  return { fetchImpl, calls, controllerRef };
}

function searchCalls(calls: Call[]): Call[] {
  return calls.filter((call) => new URL(call.url).pathname.startsWith('/search/'));
}

describe('collectGitHubWork', () => {
  it('runs anonymously with multi-year commits, public-only searches, and caps', async () => {
    const server = makeServer();
    const dataset = await collectGitHubWork({
      username: 'octocat',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.profile.login).toBe('octocat');
    expect(dataset.coverage.mode).toBe('anonymous');
    expect(dataset.coverage.requests.core).toBeLessThanOrEqual(45);
    expect(dataset.coverage.requests.search).toBeLessThanOrEqual(6);
    expect(dataset.timeline.map((row) => row.year)).toEqual(
      expect.arrayContaining([2015, 2020, 2026])
    );
    expect(dataset.coverage.detailRepos).toBe(2);
    expect(dataset.coverage.readmesFetched).toBe(2);
    expect(dataset.coverage.commitPagesFetched).toBe(7);
    expect(dataset.coverage.profileReadmeFetched).toBe(true);
    expect(
      server.calls.some((call) => new URL(call.url).pathname === '/repos/octocat/octocat/readme')
    ).toBe(true);

    const alphaLanguageCalls = server.calls.filter(
      (call) => new URL(call.url).pathname === '/repos/octocat/alpha/languages'
    );
    expect(alphaLanguageCalls).toHaveLength(1);

    const commits = server.calls.filter((call) => new URL(call.url).pathname.includes('/commits'));
    expect(
      commits.some((call) => {
        const params = new URL(call.url).searchParams;
        return (
          params.get('since')?.startsWith('2015-01-01') &&
          params.get('until')?.startsWith('2015-12-31')
        );
      })
    ).toBe(true);
    expect(
      commits.some((call) => {
        const params = new URL(call.url).searchParams;
        return (
          params.get('since')?.startsWith('2026-01-01') &&
          params.get('until') === '2026-06-01T00:00:00.000Z'
        );
      })
    ).toBe(true);
    expect(
      commits.some((call) => {
        const params = new URL(call.url).searchParams;
        return params.get('since')?.startsWith('2020-01-01');
      })
    ).toBe(true);

    const searches = searchCalls(server.calls);
    expect(searches.length).toBeGreaterThan(0);
    for (const call of searches) {
      expect(new URL(call.url).searchParams.get('q')).toContain('is:public');
      expect(call.headers.get('authorization')).toBeNull();
    }
    expect(searches.some((call) => new URL(call.url).searchParams.get('order') === 'asc')).toBe(
      true
    );
    expect(server.calls.some((call) => new URL(call.url).pathname === '/graphql')).toBe(false);

    const serialized = JSON.stringify(dataset);
    expect(serialized).not.toContain('octocat/secret');
    expect(serialized).not.toContain('Secret commit');
    expect(dataset.coverage.warnings.join(' ')).not.toContain('secret');
  });

  it('uses token caps, authorization, and year-bucketed commit fallback', async () => {
    const server = makeServer();
    const dataset = await collectGitHubWork({
      username: 'octocat',
      token: 'ghp_test',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.coverage.mode).toBe('token');
    expect(dataset.coverage.requests.core).toBeLessThanOrEqual(120);
    expect(dataset.coverage.requests.search).toBeLessThanOrEqual(8);
    expect(
      server.calls.every((call) => call.headers.get('authorization') === 'Bearer ghp_test')
    ).toBe(true);
    expect(server.calls.some((call) => new URL(call.url).pathname === '/graphql')).toBe(false);
    const commitSearch = searchCalls(server.calls).filter(
      (call) => new URL(call.url).pathname === '/search/commits'
    );
    expect(commitSearch.length).toBeLessThanOrEqual(2);
    expect(
      commitSearch.some((call) => new URL(call.url).searchParams.get('q')?.includes('author-date:'))
    ).toBe(true);
  });

  it('rejects organizations and bots before requesting repositories', async () => {
    for (const mode of ['organization', 'bot'] as const) {
      const server = makeServer(mode);
      await expect(
        collectGitHubWork({
          username: 'octocat',
          signal: new AbortController().signal,
          fetchImpl: server.fetchImpl,
        })
      ).rejects.toMatchObject({
        code: mode === 'organization' ? 'PROFILE_IS_ORGANIZATION' : 'PROFILE_IS_BOT',
      });
      expect(server.calls.some((call) => new URL(call.url).pathname.includes('/repos'))).toBe(
        false
      );
    }
  });

  it('falls back to anonymous limits when the token is rejected at preflight', async () => {
    const server = makeServer('invalid-token');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      token: 'bad-token',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.coverage.mode).toBe('anonymous');
    expect(dataset.coverage.tokenInvalid).toBe(true);
    expect(dataset.coverage.warnings.join(' ')).toContain('token was rejected');
    const profileCall = server.calls.find(
      (call) => new URL(call.url).pathname === '/users/octocat'
    );
    expect(profileCall?.headers.get('authorization')).toBeNull();
  });

  it('switches to anonymous limits when a core request is rejected mid-run', async () => {
    const server = makeServer('mid-run-401');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      token: 'ghp_test',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.coverage.mode).toBe('anonymous');
    expect(dataset.coverage.tokenInvalid).toBe(true);
    expect(dataset.coverage.warnings.join(' ')).toContain('mid-run');
    expect(dataset.coverage.requests.core).toBeGreaterThanOrEqual(2);
    const profileCalls = server.calls.filter(
      (call) => new URL(call.url).pathname === '/users/octocat'
    );
    expect(profileCalls[0].headers.get('authorization')).toBe('Bearer ghp_test');
    expect(profileCalls[1].headers.get('authorization')).toBeNull();
    const repoCalls = server.calls.filter((call) => new URL(call.url).pathname.includes('/repos/'));
    expect(repoCalls.every((call) => call.headers.get('authorization') === null)).toBe(true);
  });

  it('switches modes when search returns 401 and retries the page anonymously', async () => {
    const server = makeServer('search-401');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      token: 'ghp_test',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.coverage.mode).toBe('anonymous');
    expect(dataset.coverage.tokenInvalid).toBe(true);
    expect(dataset.coverage.warnings.join(' ')).toContain('mid-run');
    expect(dataset.pullRequests.length).toBeGreaterThan(0);
    const searchIssueCalls = server.calls.filter(
      (call) => new URL(call.url).pathname === '/search/issues'
    );
    expect(searchIssueCalls.length).toBeGreaterThanOrEqual(2);
    expect(searchIssueCalls[0].headers.get('authorization')).toBe('Bearer ghp_test');
    expect(searchIssueCalls[1].headers.get('authorization')).toBeNull();
  });

  it('marks the token invalid even when the anonymous fallback is quota-blocked', async () => {
    const server = makeServer('search-401-limited');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      token: 'ghp_test',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(dataset.coverage.mode).toBe('anonymous');
    expect(dataset.coverage.tokenInvalid).toBe(true);
    expect(dataset.coverage.searchIncomplete).toBe(true);
    expect(dataset.coverage.warnings.join(' ')).toContain('rejected during search');
    expect(dataset.repos.length).toBeGreaterThan(0);
    expect(dataset.coverage.requests.core).toBeGreaterThan(0);
    expect(dataset.coverage.rateLimitEnd?.core.limit).toBe(60);
  });

  it('keeps the report when search fails and does not retry the search', async () => {
    const server = makeServer('search-failure');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(dataset.repos.length).toBeGreaterThan(0);
    expect(dataset.pullRequests).toEqual([]);
    expect(dataset.coverage.warnings.join(' ')).toContain('partial');
    expect(
      server.calls.filter((call) => new URL(call.url).pathname === '/search/issues')
    ).toHaveLength(1);
  });

  it('handles a profile with no public repositories', async () => {
    const server = makeServer('zero-repos');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(dataset.repos).toEqual([]);
    expect(dataset.projects).toEqual([]);
    expect(dataset.coverage.repositoriesAnalyzed).toBe(0);
    expect(dataset.timeline.length).toBeGreaterThan(0);
    expect(server.calls.some((call) => new URL(call.url).pathname === '/users/octocat/repos')).toBe(
      false
    );
  });

  it('never fetches a private profile README', async () => {
    const server = makeServer('private-profile-readme');
    const dataset = await collectGitHubWork({
      username: 'octocat',
      signal: new AbortController().signal,
      fetchImpl: server.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(dataset.profileReadme).toBeNull();
    expect(dataset.coverage.profileReadmeFetched).toBe(false);
    expect(
      server.calls.some((call) => new URL(call.url).pathname === '/repos/octocat/octocat/readme')
    ).toBe(false);
    expect(JSON.stringify(dataset)).not.toContain('octocat/secret');
  });

  it('returns a partial dataset on detail failures', async () => {
    const partialServer = makeServer('language-failure');
    const partial = await collectGitHubWork({
      username: 'octocat',
      signal: new AbortController().signal,
      fetchImpl: partialServer.fetchImpl,
      retryDelayMs: 0,
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(partial.coverage.warnings.join(' ')).toContain('language details');
    expect(partial.projects.length).toBeGreaterThan(0);
  });

  it('stops making requests when aborted', async () => {
    const abortServer = makeServer();
    const controller = new AbortController();
    abortServer.controllerRef.current = controller;
    const original = abortServer.fetchImpl;
    let count = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      count += 1;
      if (count === 5) controller.abort();
      return original(input, init);
    }) as typeof fetch;

    await expect(
      collectGitHubWork({
        username: 'octocat',
        signal: controller.signal,
        fetchImpl,
        retryDelayMs: 0,
        now: new Date('2026-06-01T00:00:00Z'),
      })
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(count).toBe(5);
  });
});
