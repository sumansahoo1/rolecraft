import type {
  GitHubClient,
  GitHubCommit,
  GitHubDataset,
  GitHubIssue,
  GitHubMode,
  GitHubProgress,
  GitHubPullRequest,
  GitHubRateLimits,
  GitHubRepo,
  GitHubRepoDetail,
  GitHubRequestCounts,
} from '@/types';
import {
  createGitHubClient,
  fetchGitHubRateLimits,
  GitHubError,
  isAbortError,
  isGitHubError,
} from './client';
import {
  cleanReadmeText,
  normalizeCommits,
  normalizeIssue,
  normalizeLanguages,
  normalizeProfile,
  normalizePullRequest,
  normalizeRepos,
  normalizeSearchCommit,
} from './normalize';
import {
  aggregateGitHubDataset,
  collectActiveYears,
  rankRepos,
  sampleActiveYears,
  selectDetailTargets,
} from './aggregate';

const CORE_RESERVE = 5;

export interface GitHubLimits {
  repoRecentPages: number;
  repoOldestPages: number;
  topDetailRepos: number;
  activeYearReps: number;
  readmeRepos: number;
  latestCommitPages: number;
  extraCommitPages: number;
  prRecentPages: number;
  prOldestPages: number;
  issueRecentPages: number;
  issueOldestPages: number;
  fallbackCommitQueries: number;
  maxCore: number;
  maxSearch: number;
  coreThreshold: number;
  fullSearchThreshold: number;
  fixedSearchCount: number;
  contextChars: number;
}

export const GITHUB_LIMITS = {
  anonymous: {
    repoRecentPages: 2,
    repoOldestPages: 1,
    topDetailRepos: 6,
    activeYearReps: 6,
    readmeRepos: 6,
    latestCommitPages: 6,
    extraCommitPages: 3,
    prRecentPages: 1,
    prOldestPages: 1,
    issueRecentPages: 0,
    issueOldestPages: 1,
    fallbackCommitQueries: 1,
    maxCore: 45,
    maxSearch: 6,
    coreThreshold: 50,
    fullSearchThreshold: 4,
    fixedSearchCount: 3,
    contextChars: 20_000,
  },
  token: {
    repoRecentPages: 4,
    repoOldestPages: 2,
    topDetailRepos: 8,
    activeYearReps: 16,
    readmeRepos: 12,
    latestCommitPages: 8,
    extraCommitPages: 6,
    prRecentPages: 2,
    prOldestPages: 2,
    issueRecentPages: 1,
    issueOldestPages: 1,
    fallbackCommitQueries: 2,
    maxCore: 120,
    maxSearch: 8,
    coreThreshold: 90,
    fullSearchThreshold: 8,
    fixedSearchCount: 6,
    contextChars: 28_000,
  },
} as const satisfies Record<GitHubMode, GitHubLimits>;

export interface CollectGitHubOptions {
  username: string;
  token?: string | null;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  now?: Date;
  onProgress?: (progress: GitHubProgress) => void;
}

type SearchPlan = 'full' | 'fixed' | 'none';

interface RateLimitPlan {
  limits: GitHubLimits;
  coreCap: number;
  searchCap: number;
  searchPlan: SearchPlan;
}

export function planFromLimits(limits: GitHubLimits, rateLimits: GitHubRateLimits): RateLimitPlan {
  if (rateLimits.core.remaining < limits.coreThreshold) {
    throw new GitHubError(
      'RATE_LIMITED',
      `GitHub has ${rateLimits.core.remaining} core requests left this hour; at least ${limits.coreThreshold} are needed. Wait for the reset or add a GitHub token in Settings.`,
      { resetAt: rateLimits.core.resetAt ?? undefined }
    );
  }

  let searchPlan: SearchPlan = 'none';
  if (rateLimits.search.remaining >= limits.fullSearchThreshold) {
    searchPlan = 'full';
  } else if (rateLimits.search.remaining >= limits.fixedSearchCount) {
    searchPlan = 'fixed';
  }

  return {
    limits,
    coreCap: Math.max(0, Math.min(limits.maxCore, rateLimits.core.remaining - CORE_RESERVE)),
    searchCap:
      searchPlan === 'none'
        ? 0
        : Math.max(0, Math.min(limits.maxSearch, rateLimits.search.remaining)),
    searchPlan,
  };
}

function encodeRepoPath(fullName: string): string {
  return fullName
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function searchPath(
  query: string,
  sort: 'created' | 'author-date',
  order: 'asc' | 'desc',
  page: number,
  perPage: number
): string {
  const params = new URLSearchParams({
    q: query,
    sort,
    order,
    per_page: String(perPage),
    page: String(page),
  });
  return `/search/issues?${params.toString()}`;
}

function commitSearchPath(
  query: string,
  sort: 'author-date',
  order: 'asc' | 'desc',
  page: number,
  perPage: number
): string {
  const params = new URLSearchParams({
    q: query,
    sort,
    order,
    per_page: String(perPage),
    page: String(page),
  });
  return `/search/commits?${params.toString()}`;
}

function isBudgetError(err: unknown): boolean {
  return isGitHubError(err) && err.code === 'BUDGET_EXHAUSTED';
}

function isHardRateLimitError(err: unknown): boolean {
  return (
    isGitHubError(err) && (err.code === 'RATE_LIMITED' || err.code === 'SECONDARY_RATE_LIMITED')
  );
}

function rateLimitGuidance(mode: GitHubMode, err: unknown): string {
  const reset =
    isGitHubError(err) && err.resetAt ? ` GitHub's limit resets at ${err.resetAt}.` : '';
  const tokenHint =
    mode === 'anonymous' ? ' Add a GitHub token in Settings to raise GitHub rate limits.' : '';
  return `${reset}${tokenHint}` || ' Wait a few minutes before retrying.';
}

function mapProfileError(err: unknown): GitHubError {
  if (isGitHubError(err)) {
    if (err.status === 404) {
      return new GitHubError('PROFILE_NOT_FOUND', 'No GitHub user was found for that profile.');
    }
    return err;
  }
  if (err instanceof Error) return new GitHubError('API_ERROR', err.message);
  return new GitHubError('API_ERROR', 'Could not fetch that GitHub profile.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRecord = any;

interface SearchResponse {
  total_count?: number;
  incomplete_results?: boolean;
  items?: RawRecord[];
}

export async function collectGitHubWork(options: CollectGitHubOptions): Promise<GitHubDataset> {
  const now = options.now ?? new Date();
  const username = options.username;
  const warnings: string[] = [];

  let mode: GitHubMode = options.token ? 'token' : 'anonymous';
  let token = options.token?.trim() || null;
  let tokenInvalid = false;
  let limits: GitHubLimits = mode === 'token' ? GITHUB_LIMITS.token : GITHUB_LIMITS.anonymous;

  let priorCounts: GitHubRequestCounts = { core: 0, search: 0 };
  let client!: GitHubClient;
  let rateLimits: GitHubRateLimits | null = null;
  const totalCount = (): GitHubRequestCounts => ({
    core: priorCounts.core + (client?.counts.core ?? 0),
    search: priorCounts.search + (client?.counts.search ?? 0),
  });
  const emit = (
    stage: GitHubProgress['stage'],
    message: string,
    completed?: number,
    total?: number
  ) => {
    options.onProgress?.({
      stage,
      message,
      completed,
      total,
      requests: totalCount(),
      coreRemaining: client?.lastRateLimits?.core.remaining ?? rateLimits?.core.remaining ?? null,
      searchRemaining:
        client?.lastRateLimits?.search.remaining ?? rateLimits?.search.remaining ?? null,
    });
  };

  options.onProgress?.({
    stage: 'preflight',
    message: 'Checking GitHub API availability…',
    requests: { core: 0, search: 0 },
    coreRemaining: null,
    searchRemaining: null,
  });
  try {
    rateLimits = await fetchGitHubRateLimits({
      token,
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
  } catch (err) {
    if (token && isGitHubError(err) && err.code === 'UNAUTHORIZED') {
      tokenInvalid = true;
      mode = 'anonymous';
      token = null;
      limits = GITHUB_LIMITS.anonymous;
      rateLimits = await fetchGitHubRateLimits({
        signal: options.signal,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
      });
    } else {
      throw err;
    }
  }

  if (!rateLimits) {
    throw new GitHubError('API_ERROR', 'GitHub did not return rate-limit details.');
  }

  const plan = planFromLimits(limits, rateLimits);
  client = createGitHubClient({
    token,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    retryDelayMs: options.retryDelayMs,
    maxCore: plan.coreCap,
    maxSearch: plan.searchCap,
  });

  const rateLimitStart = rateLimits;
  let searchIncomplete = false;
  let searchPlan = plan.searchPlan;
  if (searchPlan !== 'full') {
    warnings.push(
      searchPlan === 'fixed'
        ? 'The GitHub search quota only allowed the fixed PR/issue query set; the commit-search fallback was skipped.'
        : 'GitHub search quota was too low for PR/issue sampling; that part of the report was skipped.'
    );
  }
  if (tokenInvalid) {
    warnings.push(
      'The GitHub token was rejected; this run continued anonymously with a smaller request budget.'
    );
  }

  async function switchToAnonymous(): Promise<void> {
    if (tokenInvalid) throw new GitHubError('UNAUTHORIZED', 'GitHub rejected the access token.');
    if (options.signal.aborted) throw new GitHubError('ABORTED', 'Request cancelled.');

    // The token is already known to be rejected. Mark the effective mode before
    // the anonymous quota check, which may itself fail.
    tokenInvalid = true;
    mode = 'anonymous';
    token = null;
    limits = GITHUB_LIMITS.anonymous;
    priorCounts = {
      core: priorCounts.core + client.counts.core,
      search: priorCounts.search + client.counts.search,
    };
    // Replace the token-bearing client immediately so a failed quota check can
    // never leak more authenticated requests or token-mode rate-limit limits.
    client = createGitHubClient({
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      retryDelayMs: options.retryDelayMs,
      maxCore: 0,
      maxSearch: 0,
    });

    const anonLimits = await fetchGitHubRateLimits({
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    const anonPlan = planFromLimits(GITHUB_LIMITS.anonymous, anonLimits);

    rateLimits = anonLimits;
    searchPlan = anonPlan.searchPlan;
    warnings.push(
      'The GitHub token was rejected mid-run; remaining requests used anonymous rate limits.'
    );
    client = createGitHubClient({
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      retryDelayMs: options.retryDelayMs,
      maxCore: anonPlan.coreCap,
      maxSearch: anonPlan.searchCap,
    });
    emit('preflight', 'GitHub token rejected; continuing anonymously…');
  }

  async function coreJson<T>(path: string): Promise<T> {
    try {
      return await client.requestJson<T>(path, 'core');
    } catch (err) {
      if (isGitHubError(err) && err.code === 'UNAUTHORIZED' && !tokenInvalid) {
        await switchToAnonymous();
        return client.requestJson<T>(path, 'core');
      }
      throw err;
    }
  }

  async function coreText(path: string): Promise<string> {
    try {
      return await client.requestText(path);
    } catch (err) {
      if (isGitHubError(err) && err.code === 'UNAUTHORIZED' && !tokenInvalid) {
        await switchToAnonymous();
        return client.requestText(path);
      }
      throw err;
    }
  }

  emit('preflight', 'GitHub API ready.', undefined, undefined);

  // ── Profile ───────────────────────────────────────────────
  let rawProfile: RawRecord;
  try {
    rawProfile = await coreJson<RawRecord>(`/users/${encodeURIComponent(username)}`);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw mapProfileError(err);
  }
  const normalizedProfile = normalizeProfile(rawProfile);
  if (!normalizedProfile) {
    throw new GitHubError('API_ERROR', 'GitHub returned an unreadable profile.');
  }
  const profile = normalizedProfile;

  if (profile.type === 'Organization') {
    throw new GitHubError(
      'PROFILE_IS_ORGANIZATION',
      'That profile belongs to an organization. Enter a personal GitHub profile.'
    );
  }
  if (profile.type === 'Bot') {
    throw new GitHubError('PROFILE_IS_BOT', 'That profile belongs to a bot account.');
  }
  if (profile.type !== 'User') {
    throw new GitHubError('PROFILE_NOT_A_USER', 'That GitHub profile is not a personal user.');
  }
  emit('profile', `Loaded @${profile.login}.`, 1, 1);

  // ── Repository discovery ──────────────────────────────────
  const repoMap = new Map<string, GitHubRepo>();
  let repoPageFailed = false;

  async function loadRepoPage(
    page: number,
    sort: 'pushed' | 'created',
    direction: 'asc' | 'desc'
  ): Promise<RawRecord[]> {
    const params = new URLSearchParams({
      type: 'owner',
      sort,
      direction,
      per_page: '100',
      page: String(page),
    });
    return coreJson<RawRecord[]>(`/users/${encodeURIComponent(username)}/repos?${params}`);
  }

  if (profile.publicRepos > 0) {
    for (let page = 1; page <= limits.repoRecentPages; page++) {
      try {
        const rawRepos = await loadRepoPage(page, 'pushed', 'desc');
        for (const repo of normalizeRepos(rawRepos, profile.login)) {
          repoMap.set(repo.fullName, repo);
        }
        emit(
          'repositories',
          `Loaded repositories page ${page}.`,
          repoMap.size,
          profile.publicRepos
        );
        if (rawRepos.length < 100 || repoMap.size >= profile.publicRepos) break;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (repoMap.size === 0) throw err;
        warnings.push(
          'A later repository page could not be loaded; the report uses a partial list.'
        );
        repoPageFailed = true;
        break;
      }
    }

    if (!repoPageFailed && repoMap.size < profile.publicRepos) {
      for (let page = 1; page <= limits.repoOldestPages; page++) {
        try {
          const rawRepos = await loadRepoPage(page, 'created', 'asc');
          for (const repo of normalizeRepos(rawRepos, profile.login)) {
            repoMap.set(repo.fullName, repo);
          }
          emit(
            'repositories',
            `Loaded older repository page ${page}.`,
            repoMap.size,
            profile.publicRepos
          );
          if (rawRepos.length < 100) break;
        } catch (err) {
          if (isAbortError(err)) throw err;
          warnings.push(
            'An older repository page could not be loaded; the report uses a partial list.'
          );
          break;
        }
      }
    }
  }

  const repos = [...repoMap.values()];

  // ── Profile README (only when the public repo list contains it) ──
  let profileReadme: string | null = null;
  const hasPublicProfileReadme = repos.some((repo) => repo.isProfileReadme);
  if (hasPublicProfileReadme) {
    try {
      const readmeRaw = await coreText(
        `/repos/${encodeURIComponent(profile.login)}/${encodeURIComponent(profile.login)}/readme`
      );
      profileReadme = cleanReadmeText(readmeRaw, 1200);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (!(isGitHubError(err) && err.status === 404)) {
        warnings.push('The profile README could not be loaded.');
      }
    }
  }
  const profileReadmeFetched = Boolean(profileReadme);

  // ── Detail targets ────────────────────────────────────────
  const activeYears = collectActiveYears(repos);
  const sampledYears = sampleActiveYears(activeYears, limits.activeYearReps);
  const detailSelection = selectDetailTargets({
    repos,
    topLimit: limits.topDetailRepos,
    yearLimit: limits.activeYearReps,
    now,
  });
  const targets = detailSelection.targets;
  const repoDetails: Record<string, GitHubRepoDetail> = {};
  for (const repo of targets) {
    repoDetails[repo.fullName] = {
      fullName: repo.fullName,
      languages: {},
      readmeExcerpt: null,
      commits: [],
      warnings: [],
    };
  }
  const detailSuccessRepos = new Set<string>();
  const successfulYearCommitYears = new Set<number>();

  const readmeTargets = rankRepos(targets, now).slice(0, limits.readmeRepos);
  const latestTargets = detailSelection.topTargets.slice(0, limits.latestCommitPages);
  const extraTargets = latestTargets.slice(0, limits.extraCommitPages);

  const detailPlanned =
    targets.length +
    readmeTargets.length +
    sampledYears.length +
    latestTargets.length +
    extraTargets.length;
  let detailDone = 0;
  let detailStopped = false;
  let commitPagesFetched = 0;

  function detailProgress(message: string): void {
    emit('details', message, detailDone, detailPlanned);
  }

  if (targets.length > 0) {
    detailProgress('Loading languages, READMEs, and commits…');
  }

  for (const repo of targets) {
    if (detailStopped) break;
    try {
      const rawLanguages = await coreJson<RawRecord>(
        `/repos/${encodeRepoPath(repo.fullName)}/languages`
      );
      repoDetails[repo.fullName].languages = normalizeLanguages(rawLanguages);
      detailSuccessRepos.add(repo.fullName);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (isBudgetError(err) || isHardRateLimitError(err)) {
        detailStopped = true;
        warnings.push('The GitHub request budget or rate limit stopped project details early.');
      } else {
        repoDetails[repo.fullName].warnings.push('Could not load language details.');
        warnings.push(`Could not load language details for ${repo.fullName}.`);
      }
    }
    detailDone++;
    detailProgress(`Loaded languages for ${repo.fullName}.`);
  }

  for (const repo of readmeTargets) {
    if (detailStopped) break;
    try {
      const rawReadme = await coreText(`/repos/${encodeRepoPath(repo.fullName)}/readme`);
      repoDetails[repo.fullName].readmeExcerpt = cleanReadmeText(rawReadme, 1200);
      detailSuccessRepos.add(repo.fullName);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (isBudgetError(err) || isHardRateLimitError(err)) {
        detailStopped = true;
        warnings.push('The GitHub request budget or rate limit stopped READMEs early.');
      } else if (!(isGitHubError(err) && err.status === 404)) {
        repoDetails[repo.fullName].warnings.push('Could not load README.');
        warnings.push(`Could not load the README for ${repo.fullName}.`);
      }
    }
    detailDone++;
    detailProgress(`Loaded README for ${repo.fullName}.`);
  }

  function mergeCommits(repoFullName: string, commits: GitHubCommit[]): void {
    const detail = repoDetails[repoFullName];
    if (!detail) return;
    const seen = new Set(detail.commits.map((commit) => commit.sha));
    for (const commit of commits) {
      if (seen.has(commit.sha)) continue;
      seen.add(commit.sha);
      detail.commits.push(commit);
    }
  }

  for (const { year, repo } of detailSelection.yearReps) {
    if (detailStopped) break;
    const since = `${year}-01-01T00:00:00Z`;
    const until = year === now.getUTCFullYear() ? now.toISOString() : `${year}-12-31T23:59:59Z`;
    const params = new URLSearchParams({
      author: username,
      since,
      until,
      per_page: '50',
      page: '1',
    });
    commitPagesFetched += 1;
    try {
      const rawCommits = await coreJson<RawRecord[]>(
        `/repos/${encodeRepoPath(repo.fullName)}/commits?${params}`
      );
      mergeCommits(repo.fullName, normalizeCommits(rawCommits, repo.fullName, 'detail'));
      detailSuccessRepos.add(repo.fullName);
      successfulYearCommitYears.add(year);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (isBudgetError(err) || isHardRateLimitError(err)) {
        detailStopped = true;
        warnings.push(
          'The GitHub request budget or rate limit stopped year-by-year commits early.'
        );
      } else if (!(isGitHubError(err) && (err.status === 404 || err.status === 409))) {
        warnings.push(`Could not load ${year} commits for ${repo.fullName}.`);
      }
    }
    detailDone++;
    detailProgress(`Sampled ${year} commits from ${repo.fullName}.`);
  }

  for (const repo of latestTargets) {
    if (detailStopped) break;
    const params = new URLSearchParams({
      author: username,
      per_page: '100',
      page: '1',
    });
    commitPagesFetched += 1;
    try {
      const rawCommits = await coreJson<RawRecord[]>(
        `/repos/${encodeRepoPath(repo.fullName)}/commits?${params}`
      );
      mergeCommits(repo.fullName, normalizeCommits(rawCommits, repo.fullName, 'detail'));
      detailSuccessRepos.add(repo.fullName);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (isBudgetError(err) || isHardRateLimitError(err)) {
        detailStopped = true;
        warnings.push('The GitHub request budget or rate limit stopped recent commits early.');
      } else if (!(isGitHubError(err) && (err.status === 404 || err.status === 409))) {
        warnings.push(`Could not load recent commits for ${repo.fullName}.`);
      }
    }
    detailDone++;
    detailProgress(`Sampled recent commits from ${repo.fullName}.`);
  }

  for (const repo of extraTargets) {
    if (detailStopped) break;
    const params = new URLSearchParams({
      author: username,
      per_page: '100',
      page: '2',
    });
    commitPagesFetched += 1;
    try {
      const rawCommits = await coreJson<RawRecord[]>(
        `/repos/${encodeRepoPath(repo.fullName)}/commits?${params}`
      );
      mergeCommits(repo.fullName, normalizeCommits(rawCommits, repo.fullName, 'detail'));
      detailSuccessRepos.add(repo.fullName);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (isBudgetError(err) || isHardRateLimitError(err)) {
        detailStopped = true;
        warnings.push('The GitHub request budget or rate limit stopped more commits early.');
      } else if (!(isGitHubError(err) && (err.status === 404 || err.status === 409))) {
        warnings.push(`Could not load more commits for ${repo.fullName}.`);
      }
    }
    detailDone++;
    detailProgress(`Sampled more commits from ${repo.fullName}.`);
  }

  const readmesFetched = Object.values(repoDetails).filter((detail) => detail.readmeExcerpt).length;

  // ── PR/issue search ───────────────────────────────────────
  const pullRequests: GitHubPullRequest[] = [];
  const issues: GitHubIssue[] = [];
  let pullRequestsTotal: number | null = null;
  let issuesTotal: number | null = null;
  let searchStopped = searchPlan === 'none';

  function pagesFor(kind: 'pr' | 'issue', order: 'asc' | 'desc'): number {
    if (kind === 'pr') return order === 'desc' ? limits.prRecentPages : limits.prOldestPages;
    return order === 'desc' ? limits.issueRecentPages : limits.issueOldestPages;
  }

  async function runSearch(
    query: string,
    sort: 'created',
    order: 'asc' | 'desc',
    pages: number,
    kind: 'pr' | 'issue'
  ): Promise<void> {
    if (searchStopped || pages <= 0) return;
    let retriedAuth = false;
    for (let page = 1; page <= pages; page++) {
      try {
        const response = await client.requestJson<SearchResponse>(
          searchPath(query, sort, order, page, 100),
          'search'
        );
        if (typeof response.total_count === 'number') {
          if (kind === 'pr' && pullRequestsTotal == null) pullRequestsTotal = response.total_count;
          if (kind === 'issue' && issuesTotal == null) issuesTotal = response.total_count;
        }
        if (response.incomplete_results) searchIncomplete = true;
        for (const item of response.items ?? []) {
          if (kind === 'pr') {
            const pr = normalizePullRequest(item, profile.login);
            if (pr) pullRequests.push(pr);
          } else {
            const issue = normalizeIssue(item, profile.login);
            if (issue) issues.push(issue);
          }
        }
        emit(
          'activity',
          `Loaded ${kind === 'pr' ? 'pull requests' : 'issues'} page ${page}.`,
          page,
          pages
        );
        if ((response.items?.length ?? 0) < 100) break;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (isGitHubError(err) && err.code === 'UNAUTHORIZED' && !tokenInvalid && !retriedAuth) {
          retriedAuth = true;
          try {
            await switchToAnonymous();
            if (searchPlan === 'none') {
              warnings.push('The GitHub token was rejected and search quota is now unavailable.');
              searchStopped = true;
              searchIncomplete = true;
              return;
            }
            pages = Math.min(pages, pagesFor(kind, order));
            if (page > pages) break;
            page -= 1;
            continue;
          } catch (fallbackErr) {
            if (isAbortError(fallbackErr)) throw fallbackErr;
            warnings.push(
              'The GitHub token was rejected during search; search results were skipped.'
            );
            searchStopped = true;
            searchIncomplete = true;
            return;
          }
        }
        if (isBudgetError(err)) {
          warnings.push('The GitHub search request budget ran out; activity data is partial.');
        } else if (isHardRateLimitError(err)) {
          searchIncomplete = true;
          warnings.push(
            `GitHub hit a rate limit during search; activity data is partial.${rateLimitGuidance(mode, err)}`
          );
        } else {
          warnings.push(
            'Some GitHub search results could not be loaded; activity data is partial.'
          );
        }
        searchStopped = true;
        return;
      }
    }
  }

  if (searchPlan !== 'none') {
    const prQuery = `author:${username} is:pr is:public`;
    const issueQuery = `author:${username} is:issue is:public`;

    if (limits.prRecentPages > 0) {
      await runSearch(prQuery, 'created', 'desc', limits.prRecentPages, 'pr');
    }
    if (limits.prOldestPages > 0) {
      await runSearch(prQuery, 'created', 'asc', limits.prOldestPages, 'pr');
    }
    if (limits.issueRecentPages > 0) {
      await runSearch(issueQuery, 'created', 'desc', limits.issueRecentPages, 'issue');
    }
    if (limits.issueOldestPages > 0) {
      await runSearch(issueQuery, 'created', 'asc', limits.issueOldestPages, 'issue');
    }
  }

  const dedupePrs = new Map<number, GitHubPullRequest>();
  for (const pr of pullRequests) dedupePrs.set(pr.id, pr);
  const dedupeIssues = new Map<number, GitHubIssue>();
  for (const issue of issues) dedupeIssues.set(issue.id, issue);
  const uniquePrs = [...dedupePrs.values()];
  const uniqueIssues = [...dedupeIssues.values()];

  // ── Commit-search fallback ────────────────────────────────
  const searchCommits: GitHubCommit[] = [];
  if (searchPlan === 'full' && !searchStopped) {
    const yearsWithCommits = new Set<number>();
    for (const detail of Object.values(repoDetails)) {
      for (const commit of detail.commits) {
        const year = new Date(commit.authoredAt).getUTCFullYear();
        if (!Number.isNaN(year)) yearsWithCommits.add(year);
      }
    }
    const gapYears = activeYears.filter((year) => !yearsWithCommits.has(year));
    const candidateYears = (gapYears.length > 0 ? gapYears : activeYears).slice(
      0,
      limits.fallbackCommitQueries
    );

    const queries: string[] = [];
    if (mode === 'anonymous' || candidateYears.length === 0) {
      queries.push(`author:${username} is:public`);
    } else {
      for (const year of candidateYears) {
        queries.push(`author:${username} is:public author-date:${year}-01-01..${year}-12-31`);
      }
    }

    for (const query of queries) {
      if (searchStopped) break;
      try {
        const response = await client.requestJson<SearchResponse>(
          commitSearchPath(query, 'author-date', mode === 'anonymous' ? 'asc' : 'desc', 1, 100),
          'search'
        );
        if (response.incomplete_results) searchIncomplete = true;
        for (const item of response.items ?? []) {
          const commit = normalizeSearchCommit(item);
          if (commit) searchCommits.push(commit);
        }
        emit('activity', 'Sampled older public commits.', 1, queries.length);
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (isGitHubError(err) && err.code === 'UNAUTHORIZED' && !tokenInvalid) {
          try {
            await switchToAnonymous();
            warnings.push(
              'The GitHub token was rejected during the commit fallback; remaining coverage uses anonymous limits.'
            );
          } catch (fallbackErr) {
            if (isAbortError(fallbackErr)) throw fallbackErr;
            warnings.push('The GitHub token was rejected during the commit fallback.');
            searchIncomplete = true;
          }
        } else if (isHardRateLimitError(err)) {
          searchIncomplete = true;
          warnings.push(
            `GitHub hit a rate limit before older commits could be sampled.${rateLimitGuidance(mode, err)}`
          );
        } else if (isBudgetError(err)) {
          warnings.push('The GitHub search budget ran out before older commits could be sampled.');
        } else {
          warnings.push('Older commit samples could not be loaded.');
        }
        searchStopped = true;
      }
    }
  }

  // ── Final rate limits + aggregation ───────────────────────
  emit('aggregate', 'Building the work timeline…');
  let finalRateLimits = client.lastRateLimits;
  try {
    finalRateLimits = (await client.getRateLimits()) ?? finalRateLimits;
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (isGitHubError(err) && err.code === 'UNAUTHORIZED' && !tokenInvalid) {
      try {
        await switchToAnonymous();
        finalRateLimits = client.lastRateLimits;
      } catch (fallbackErr) {
        if (isAbortError(fallbackErr)) throw fallbackErr;
        warnings.push('The final GitHub rate-limit check could not be completed.');
      }
    }
  }
  const counts = totalCount();

  const dataset = aggregateGitHubDataset({
    profile,
    repos,
    repoDetails,
    pullRequests: uniquePrs,
    issues: uniqueIssues,
    searchCommits,
    profileReadme,
    profileReadmeFetched,
    mode,
    tokenInvalid,
    activeYearsFound: activeYears.length,
    activeYearsSampled: successfulYearCommitYears.size,
    detailRepos: detailSuccessRepos.size,
    readmesFetched,
    commitPagesFetched,
    pullRequestsTotal,
    issuesTotal,
    searchIncomplete,
    requests: counts,
    rateLimitStart,
    rateLimitEnd: finalRateLimits,
    warnings,
    now,
  });

  emit('aggregate', 'Work summary data is ready.', 1, 1);
  return dataset;
}
