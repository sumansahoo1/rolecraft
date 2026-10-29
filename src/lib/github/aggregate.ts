import type {
  GitHubCollaboration,
  GitHubCommit,
  GitHubCoverage,
  GitHubDataset,
  GitHubLanguageSource,
  GitHubLanguageStat,
  GitHubMode,
  GitHubProfile,
  GitHubProject,
  GitHubPullRequest,
  GitHubRepo,
  GitHubRepoDetail,
  GitHubRequestCounts,
  GitHubStats,
  GitHubYearActivity,
  GitHubIssue,
  GitHubRateLimits,
} from '@/types';

const PROJECT_LIMIT = 8;

function yearOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function isOriginal(repo: GitHubRepo): boolean {
  return !repo.isFork && !repo.isProfileReadme;
}

export function recencyBonus(pushedAt: string | null, now: Date): number {
  if (!pushedAt) return 0;
  const ms = Date.parse(pushedAt);
  if (!Number.isFinite(ms)) return 0;
  const days = Math.max(0, (now.getTime() - ms) / 86_400_000);
  if (days <= 90) return 3;
  if (days >= 1095) return 0;
  return 3 * (1 - (days - 90) / (1095 - 90));
}

export function scoreRepo(repo: GitHubRepo, now: Date): number {
  const starScore = 3 * Math.log10(1 + Math.max(0, repo.stars));
  const forkScore = 1.5 * Math.log10(1 + Math.max(0, repo.forks));
  return (
    5 * Number(!repo.isFork) +
    starScore +
    forkScore +
    recencyBonus(repo.pushedAt, now) +
    0.5 * Number(Boolean(repo.description)) +
    0.5 * Number(repo.topics.length > 0) +
    0.5 * Number(Boolean(repo.homepage)) -
    3 * Number(repo.isArchived) -
    5 * Number(repo.isFork)
  );
}

export function rankRepos(repos: GitHubRepo[], now: Date): GitHubRepo[] {
  return [...repos].sort((a, b) => {
    const diff = scoreRepo(b, now) - scoreRepo(a, now);
    if (diff !== 0) return diff;
    return a.fullName.localeCompare(b.fullName);
  });
}

export function collectActiveYears(repos: GitHubRepo[]): number[] {
  const years = new Set<number>();
  for (const repo of repos) {
    if (!isOriginal(repo)) continue;
    const created = yearOf(repo.createdAt);
    const pushed = yearOf(repo.pushedAt);
    if (created != null) years.add(created);
    if (pushed != null) years.add(pushed);
  }
  return [...years].sort((a, b) => a - b);
}

export function sampleActiveYears(years: number[], cap: number): number[] {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  if (cap <= 0) return [];
  if (sorted.length <= cap) return sorted;

  const picked = new Set<number>([sorted[0]]);
  for (let i = 1; i < cap - 1; i++) {
    picked.add(sorted[Math.round((i * (sorted.length - 1)) / (cap - 1))]);
  }
  picked.add(sorted[sorted.length - 1]);

  for (let i = sorted.length - 1; picked.size < cap && i >= 0; i--) {
    picked.add(sorted[i]);
  }
  return [...picked].sort((a, b) => a - b);
}

function repoActiveInYear(repo: GitHubRepo, year: number): boolean {
  return yearOf(repo.createdAt) === year || yearOf(repo.pushedAt) === year;
}

export function chooseYearRepresentatives(
  repos: GitHubRepo[],
  years: number[],
  now: Date
): Array<{ year: number; repo: GitHubRepo }> {
  const ranked = rankRepos(repos, now);
  const originals = ranked.filter((repo) => !repo.isFork && !repo.isProfileReadme);
  const forks = ranked.filter((repo) => repo.isFork);
  const result: Array<{ year: number; repo: GitHubRepo }> = [];

  for (const year of years) {
    const repo =
      originals.find((candidate) => repoActiveInYear(candidate, year)) ??
      forks.find((candidate) => repoActiveInYear(candidate, year));
    if (repo) result.push({ year, repo });
  }
  return result;
}

export interface DetailSelection {
  topTargets: GitHubRepo[];
  yearReps: Array<{ year: number; repo: GitHubRepo }>;
  targets: GitHubRepo[];
}

export function selectDetailTargets(args: {
  repos: GitHubRepo[];
  topLimit: number;
  yearLimit: number;
  now: Date;
}): DetailSelection {
  const { repos, topLimit, yearLimit, now } = args;
  const topTargets = rankRepos(
    repos.filter((repo) => !repo.isFork && !repo.isProfileReadme),
    now
  ).slice(0, topLimit);

  const activeYears = collectActiveYears(repos);
  const sampledYears = sampleActiveYears(activeYears, yearLimit);
  const yearReps = chooseYearRepresentatives(repos, sampledYears, now);

  const seen = new Set<string>();
  const targets: GitHubRepo[] = [];
  for (const repo of [...topTargets, ...yearReps.map((rep) => rep.repo)]) {
    if (seen.has(repo.fullName)) continue;
    seen.add(repo.fullName);
    targets.push(repo);
  }

  return { topTargets, yearReps, targets };
}

function uniqueCommits(
  repoDetails: Record<string, GitHubRepoDetail>,
  searchCommits: GitHubCommit[]
): GitHubCommit[] {
  const seen = new Set<string>();
  const commits: GitHubCommit[] = [];
  for (const detail of Object.values(repoDetails)) {
    for (const commit of detail.commits) {
      if (seen.has(commit.sha)) continue;
      seen.add(commit.sha);
      commits.push(commit);
    }
  }
  for (const commit of searchCommits) {
    if (seen.has(commit.sha)) continue;
    seen.add(commit.sha);
    commits.push(commit);
  }
  return commits;
}

export function aggregateLanguages(
  repos: GitHubRepo[],
  repoDetails: Record<string, GitHubRepoDetail>
): { languages: GitHubLanguageStat[]; source: GitHubLanguageSource } {
  const originals = repos.filter(isOriginal);
  const detailRepos = originals.filter((repo) => {
    const detail = repoDetails[repo.fullName];
    return detail && Object.keys(detail.languages).length > 0;
  });

  if (detailRepos.length > 0) {
    const totals = new Map<string, { bytes: number; repoCount: number }>();
    for (const repo of detailRepos) {
      const languages = repoDetails[repo.fullName].languages;
      for (const [name, bytes] of Object.entries(languages)) {
        const current = totals.get(name) ?? { bytes: 0, repoCount: 0 };
        current.bytes += bytes;
        current.repoCount += 1;
        totals.set(name, current);
      }
    }
    const totalBytes = [...totals.values()].reduce((sum, item) => sum + item.bytes, 0);
    const languages = [...totals.entries()]
      .map(([name, item]) => ({
        name,
        value: item.bytes,
        percentage: totalBytes > 0 ? (item.bytes / totalBytes) * 100 : 0,
        repoCount: item.repoCount,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    return { languages, source: 'languages-api' };
  }

  const withPrimary = originals.filter((repo) => repo.primaryLanguage);
  if (withPrimary.length > 0) {
    const counts = new Map<string, number>();
    for (const repo of withPrimary) {
      const name = repo.primaryLanguage as string;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const total = withPrimary.length;
    const languages = [...counts.entries()]
      .map(([name, count]) => ({
        name,
        value: count,
        percentage: (count / total) * 100,
        repoCount: count,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    return { languages, source: 'primary-language' };
  }

  return { languages: [], source: 'none' };
}

export function buildTimeline(args: {
  repos: GitHubRepo[];
  repoDetails: Record<string, GitHubRepoDetail>;
  searchCommits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  now: Date;
}): GitHubYearActivity[] {
  const { repos, repoDetails, searchCommits, pullRequests, issues, now } = args;
  const originals = repos.filter(isOriginal);
  const commits = uniqueCommits(repoDetails, searchCommits);

  const years = new Set<number>();
  for (const repo of originals) {
    const created = yearOf(repo.createdAt);
    const pushed = yearOf(repo.pushedAt);
    if (created != null) years.add(created);
    if (pushed != null) years.add(pushed);
  }
  for (const commit of commits) {
    const year = yearOf(commit.authoredAt);
    if (year != null) years.add(year);
  }
  for (const pr of pullRequests) {
    const year = yearOf(pr.createdAt);
    if (year != null) years.add(year);
  }
  for (const issue of issues) {
    const year = yearOf(issue.createdAt);
    if (year != null) years.add(year);
  }

  if (years.size === 0) return [];

  const sorted = [...years].sort((a, b) => a - b);
  const first = sorted[0];
  const last = Math.min(now.getUTCFullYear(), sorted[sorted.length - 1]);
  const rows: GitHubYearActivity[] = [];

  for (let year = Math.min(first, last); year <= last; year++) {
    rows.push({
      year,
      commitsSampled: 0,
      pullRequestsSampled: 0,
      issuesSampled: 0,
      reposCreated: 0,
      reposPushed: 0,
      activityValue: 0,
      activityMetric: 'sampled-signals',
      lowerBound: true,
    });
  }

  const byYear = new Map(rows.map((row) => [row.year, row]));
  for (const commit of commits) {
    const year = yearOf(commit.authoredAt);
    const row = year != null ? byYear.get(year) : undefined;
    if (row) row.commitsSampled += 1;
  }
  for (const pr of pullRequests) {
    const year = yearOf(pr.createdAt);
    const row = year != null ? byYear.get(year) : undefined;
    if (row) row.pullRequestsSampled += 1;
  }
  for (const issue of issues) {
    const year = yearOf(issue.createdAt);
    const row = year != null ? byYear.get(year) : undefined;
    if (row) row.issuesSampled += 1;
  }
  for (const repo of originals) {
    const created = yearOf(repo.createdAt);
    const pushed = yearOf(repo.pushedAt);
    const createdRow = created != null ? byYear.get(created) : undefined;
    const pushedRow = pushed != null ? byYear.get(pushed) : undefined;
    if (createdRow) createdRow.reposCreated += 1;
    if (pushedRow) pushedRow.reposPushed += 1;
  }

  for (const row of rows) {
    row.activityValue = row.commitsSampled + row.pullRequestsSampled + row.issuesSampled;
    if (row.activityValue === 0 && row.reposCreated === 0 && row.reposPushed === 0) {
      row.activityMetric = 'none';
    }
  }

  return rows;
}

export function buildCollaboration(
  profileLogin: string,
  pullRequests: GitHubPullRequest[],
  issues: GitHubIssue[]
): GitHubCollaboration {
  const external = pullRequests.filter((pr) => pr.isExternal);
  const byRepo = new Map<string, { pullRequests: number; merged: number }>();
  for (const pr of external) {
    const current = byRepo.get(pr.repoFullName) ?? { pullRequests: 0, merged: 0 };
    current.pullRequests += 1;
    if (pr.merged) current.merged += 1;
    byRepo.set(pr.repoFullName, current);
  }

  return {
    externalRepos: [...byRepo.entries()]
      .map(([fullName, counts]) => ({ fullName, ...counts }))
      .sort((a, b) => b.pullRequests - a.pullRequests || a.fullName.localeCompare(b.fullName)),
    issueAuthoringSampled: issues.filter(
      (issue) => issue.repoFullName.split('/')[0].toLowerCase() !== profileLogin.toLowerCase()
    ).length,
  };
}

function projectLanguages(
  repo: GitHubRepo,
  detail: GitHubRepoDetail | undefined
): Array<{ name: string; percentage: number }> {
  if (detail) {
    const entries = Object.entries(detail.languages).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
    if (total > 0) {
      return entries.slice(0, 5).map(([name, bytes]) => ({
        name,
        percentage: (bytes / total) * 100,
      }));
    }
  }
  return repo.primaryLanguage ? [{ name: repo.primaryLanguage, percentage: 100 }] : [];
}

export function buildProjects(
  repos: GitHubRepo[],
  repoDetails: Record<string, GitHubRepoDetail>,
  now: Date
): GitHubProject[] {
  const originals = repos.filter((repo) => !repo.isFork && !repo.isProfileReadme);
  const projects = originals.map((repo) => {
    const detail = repoDetails[repo.fullName];
    const commitCountSampled = detail?.commits.length ?? 0;
    const readmeExcerpt = detail?.readmeExcerpt ?? null;
    const score =
      scoreRepo(repo, now) + 1.5 * Math.log10(1 + commitCountSampled) + (readmeExcerpt ? 1 : 0);
    const reasons = ['Original repository'];
    if (repo.stars > 0) reasons.push(`${repo.stars} GitHub stars`);
    if (recencyBonus(repo.pushedAt, now) >= 2) reasons.push('Recently active');
    if (readmeExcerpt) reasons.push('Includes documentation');

    return {
      repo,
      score,
      reasons,
      languages: projectLanguages(repo, detail),
      commitCountSampled,
      readmeExcerpt,
    };
  });

  return projects
    .sort((a, b) => b.score - a.score || a.repo.fullName.localeCompare(b.repo.fullName))
    .slice(0, PROJECT_LIMIT);
}

function computeStats(args: {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  timeline: GitHubYearActivity[];
  languages: GitHubLanguageStat[];
  languageSource: GitHubLanguageSource;
  commitsSampled: number;
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  collaboration: GitHubCollaboration;
  pullRequestsTotal: number | null;
  issuesTotal: number | null;
}): GitHubStats {
  const {
    profile,
    repos,
    timeline,
    languages,
    languageSource,
    commitsSampled,
    pullRequests,
    issues,
    collaboration,
    pullRequestsTotal,
    issuesTotal,
  } = args;
  const originals = repos.filter(isOriginal);
  const activeYearCount = timeline.filter(
    (row) => row.activityValue > 0 || row.reposCreated > 0 || row.reposPushed > 0
  ).length;

  return {
    publicRepos: profile.publicRepos,
    reposAnalyzed: repos.length,
    originalReposAnalyzed: originals.length,
    forkedReposAnalyzed: repos.filter((repo) => repo.isFork).length,
    archivedReposAnalyzed: repos.filter((repo) => repo.isArchived).length,
    starsAnalyzed: originals.reduce((sum, repo) => sum + repo.stars, 0),
    forksAnalyzed: originals.reduce((sum, repo) => sum + repo.forks, 0),
    followers: profile.followers,
    following: profile.following,
    accountCreatedYear: yearOf(profile.createdAt),
    firstActivityYear: timeline[0]?.year ?? null,
    lastActivityYear: timeline[timeline.length - 1]?.year ?? null,
    activeYearCount,
    commitsSampled,
    pullRequestsTotal,
    pullRequestsSampled: pullRequests.length,
    mergedPullRequestsSampled: pullRequests.filter((pr) => pr.merged).length,
    issuesTotal,
    issuesSampled: issues.length,
    externalPullRequestsSampled: pullRequests.filter((pr) => pr.isExternal).length,
    externalReposCount: collaboration.externalRepos.length,
    topLanguages: languages,
    languageSource,
  };
}

export function buildCoverage(args: {
  profile: GitHubProfile;
  mode: GitHubMode;
  tokenInvalid: boolean;
  repos: GitHubRepo[];
  activeYearsFound: number;
  activeYearsSampled: number;
  detailRepos: number;
  readmesFetched: number;
  commitPagesFetched: number;
  profileReadmeFetched: boolean;
  pullRequestsTotal: number | null;
  pullRequests: GitHubPullRequest[];
  issuesTotal: number | null;
  issues: GitHubIssue[];
  searchIncomplete: boolean;
  requests: GitHubRequestCounts;
  rateLimitStart: GitHubRateLimits | null;
  rateLimitEnd: GitHubRateLimits | null;
  warnings: string[];
}): GitHubCoverage {
  const {
    profile,
    mode,
    tokenInvalid,
    repos,
    activeYearsFound,
    activeYearsSampled,
    detailRepos,
    readmesFetched,
    commitPagesFetched,
    profileReadmeFetched,
    pullRequestsTotal,
    pullRequests,
    issuesTotal,
    issues,
    searchIncomplete,
    requests,
    rateLimitStart,
    rateLimitEnd,
  } = args;

  const limitations = [
    'Public repositories and public activity only.',
    'REST API only; no complete contribution calendar or lifetime contribution total.',
    'Commit evidence is sampled from default branches and may exclude other branches.',
    'Pull request and issue history is sampled, not complete.',
    'Yearly counts are lower-bound samples, not a GitHub contribution graph.',
  ];
  if (repos.length < profile.publicRepos) {
    limitations.push(
      `${repos.length} of ${profile.publicRepos} public repositories were analyzed.`
    );
  }
  if (activeYearsSampled < activeYearsFound) {
    limitations.push(
      `Commit evidence covers ${activeYearsSampled} of ${activeYearsFound} active years. Sampling varies by year.`
    );
  }
  if (tokenInvalid) {
    limitations.push('The GitHub token was rejected; this run used anonymous rate limits.');
  }
  if (searchIncomplete) {
    limitations.push('GitHub reported incomplete search results for this run.');
  }

  const warnings = [
    ...new Set([
      ...args.warnings,
      ...limitations.filter((item) => item.startsWith('The GitHub token')),
    ]),
  ];

  return {
    mode,
    tokenInvalid,
    sampled: true,
    repositoriesTotal: profile.publicRepos,
    repositoriesAnalyzed: repos.length,
    repositoriesTruncated: repos.length < profile.publicRepos,
    activeYearsFound,
    activeYearsSampled,
    detailRepos,
    readmesFetched,
    commitPagesFetched,
    profileReadmeFetched,
    pullRequestsTotal,
    pullRequestsSampled: pullRequests.length,
    issuesTotal,
    issuesSampled: issues.length,
    searchIncomplete,
    requests,
    rateLimitStart,
    rateLimitEnd,
    warnings,
    limitations,
  };
}

export function aggregateGitHubDataset(args: {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  repoDetails: Record<string, GitHubRepoDetail>;
  pullRequests: GitHubPullRequest[];
  issues: GitHubIssue[];
  searchCommits: GitHubCommit[];
  profileReadme: string | null;
  profileReadmeFetched: boolean;
  mode: GitHubMode;
  tokenInvalid: boolean;
  activeYearsFound: number;
  activeYearsSampled: number;
  detailRepos: number;
  readmesFetched: number;
  commitPagesFetched: number;
  pullRequestsTotal: number | null;
  issuesTotal: number | null;
  searchIncomplete: boolean;
  requests: GitHubRequestCounts;
  rateLimitStart: GitHubRateLimits | null;
  rateLimitEnd: GitHubRateLimits | null;
  warnings: string[];
  now: Date;
}): GitHubDataset {
  const {
    profile,
    repos,
    repoDetails,
    pullRequests,
    issues,
    searchCommits,
    profileReadme,
    mode,
    tokenInvalid,
    now,
  } = args;

  const { languages, source } = aggregateLanguages(repos, repoDetails);
  const timeline = buildTimeline({ repos, repoDetails, searchCommits, pullRequests, issues, now });
  const collaboration = buildCollaboration(profile.login, pullRequests, issues);
  const commits = uniqueCommits(repoDetails, searchCommits);
  const stats = computeStats({
    profile,
    repos,
    timeline,
    languages,
    languageSource: source,
    commitsSampled: commits.length,
    pullRequests,
    issues,
    collaboration,
    pullRequestsTotal: args.pullRequestsTotal,
    issuesTotal: args.issuesTotal,
  });
  const projects = buildProjects(repos, repoDetails, now);
  const timelineActiveYears = timeline.filter(
    (row) => row.activityValue > 0 || row.reposCreated > 0 || row.reposPushed > 0
  ).length;
  const coverage = buildCoverage({
    profile,
    mode,
    tokenInvalid,
    repos,
    activeYearsFound: Math.max(args.activeYearsFound, timelineActiveYears),
    activeYearsSampled: args.activeYearsSampled,
    detailRepos: args.detailRepos,
    readmesFetched: args.readmesFetched,
    commitPagesFetched: args.commitPagesFetched,
    profileReadmeFetched: args.profileReadmeFetched,
    pullRequestsTotal: args.pullRequestsTotal,
    pullRequests,
    issuesTotal: args.issuesTotal,
    issues,
    searchIncomplete: args.searchIncomplete,
    requests: args.requests,
    rateLimitStart: args.rateLimitStart,
    rateLimitEnd: args.rateLimitEnd,
    warnings: args.warnings,
  });

  return {
    profile,
    repos,
    repoDetails,
    pullRequests,
    issues,
    searchCommits,
    profileReadme,
    stats,
    timeline,
    projects,
    collaboration,
    coverage,
    fetchedAt: now.toISOString(),
  };
}
