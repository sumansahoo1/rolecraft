import type { GitHubCommit, GitHubDataset } from '@/types';
import type { ChatMessage } from '@/lib/ai/provider';
import { GITHUB_WORK_SUMMARY_PROMPT } from '@/lib/ai/prompts';

function yearOf(value: string): number | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

function truncate(value: string | null, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export function sampleCommits(commits: GitHubCommit[], limit = 40): GitHubCommit[] {
  const unique = new Map<string, GitHubCommit>();
  for (const commit of commits) {
    if (!unique.has(commit.sha)) unique.set(commit.sha, commit);
  }
  const sorted = [...unique.values()].sort(
    (a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt)
  );

  const picked = new Map<string, GitHubCommit>();
  const add = (commit: GitHubCommit | undefined) => {
    if (commit && picked.size < limit) picked.set(commit.sha, commit);
  };

  sorted.slice(0, 10).forEach(add);
  sorted.slice(-10).forEach(add);

  const seenYears = new Set<number>();
  for (const commit of sorted) {
    const year = yearOf(commit.authoredAt);
    if (year == null || seenYears.has(year)) continue;
    seenYears.add(year);
    add(commit);
    if (picked.size >= limit) break;
  }

  return [...picked.values()]
    .sort((a, b) => Date.parse(b.authoredAt) - Date.parse(a.authoredAt))
    .slice(0, limit);
}

function buildBaseDossier(dataset: GitHubDataset) {
  const { profile, stats, coverage, timeline, projects, collaboration } = dataset;
  const allCommits = [
    ...Object.values(dataset.repoDetails).flatMap((detail) => detail.commits),
    ...dataset.searchCommits,
  ];

  return {
    profile: {
      login: profile.login,
      name: profile.name,
      bio: truncate(profile.bio, 400),
      company: profile.company,
      location: profile.location,
      blog: profile.blog,
      createdYear: stats.accountCreatedYear,
      followers: profile.followers,
      following: profile.following,
    },
    coverage: {
      mode: coverage.mode,
      tokenInvalid: coverage.tokenInvalid,
      sampled: coverage.sampled,
      repositoriesAnalyzed: coverage.repositoriesAnalyzed,
      repositoriesTotal: coverage.repositoriesTotal,
      activeYearsFound: coverage.activeYearsFound,
      activeYearsSampled: coverage.activeYearsSampled,
      profileReadmeFetched: coverage.profileReadmeFetched,
      limitations: coverage.limitations,
    },
    stats: {
      publicRepos: stats.publicRepos,
      reposAnalyzed: stats.reposAnalyzed,
      originalReposAnalyzed: stats.originalReposAnalyzed,
      starsAnalyzed: stats.starsAnalyzed,
      forksAnalyzed: stats.forksAnalyzed,
      followers: stats.followers,
      following: stats.following,
      firstActivityYear: stats.firstActivityYear,
      lastActivityYear: stats.lastActivityYear,
      activeYearCount: stats.activeYearCount,
      commitsSampled: stats.commitsSampled,
      pullRequestsTotal: stats.pullRequestsTotal,
      pullRequestsSampled: stats.pullRequestsSampled,
      mergedPullRequestsSampled: stats.mergedPullRequestsSampled,
      issuesTotal: stats.issuesTotal,
      issuesSampled: stats.issuesSampled,
      externalPullRequestsSampled: stats.externalPullRequestsSampled,
      externalReposCount: stats.externalReposCount,
    },
    languages: stats.topLanguages.slice(0, 8).map((language) => ({
      name: language.name,
      percentage: Number(language.percentage.toFixed(1)),
      repoCount: language.repoCount,
      source: stats.languageSource,
    })),
    years: timeline.map((year) => ({
      year: year.year,
      commitsSampled: year.commitsSampled,
      pullRequestsSampled: year.pullRequestsSampled,
      issuesSampled: year.issuesSampled,
      reposCreated: year.reposCreated,
      reposPushed: year.reposPushed,
      activityValue: year.activityValue,
      lowerBound: year.lowerBound,
    })),
    projects: projects.map((project) => ({
      repo: project.repo.fullName,
      description: truncate(project.repo.description, 300),
      url: project.repo.htmlUrl,
      stars: project.repo.stars,
      forks: project.repo.forks,
      primaryLanguage: project.repo.primaryLanguage,
      topics: project.repo.topics.slice(0, 5),
      createdYear: project.repo.createdAt ? yearOf(project.repo.createdAt) : null,
      lastPushYear: project.repo.pushedAt ? yearOf(project.repo.pushedAt) : null,
      languages: project.languages,
      commitsSampled: project.commitCountSampled,
      readme: truncate(project.readmeExcerpt, 600),
    })),
    profileReadme: truncate(dataset.profileReadme, 1200),
    commitSamples: sampleCommits(allCommits).map((commit) => ({
      repo: commit.repoFullName,
      year: yearOf(commit.authoredAt),
      message: truncate(commit.message, 120),
    })),
    pullRequests: dataset.pullRequests.slice(0, 20).map((pr) => ({
      repo: pr.repoFullName,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      year: yearOf(pr.createdAt),
      external: pr.isExternal,
    })),
    issues: dataset.issues.slice(0, 10).map((issue) => ({
      repo: issue.repoFullName,
      title: issue.title,
      state: issue.state,
      year: yearOf(issue.createdAt),
      external: issue.isExternal,
    })),
    collaboration: {
      externalRepos: collaboration.externalRepos.slice(0, 10),
      issueAuthoringSampled: collaboration.issueAuthoringSampled,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function capProjectText(project: any, descriptionCap: number, dropReadme: boolean): void {
  project.description = truncate(project.description, descriptionCap);
  if (dropReadme) project.readme = null;
  else project.readme = truncate(project.readme, 300);
}

export interface SummaryContext {
  json: string;
  truncated: boolean;
  chars: number;
}

export function buildSummaryContext(dataset: GitHubDataset, maxChars: number): SummaryContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dossier: any = buildBaseDossier(dataset);
  let truncated = false;

  const fits = () => JSON.stringify(dossier).length <= maxChars;
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  truncated = true;
  dossier.commitSamples = [];
  dossier.pullRequests = dossier.pullRequests.slice(0, 10);
  dossier.issues = dossier.issues.slice(0, 10);
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  dossier.profileReadme = null;
  dossier.projects = dossier.projects.slice(0, 4);
  for (const project of dossier.projects) capProjectText(project, 300, false);
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  dossier.projects = dossier.projects.slice(0, 3);
  for (const project of dossier.projects) capProjectText(project, 160, true);
  dossier.pullRequests = dossier.pullRequests.slice(0, 6);
  dossier.issues = dossier.issues.slice(0, 5);
  dossier.languages = dossier.languages.slice(0, 5);
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  // Last-resort fixed caps. Keep profile/coverage/stats and a timeline summary.
  dossier.projects = dossier.projects.slice(0, 2);
  for (const project of dossier.projects) {
    project.description = truncate(project.description, 120);
    project.readme = null;
    project.topics = project.topics.slice(0, 3);
  }
  dossier.pullRequests = [];
  dossier.issues = [];
  dossier.languages = [];
  dossier.profileReadme = null;
  dossier.commitSamples = [];
  dossier.years = trimYears(dossier.years, 8);
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  dossier.projects = dossier.projects.slice(0, 1);
  dossier.years = trimYears(dossier.years, 4);
  dossier.profile.bio = truncate(dossier.profile.bio, 160);
  dossier.coverage.limitations = dossier.coverage.limitations.slice(0, 2);
  if (fits()) {
    const json = JSON.stringify(dossier);
    return { json, truncated, chars: json.length };
  }

  dossier.projects = [];
  dossier.years = trimYears(dossier.years, 2);
  const json = JSON.stringify(dossier);
  return { json, truncated, chars: json.length };
}

function trimYears<T>(years: T[], cap: number): T[] {
  if (years.length <= cap) return years;
  if (cap <= 0) return [];
  if (cap === 1) return [years[0]];
  const picked: T[] = [];
  for (let i = 0; i < cap; i++) {
    picked.push(years[Math.round((i * (years.length - 1)) / (cap - 1))]);
  }
  return picked;
}

export function buildSummaryMessages(dataset: GitHubDataset, maxChars: number): ChatMessage[] {
  const context = buildSummaryContext(dataset, maxChars);
  const safeJson = context.json.replace(/<\/dossier>/gi, '<\\/dossier>');
  const userMessage = [
    'Dossier:',
    '<dossier>',
    safeJson,
    '</dossier>',
    '',
    context.truncated
      ? 'The dossier was compacted to fit context limits. Use the coverage flags as the source of truth.'
      : '',
    'Return ONLY the JSON summary object now.',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system', content: GITHUB_WORK_SUMMARY_PROMPT },
    { role: 'user', content: userMessage },
  ];
}
