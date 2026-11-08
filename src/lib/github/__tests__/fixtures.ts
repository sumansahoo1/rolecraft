import type {
  GitHubDataset,
  GitHubProject,
  GitHubRepo,
  GitHubRepoDetail,
  GitHubWorkSummary,
} from '@/types';

const now = new Date('2026-06-01T00:00:00.000Z');

export function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  const name = overrides.name ?? 'alpha';
  const fullName = overrides.fullName ?? `octocat/${name}`;
  return {
    id: 1,
    name,
    fullName,
    htmlUrl: `https://github.com/${fullName}`,
    description: `${name} is a public project.`,
    homepage: null,
    primaryLanguage: 'TypeScript',
    topics: ['typescript'],
    stars: 10,
    forks: 1,
    isFork: false,
    isArchived: false,
    isProfileReadme: false,
    createdAt: '2015-01-01T00:00:00Z',
    pushedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

export const alphaRepo = makeRepo({
  id: 1,
  name: 'alpha',
  fullName: 'octocat/alpha',
  description: 'Alpha is a TypeScript command line tool.',
  primaryLanguage: 'TypeScript',
  topics: ['typescript', 'cli'],
  stars: 120,
  forks: 10,
  createdAt: '2015-01-01T00:00:00Z',
  pushedAt: '2026-05-01T00:00:00Z',
});

const betaRepo = makeRepo({
  id: 2,
  name: 'beta',
  fullName: 'octocat/beta',
  description: 'Beta is a Go service.',
  primaryLanguage: 'Go',
  topics: ['go'],
  stars: 40,
  forks: 5,
  createdAt: '2020-02-01T00:00:00Z',
  pushedAt: '2021-03-01T00:00:00Z',
});

export const gammaRepo = makeRepo({
  id: 3,
  name: 'gamma',
  fullName: 'octocat/gamma',
  description: 'Gamma is a Rust fork.',
  primaryLanguage: 'Rust',
  topics: ['rust'],
  stars: 5,
  forks: 0,
  isFork: true,
  createdAt: '2022-01-01T00:00:00Z',
  pushedAt: '2026-04-01T00:00:00Z',
});

const deltaRepo = makeRepo({
  id: 4,
  name: 'delta',
  fullName: 'octocat/delta',
  description: 'Delta is an archived Python tool.',
  primaryLanguage: 'Python',
  topics: ['python'],
  stars: 2,
  forks: 0,
  isArchived: true,
  createdAt: '2018-01-01T00:00:00Z',
  pushedAt: '2019-01-01T00:00:00Z',
});

export const profileReadmeRepo = makeRepo({
  id: 5,
  name: 'octocat',
  fullName: 'octocat/octocat',
  description: 'Profile README',
  primaryLanguage: null,
  topics: [],
  stars: 0,
  forks: 0,
  isProfileReadme: true,
});

export const repos = [alphaRepo, betaRepo, gammaRepo, deltaRepo, profileReadmeRepo];

export const repoDetails: Record<string, GitHubRepoDetail> = {
  'octocat/alpha': {
    fullName: 'octocat/alpha',
    languages: { TypeScript: 8000, JavaScript: 2000 },
    readmeExcerpt: 'Alpha is a TypeScript command line tool with documentation.',
    commits: [
      {
        sha: 'a15',
        repoFullName: 'octocat/alpha',
        message: 'Start the TypeScript CLI',
        authoredAt: '2015-06-01T00:00:00Z',
        url: 'https://github.com/octocat/alpha/commit/a15',
        source: 'detail',
      },
      {
        sha: 'a20',
        repoFullName: 'octocat/alpha',
        message: 'Add plugin architecture',
        authoredAt: '2020-06-01T00:00:00Z',
        url: 'https://github.com/octocat/alpha/commit/a20',
        source: 'detail',
      },
      {
        sha: 'a26',
        repoFullName: 'octocat/alpha',
        message: 'Refresh docs',
        authoredAt: '2026-04-01T00:00:00Z',
        url: 'https://github.com/octocat/alpha/commit/a26',
        source: 'detail',
      },
    ],
    warnings: [],
  },
  'octocat/beta': {
    fullName: 'octocat/beta',
    languages: { Go: 5000 },
    readmeExcerpt: 'Beta is a Go service.',
    commits: [
      {
        sha: 'b20',
        repoFullName: 'octocat/beta',
        message: 'Build the Go service',
        authoredAt: '2020-07-01T00:00:00Z',
        url: 'https://github.com/octocat/beta/commit/b20',
        source: 'detail',
      },
    ],
    warnings: [],
  },
  'octocat/gamma': {
    fullName: 'octocat/gamma',
    languages: { Rust: 1000 },
    readmeExcerpt: null,
    commits: [
      {
        sha: 'g26',
        repoFullName: 'octocat/gamma',
        message: 'Update fork',
        authoredAt: '2026-03-01T00:00:00Z',
        url: 'https://github.com/octocat/gamma/commit/g26',
        source: 'detail',
      },
    ],
    warnings: [],
  },
};

export const projects: GitHubProject[] = [
  {
    repo: alphaRepo,
    score: 20,
    reasons: ['Original repository', '120 GitHub stars'],
    languages: [
      { name: 'TypeScript', percentage: 80 },
      { name: 'JavaScript', percentage: 20 },
    ],
    commitCountSampled: 3,
    readmeExcerpt: repoDetails['octocat/alpha'].readmeExcerpt,
  },
  {
    repo: betaRepo,
    score: 15,
    reasons: ['Original repository', '40 GitHub stars'],
    languages: [{ name: 'Go', percentage: 100 }],
    commitCountSampled: 1,
    readmeExcerpt: repoDetails['octocat/beta'].readmeExcerpt,
  },
  {
    repo: deltaRepo,
    score: 5,
    reasons: ['Original repository'],
    languages: [{ name: 'Python', percentage: 100 }],
    commitCountSampled: 0,
    readmeExcerpt: null,
  },
];

type TimelineRow = GitHubDataset['timeline'][number];

const timeline: TimelineRow[] = Array.from({ length: 12 }, (_, index) => {
  const year = 2015 + index;
  const commits = year === 2015 ? 1 : year === 2020 ? 2 : year === 2026 ? 2 : 0;
  const pullRequests = year === 2015 ? 1 : year === 2026 ? 1 : 0;
  const issues = year === 2019 ? 1 : 0;
  const row: TimelineRow = {
    year,
    commitsSampled: commits,
    pullRequestsSampled: pullRequests,
    issuesSampled: issues,
    reposCreated: year === 2015 || year === 2020 || year === 2018 ? 1 : 0,
    reposPushed: year === 2019 || year === 2021 || year === 2026 ? 1 : 0,
    activityValue: commits + pullRequests + issues,
    activityMetric: commits + pullRequests + issues > 0 ? 'sampled-signals' : 'none',
    lowerBound: true,
  };
  return row;
});

export function makeDataset(overrides: Partial<GitHubDataset> = {}): GitHubDataset {
  const base: GitHubDataset = {
    profile: {
      login: 'octocat',
      name: 'The Octocat',
      type: 'User',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      htmlUrl: 'https://github.com/octocat',
      bio: 'Builds developer tools.',
      company: '@github',
      blog: 'https://example.com',
      location: 'San Francisco',
      publicRepos: 5,
      followers: 100,
      following: 10,
      createdAt: '2015-01-01T00:00:00Z',
    },
    repos,
    repoDetails,
    pullRequests: [
      {
        id: 1,
        number: 10,
        title: 'Fix parser',
        repoFullName: 'org/lib',
        url: 'https://github.com/org/lib/pull/10',
        state: 'closed',
        merged: true,
        isExternal: true,
        createdAt: '2015-08-01T00:00:00Z',
      },
      {
        id: 2,
        number: 11,
        title: 'Add feature',
        repoFullName: 'org/lib',
        url: 'https://github.com/org/lib/pull/11',
        state: 'open',
        merged: false,
        isExternal: true,
        createdAt: '2026-02-01T00:00:00Z',
      },
      {
        id: 3,
        number: 12,
        title: 'Owned change',
        repoFullName: 'octocat/alpha',
        url: 'https://github.com/octocat/alpha/pull/12',
        state: 'closed',
        merged: true,
        isExternal: false,
        createdAt: '2020-09-01T00:00:00Z',
      },
    ],
    issues: [
      {
        id: 4,
        number: 5,
        title: 'Document setup',
        repoFullName: 'org/tool',
        url: 'https://github.com/org/tool/issues/5',
        state: 'closed',
        isExternal: true,
        createdAt: '2019-05-01T00:00:00Z',
      },
    ],
    searchCommits: [
      {
        sha: 's16',
        repoFullName: 'org/lib',
        message: 'Improve parser',
        authoredAt: '2016-04-01T00:00:00Z',
        url: 'https://github.com/org/lib/commit/s16',
        source: 'search',
      },
    ],
    profileReadme: 'Profile README text about developer tools.',
    stats: {
      publicRepos: 5,
      reposAnalyzed: 5,
      originalReposAnalyzed: 3,
      forkedReposAnalyzed: 1,
      archivedReposAnalyzed: 1,
      starsAnalyzed: 162,
      forksAnalyzed: 15,
      followers: 100,
      following: 10,
      accountCreatedYear: 2015,
      firstActivityYear: 2015,
      lastActivityYear: 2026,
      activeYearCount: 6,
      commitsSampled: 5,
      pullRequestsTotal: 3,
      pullRequestsSampled: 3,
      mergedPullRequestsSampled: 2,
      issuesTotal: 2,
      issuesSampled: 1,
      externalPullRequestsSampled: 2,
      externalReposCount: 1,
      topLanguages: [
        { name: 'TypeScript', value: 8000, percentage: 61.5, repoCount: 1 },
        { name: 'Go', value: 5000, percentage: 38.5, repoCount: 1 },
      ],
      languageSource: 'languages-api',
    },
    timeline,
    projects,
    collaboration: {
      externalRepos: [{ fullName: 'org/lib', pullRequests: 2, merged: 1 }],
      issueAuthoringSampled: 1,
    },
    coverage: {
      mode: 'anonymous',
      tokenInvalid: false,
      sampled: true,
      repositoriesTotal: 5,
      repositoriesAnalyzed: 5,
      repositoriesTruncated: false,
      activeYearsFound: 6,
      activeYearsSampled: 6,
      detailRepos: 3,
      readmesFetched: 2,
      commitPagesFetched: 5,
      profileReadmeFetched: true,
      pullRequestsTotal: 3,
      pullRequestsSampled: 3,
      issuesTotal: 2,
      issuesSampled: 1,
      searchIncomplete: false,
      requests: { core: 20, search: 4 },
      rateLimitStart: {
        core: { limit: 60, remaining: 60, resetAt: '2026-06-01T01:00:00Z' },
        search: { limit: 10, remaining: 10, resetAt: '2026-06-01T00:10:00Z' },
      },
      rateLimitEnd: {
        core: { limit: 60, remaining: 40, resetAt: '2026-06-01T01:00:00Z' },
        search: { limit: 10, remaining: 6, resetAt: '2026-06-01T00:10:00Z' },
      },
      warnings: [],
      limitations: ['Public repositories and public activity only.'],
    },
    fetchedAt: '2026-06-01T00:00:00.000Z',
  };

  return { ...base, ...overrides };
}

export function makeSummary(overrides: Partial<GitHubWorkSummary> = {}): GitHubWorkSummary {
  return {
    headline: 'TypeScript tooling and Go services',
    professionalOverview:
      'The Octocat maintains public developer tools with a focus on TypeScript command line interfaces and Go services. The sampled work spans several years and includes external collaboration on a shared library. The strongest evidence is in the alpha and beta repositories.',
    expertise: [
      {
        area: 'TypeScript command line tooling',
        evidence: ['octocat/alpha is mostly TypeScript', 'Repeated CLI commits'],
      },
    ],
    workTimeline: [
      {
        fromYear: 2015,
        toYear: 2020,
        label: 'Early tooling',
        summary: 'Built and maintained the alpha TypeScript tool.',
        evidence: ['octocat/alpha'],
      },
      {
        fromYear: 2026,
        toYear: 2026,
        label: 'Recent maintenance',
        summary: 'Continued maintenance and documentation work.',
        evidence: ['octocat/alpha'],
      },
    ],
    projectSpotlights: [
      {
        repo: 'octocat/alpha',
        whatItIs: 'A TypeScript command line tool.',
        technicalSignals: ['TypeScript', 'CLI'],
        whyItMatters: 'Shows sustained maintenance of a developer-facing tool.',
      },
    ],
    collaborationSignals: ['Submitted sampled pull requests to org/lib.'],
    workStyleObservations: ['Sustains maintenance over multiple years.'],
    resumeBullets: [
      {
        text: 'Built and maintained a TypeScript CLI with sampled commits across multiple years.',
        evidence: ['octocat/alpha'],
      },
    ],
    caveats: ['Based on sampled public REST data.'],
    ...overrides,
  };
}

export const testNow = now;
