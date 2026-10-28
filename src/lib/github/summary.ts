import type { GitHubDataset, GitHubSummaryValidation, GitHubWorkSummary } from '@/types';
import { stripMarkdownToText } from './normalize';

function asString(value: unknown, maxChars: number): string {
  if (typeof value !== 'string') return '';
  return stripMarkdownToText(value).slice(0, maxChars).trim();
}

function asStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function addAll(target: Set<number>, values: number[]): void {
  for (const value of values) {
    if (Number.isFinite(value)) target.add(value);
  }
}

function addNumbersFromText(target: Set<number>, value: string): void {
  for (const match of value.matchAll(/\d+(?:\.\d+)?/g)) {
    const number = Number(match[0]);
    if (Number.isFinite(number)) target.add(number);
  }
}

export function buildAllowedNumbers(dataset: GitHubDataset): Set<number> {
  const allowed = new Set<number>();
  const { profile, stats, coverage, timeline, projects, collaboration } = dataset;

  addAll(allowed, [
    profile.publicRepos,
    profile.followers,
    profile.following,
    stats.publicRepos,
    stats.reposAnalyzed,
    stats.originalReposAnalyzed,
    stats.forkedReposAnalyzed,
    stats.archivedReposAnalyzed,
    stats.starsAnalyzed,
    stats.forksAnalyzed,
    stats.followers,
    stats.following,
    stats.activeYearCount,
    stats.commitsSampled,
    stats.pullRequestsSampled,
    stats.mergedPullRequestsSampled,
    stats.issuesSampled,
    stats.externalPullRequestsSampled,
    stats.externalReposCount,
    coverage.repositoriesAnalyzed,
    coverage.repositoriesTotal,
    coverage.activeYearsFound,
    coverage.activeYearsSampled,
    coverage.detailRepos,
    coverage.readmesFetched,
    coverage.commitPagesFetched,
    coverage.pullRequestsSampled,
    coverage.issuesSampled,
    coverage.requests.core,
    coverage.requests.search,
  ]);

  if (stats.accountCreatedYear != null) allowed.add(stats.accountCreatedYear);
  if (stats.firstActivityYear != null) allowed.add(stats.firstActivityYear);
  if (stats.lastActivityYear != null) allowed.add(stats.lastActivityYear);
  if (stats.pullRequestsTotal != null) allowed.add(stats.pullRequestsTotal);
  if (stats.issuesTotal != null) allowed.add(stats.issuesTotal);
  if (
    stats.firstActivityYear != null &&
    stats.lastActivityYear != null &&
    stats.lastActivityYear >= stats.firstActivityYear
  ) {
    allowed.add(stats.lastActivityYear - stats.firstActivityYear + 1);
  }

  for (const language of stats.topLanguages) {
    addAll(allowed, [language.value, language.percentage, language.repoCount]);
  }
  for (const row of timeline) {
    addAll(allowed, [
      row.year,
      row.commitsSampled,
      row.pullRequestsSampled,
      row.issuesSampled,
      row.reposCreated,
      row.reposPushed,
      row.activityValue,
    ]);
  }
  for (const project of projects) {
    addAll(allowed, [
      project.repo.stars,
      project.repo.forks,
      project.commitCountSampled,
      project.score,
      ...project.languages.map((language) => language.percentage),
    ]);
    if (project.repo.createdAt) {
      const year = new Date(project.repo.createdAt).getUTCFullYear();
      if (!Number.isNaN(year)) allowed.add(year);
    }
    if (project.repo.pushedAt) {
      const year = new Date(project.repo.pushedAt).getUTCFullYear();
      if (!Number.isNaN(year)) allowed.add(year);
    }
    addNumbersFromText(allowed, project.repo.fullName);
    for (const topic of project.repo.topics) addNumbersFromText(allowed, topic);
  }
  for (const repo of dataset.repos) {
    addNumbersFromText(allowed, repo.fullName);
  }
  addNumbersFromText(allowed, profile.login);
  allowed.add(projects.length);
  allowed.add(Math.min(8, stats.topLanguages.length));
  allowed.add(collaboration.externalRepos.length);

  return allowed;
}

export function findUngroundedNumbers(text: string, allowed: Set<number>): string[] {
  const ungrounded: string[] = [];
  for (const match of text.matchAll(
    /(?<![A-Za-z])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)([kKmM])?(%)?(?![A-Za-z])/g
  )) {
    const raw = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(raw)) continue;
    const multiplier =
      match[2]?.toLowerCase() === 'k' ? 1_000 : match[2]?.toLowerCase() === 'm' ? 1_000_000 : 1;
    const value = raw * multiplier;
    const tolerance = match[3] ? 1.0 : 0;
    let found = false;
    for (const candidate of allowed) {
      if (Math.abs(candidate - value) <= tolerance) {
        found = true;
        break;
      }
    }
    if (!found) ungrounded.push(match[0]);
  }
  return ungrounded;
}

function hasNumbers(text: string, allowed: Set<number>): boolean {
  return findUngroundedNumbers(text, allowed).length > 0;
}

function allGrounded(values: string[], allowed: Set<number>): boolean {
  return values.every((value) => !hasNumbers(value, allowed));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isUsableGitHubSummary(summary: GitHubWorkSummary): boolean {
  return (
    summary.headline.trim().length > 0 &&
    summary.professionalOverview.trim().length >= 80 &&
    (summary.expertise.length > 0 ||
      summary.workTimeline.length > 0 ||
      summary.projectSpotlights.length > 0)
  );
}

export function validateGitHubSummary(
  raw: unknown,
  dataset: GitHubDataset
): GitHubSummaryValidation {
  const warnings: string[] = [];
  const allowedNumbers = buildAllowedNumbers(dataset);
  const projectAllowlist = new Map(
    dataset.projects.map((project) => [project.repo.fullName.toLowerCase(), project.repo.fullName])
  );
  const years = dataset.timeline.map((row) => row.year);
  const minYear = years[0] ?? null;
  const maxYear = years[years.length - 1] ?? null;

  if (!isRecord(raw)) {
    return {
      summary: emptySummary(dataset),
      warnings: ['The AI response was not a JSON object.'],
      usable: false,
    };
  }

  let usable = true;
  let headline = asString(raw.headline, 120);
  let professionalOverview = asString(raw.professionalOverview, 1200);

  if (headline && hasNumbers(headline, allowedNumbers)) {
    headline = '';
    warnings.push('The generated headline contained an unverified number and was removed.');
    usable = false;
  }
  if (professionalOverview && hasNumbers(professionalOverview, allowedNumbers)) {
    professionalOverview = '';
    warnings.push('The generated overview contained an unverified number and was removed.');
    usable = false;
  }

  const expertise: GitHubWorkSummary['expertise'] = [];
  if (Array.isArray(raw.expertise)) {
    for (const item of raw.expertise) {
      if (!isRecord(item)) continue;
      const area = asString(item.area, 160);
      const evidence = asStringArray(item.evidence, 5, 220);
      if (!area) continue;
      if (!allGrounded([area, ...evidence], allowedNumbers)) {
        warnings.push('An expertise item containing an unverified number was removed.');
        continue;
      }
      expertise.push({ area, evidence });
      if (expertise.length >= 6) break;
    }
  }

  const workTimeline: GitHubWorkSummary['workTimeline'] = [];
  if (Array.isArray(raw.workTimeline)) {
    for (const item of raw.workTimeline) {
      if (!isRecord(item)) continue;
      let fromYear = Number(item.fromYear);
      let toYear = Number(item.toYear);
      if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) continue;
      if (fromYear > toYear) [fromYear, toYear] = [toYear, fromYear];
      if (minYear != null) fromYear = Math.max(minYear, fromYear);
      if (maxYear != null) toYear = Math.min(maxYear, toYear);
      if (toYear < fromYear) continue;
      const label = asString(item.label, 120);
      const summary = asString(item.summary, 700);
      const evidence = asStringArray(item.evidence, 5, 220);
      if (!label && !summary) continue;
      if (!allGrounded([label, summary, ...evidence], allowedNumbers)) {
        warnings.push('A timeline entry containing an unverified number was removed.');
        continue;
      }
      workTimeline.push({ fromYear, toYear, label, summary, evidence });
      if (workTimeline.length >= 8) break;
    }
  }

  const projectSpotlights: GitHubWorkSummary['projectSpotlights'] = [];
  if (Array.isArray(raw.projectSpotlights)) {
    for (const item of raw.projectSpotlights) {
      if (!isRecord(item)) continue;
      const requestedRepo = asString(item.repo, 160).toLowerCase();
      const repo = projectAllowlist.get(requestedRepo);
      if (!repo) {
        warnings.push(
          'The AI referenced a repository that was not in the fetched data; it was removed.'
        );
        continue;
      }
      const whatItIs = asString(item.whatItIs, 700);
      const technicalSignals = asStringArray(item.technicalSignals, 8, 220);
      const whyItMatters = asString(item.whyItMatters, 700);
      if (!whatItIs && !whyItMatters) continue;
      if (!allGrounded([whatItIs, whyItMatters, ...technicalSignals], allowedNumbers)) {
        warnings.push('A project spotlight containing an unverified number was removed.');
        continue;
      }
      projectSpotlights.push({ repo, whatItIs, technicalSignals, whyItMatters });
      if (projectSpotlights.length >= 6) break;
    }
  }

  const collaborationSignals = extractGroundedList(
    raw.collaborationSignals,
    8,
    300,
    allowedNumbers,
    warnings,
    'collaboration signal'
  );
  const workStyleObservations = extractGroundedList(
    raw.workStyleObservations,
    6,
    300,
    allowedNumbers,
    warnings,
    'work-style observation'
  );

  const resumeBullets: GitHubWorkSummary['resumeBullets'] = [];
  if (Array.isArray(raw.resumeBullets)) {
    for (const item of raw.resumeBullets) {
      if (!isRecord(item)) continue;
      const text = asString(item.text, 300);
      const evidence = asStringArray(item.evidence, 4, 220);
      if (!text) continue;
      if (!allGrounded([text, ...evidence], allowedNumbers)) {
        warnings.push('A resume bullet containing an unverified number was removed.');
        continue;
      }
      resumeBullets.push({ text, evidence });
      if (resumeBullets.length >= 8) break;
    }
  }

  const caveats = extractGroundedList(raw.caveats, 5, 300, allowedNumbers, warnings, 'caveat');

  if (caveats.length === 0) {
    caveats.push(
      'Based on sampled public GitHub REST data; this is not a complete contribution history.'
    );
  }

  if (!headline) headline = `Public GitHub work by @${dataset.profile.login}`;
  if (!professionalOverview) {
    professionalOverview = `This report summarizes sampled public GitHub REST data for @${dataset.profile.login}. The generated narrative was removed because it contained unverified numeric claims. Deterministic statistics and project facts remain available in this report.`;
    usable = false;
  }

  const summary: GitHubWorkSummary = {
    headline,
    professionalOverview,
    expertise,
    workTimeline,
    projectSpotlights,
    collaborationSignals,
    workStyleObservations,
    resumeBullets,
    caveats,
  };

  if (isUsableGitHubSummary(summary) && usable) {
    return { summary, warnings, usable: true };
  }

  if (warnings.length === 0) {
    warnings.push('The AI response did not include enough usable content.');
  }
  return { summary, warnings, usable: false };
}

function extractGroundedList(
  value: unknown,
  maxItems: number,
  maxChars: number,
  allowedNumbers: Set<number>,
  warnings: string[],
  label: string
): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const rawItem of value) {
    const item = asString(rawItem, maxChars);
    if (!item) continue;
    if (hasNumbers(item, allowedNumbers)) {
      warnings.push(`A ${label} containing an unverified number was removed.`);
      continue;
    }
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}

function emptySummary(dataset: GitHubDataset): GitHubWorkSummary {
  return {
    headline: `Public GitHub work by @${dataset.profile.login}`,
    professionalOverview: '',
    expertise: [],
    workTimeline: [],
    projectSpotlights: [],
    collaborationSignals: [],
    workStyleObservations: [],
    resumeBullets: [],
    caveats: [
      'Based on sampled public GitHub REST data; this is not a complete contribution history.',
    ],
  };
}
