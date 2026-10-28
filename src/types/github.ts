// ─── GitHub Work Summarizer ──────────────────────────────────

export type GitHubMode = 'anonymous' | 'token';
export type GitHubLanguageSource = 'languages-api' | 'primary-language' | 'none';
export type GitHubRunStatus = 'idle' | 'running' | 'summarizing' | 'complete' | 'error';

export type GitHubErrorCode =
  | 'INVALID_USERNAME'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_IS_ORGANIZATION'
  | 'PROFILE_IS_BOT'
  | 'PROFILE_NOT_A_USER'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'SECONDARY_RATE_LIMITED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'BUDGET_EXHAUSTED'
  | 'API_ERROR'
  | 'AI_KEY_MISSING'
  | 'AI_ERROR'
  | 'SUMMARY_INVALID';

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  resetAt: string | null;
}

export interface GitHubRateLimits {
  core: GitHubRateLimit;
  search: GitHubRateLimit;
}

export interface GitHubRequestCounts {
  core: number;
  search: number;
}

export interface GitHubProfile {
  login: string;
  name: string | null;
  type: string;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  primaryLanguage: string | null;
  topics: string[];
  stars: number;
  forks: number;
  isFork: boolean;
  isArchived: boolean;
  isProfileReadme: boolean;
  createdAt: string | null;
  pushedAt: string | null;
}

export interface GitHubLanguageStat {
  name: string;
  value: number;
  percentage: number;
  repoCount: number;
}

export interface GitHubCommit {
  sha: string;
  repoFullName: string;
  message: string;
  authoredAt: string;
  url: string;
  source: 'detail' | 'search';
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  repoFullName: string;
  url: string;
  state: 'open' | 'closed';
  merged: boolean;
  isExternal: boolean;
  createdAt: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  repoFullName: string;
  url: string;
  state: 'open' | 'closed';
  isExternal: boolean;
  createdAt: string;
}

export interface GitHubRepoDetail {
  fullName: string;
  languages: Record<string, number>;
  readmeExcerpt: string | null;
  commits: GitHubCommit[];
  warnings: string[];
}

export interface GitHubProject {
  repo: GitHubRepo;
  score: number;
  reasons: string[];
  languages: Array<{ name: string; percentage: number }>;
  commitCountSampled: number;
  readmeExcerpt: string | null;
}

export interface GitHubStats {
  publicRepos: number;
  reposAnalyzed: number;
  originalReposAnalyzed: number;
  forkedReposAnalyzed: number;
  archivedReposAnalyzed: number;
  starsAnalyzed: number;
  forksAnalyzed: number;
  followers: number;
  following: number;
  accountCreatedYear: number | null;
  firstActivityYear: number | null;
  lastActivityYear: number | null;
  activeYearCount: number;
  commitsSampled: number;
  pullRequestsTotal: number | null;
  pullRequestsSampled: number;
  mergedPullRequestsSampled: number;
  issuesTotal: number | null;
  issuesSampled: number;
  externalPullRequestsSampled: number;
  externalReposCount: number;
  topLanguages: GitHubLanguageStat[];
  languageSource: GitHubLanguageSource;
}

export interface GitHubYearActivity {
  year: number;
  commitsSampled: number;
  pullRequestsSampled: number;
  issuesSampled: number;
  reposCreated: number;
  reposPushed: number;
  activityValue: number;
  activityMetric: 'sampled-signals' | 'none';
  lowerBound: boolean;
}

export interface GitHubCollaboration {
  externalRepos: Array<{ fullName: string; pullRequests: number; merged: number }>;
  issueAuthoringSampled: number;
}

export interface GitHubCoverage {
  mode: GitHubMode;
  tokenInvalid: boolean;
  sampled: boolean;
  repositoriesTotal: number;
  repositoriesAnalyzed: number;
  repositoriesTruncated: boolean;
  activeYearsFound: number;
  activeYearsSampled: number;
  detailRepos: number;
  readmesFetched: number;
  commitPagesFetched: number;
  profileReadmeFetched: boolean;
  pullRequestsTotal: number | null;
  pullRequestsSampled: number;
  issuesTotal: number | null;
  issuesSampled: number;
  searchIncomplete: boolean;
  requests: GitHubRequestCounts;
  rateLimitStart: GitHubRateLimits | null;
  rateLimitEnd: GitHubRateLimits | null;
  warnings: string[];
  limitations: string[];
}

export interface GitHubDataset {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  repoDetails: Record<string, GitHubRepoDetail>;
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  searchCommits: GitHubCommit[];
  profileReadme: string | null;
  stats: GitHubStats;
  timeline: GitHubYearActivity[];
  projects: GitHubProject[];
  collaboration: GitHubCollaboration;
  coverage: GitHubCoverage;
  fetchedAt: string;
}

export interface GitHubWorkSummary {
  headline: string;
  professionalOverview: string;
  expertise: Array<{ area: string; evidence: string[] }>;
  workTimeline: Array<{
    fromYear: number;
    toYear: number;
    label: string;
    summary: string;
    evidence: string[];
  }>;
  projectSpotlights: Array<{
    repo: string;
    whatItIs: string;
    technicalSignals: string[];
    whyItMatters: string;
  }>;
  collaborationSignals: string[];
  workStyleObservations: string[];
  resumeBullets: Array<{ text: string; evidence: string[] }>;
  caveats: string[];
}

export interface GitHubSummaryMeta {
  provider: string;
  model: string;
  generatedAt: string;
}

export interface GitHubSummaryValidation {
  summary: GitHubWorkSummary;
  warnings: string[];
  usable: boolean;
}

type GitHubCollectStage =
  | 'preflight'
  | 'profile'
  | 'repositories'
  | 'details'
  | 'activity'
  | 'aggregate';

export interface GitHubProgress {
  stage: GitHubCollectStage;
  message: string;
  completed?: number;
  total?: number;
  requests: GitHubRequestCounts;
  coreRemaining: number | null;
  searchRemaining: number | null;
}

export interface GitHubClientOptions {
  token?: string | null;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  maxCore: number;
  maxSearch: number;
}

export interface GitHubClient {
  requestJson<T>(path: string, resource: 'core' | 'search', accept?: string): Promise<T>;
  requestText(path: string, accept?: string): Promise<string>;
  getRateLimits(): Promise<GitHubRateLimits | null>;
  readonly counts: GitHubRequestCounts;
  readonly lastRateLimits: GitHubRateLimits | null;
}

export interface GitHubTokenVerification {
  login: string;
  name: string | null;
  scopes: string[];
  rateLimit: GitHubRateLimit | null;
}
