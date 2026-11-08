import { describe, expect, it } from 'vitest';
import {
  aggregateLanguages,
  buildCollaboration,
  buildCoverage,
  buildProjects,
  buildTimeline,
  chooseYearRepresentatives,
  collectActiveYears,
  recencyBonus,
  sampleActiveYears,
  scoreRepo,
  selectDetailTargets,
} from './aggregate';
import {
  alphaRepo,
  gammaRepo,
  makeDataset,
  repoDetails,
  repos,
  testNow,
} from './__tests__/fixtures';

describe('GitHub aggregation', () => {
  it('scores originals above forks and applies the exact recency bonus', () => {
    expect(scoreRepo(alphaRepo, testNow)).toBeGreaterThan(scoreRepo(gammaRepo, testNow));
    expect(recencyBonus('2026-05-15T00:00:00Z', testNow)).toBe(3);
    expect(recencyBonus('2020-01-01T00:00:00Z', testNow)).toBe(0);
    expect(recencyBonus('2026-08-01T00:00:00Z', testNow)).toBe(3);
  });

  it('samples active years deterministically within the cap', () => {
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const sampled = sampleActiveYears(years, 6);
    expect(sampled).toHaveLength(6);
    expect(sampled[0]).toBe(2015);
    expect(sampled[sampled.length - 1]).toBe(2026);
    expect(new Set(sampled).size).toBe(6);
    expect(sampled).toEqual([...sampled].sort((a, b) => a - b));
  });

  it('deduplicates the union of top repos and year representatives', () => {
    const selection = selectDetailTargets({
      repos,
      topLimit: 2,
      yearLimit: 2,
      now: testNow,
    });
    expect(selection.topTargets.map((repo) => repo.fullName)).toEqual([
      'octocat/alpha',
      'octocat/beta',
    ]);
    expect(selection.targets.map((repo) => repo.fullName)).toEqual([
      'octocat/alpha',
      'octocat/beta',
    ]);
    expect(new Set(selection.targets.map((repo) => repo.fullName)).size).toBe(
      selection.targets.length
    );
    expect(selection.yearReps.some((rep) => rep.year === 2015)).toBe(true);
    expect(selection.targets.some((repo) => repo.isFork)).toBe(false);
  });

  it('chooses languages from one source globally, never mixing bytes and repo counts', () => {
    const byteResult = aggregateLanguages(repos, repoDetails);
    expect(byteResult.source).toBe('languages-api');
    expect(byteResult.languages[0]?.name).toBe('TypeScript');
    expect(byteResult.languages.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(
      100,
      5
    );

    const primaryResult = aggregateLanguages(repos, {});
    expect(primaryResult.source).toBe('primary-language');
    expect(primaryResult.languages.map((item) => item.name)).toEqual([
      'Go',
      'Python',
      'TypeScript',
    ]);
    expect(primaryResult.languages.every((item) => item.value === 1)).toBe(true);
  });

  it('builds a full-year lower-bound timeline with gaps retained', () => {
    const timeline = buildTimeline({
      repos,
      repoDetails,
      searchCommits: makeDataset().searchCommits,
      pullRequests: makeDataset().pullRequests,
      issues: makeDataset().issues,
      now: testNow,
    });
    expect(timeline[0].year).toBe(2015);
    expect(timeline[timeline.length - 1].year).toBe(2026);
    expect(timeline).toHaveLength(12);
    expect(timeline.find((row) => row.year === 2024)?.activityValue).toBe(0);
    expect(timeline.every((row) => row.lowerBound)).toBe(true);
    for (const row of timeline) {
      expect(row.activityValue).toBe(
        row.commitsSampled + row.pullRequestsSampled + row.issuesSampled
      );
    }
    const years = new Set(timeline.map((row) => row.year));
    expect(years.has(2015)).toBe(true);
    expect(years.has(2020)).toBe(true);
    expect(years.has(2026)).toBe(true);
  });

  it('collects external collaboration and merged PR samples', () => {
    const dataset = makeDataset();
    const collaboration = buildCollaboration('octocat', dataset.pullRequests, dataset.issues);
    expect(collaboration.externalRepos).toEqual([
      { fullName: 'org/lib', pullRequests: 2, merged: 1 },
    ]);
    expect(collaboration.issueAuthoringSampled).toBe(1);
    expect(collectActiveYears(repos)).toContain(2026);
    expect(chooseYearRepresentatives(repos, [2015, 2026], testNow)).toHaveLength(2);
  });

  it('records effective coverage mode and truncation warnings', () => {
    const coverage = buildCoverage({
      profile: makeDataset().profile,
      mode: 'anonymous',
      tokenInvalid: true,
      repos: repos.slice(0, 2),
      activeYearsFound: 6,
      activeYearsSampled: 3,
      detailRepos: 2,
      readmesFetched: 1,
      commitPagesFetched: 3,
      profileReadmeFetched: false,
      pullRequestsTotal: 2,
      pullRequests: makeDataset().pullRequests,
      issuesTotal: 1,
      issues: makeDataset().issues,
      searchIncomplete: true,
      requests: { core: 10, search: 2 },
      rateLimitStart: makeDataset().coverage.rateLimitStart,
      rateLimitEnd: makeDataset().coverage.rateLimitEnd,
      warnings: [],
    });
    expect(coverage.mode).toBe('anonymous');
    expect(coverage.tokenInvalid).toBe(true);
    expect(coverage.repositoriesTruncated).toBe(true);
    expect(coverage.limitations.join(' ')).toContain('2 of 5');
    expect(coverage.limitations.join(' ')).toContain('token was rejected');
    expect(coverage.searchIncomplete).toBe(true);
  });

  it('ranks projects with original repos only and excludes profile READMEs and forks', () => {
    const projects = buildProjects(repos, repoDetails, testNow);
    expect(projects.map((project) => project.repo.fullName)).toEqual([
      'octocat/alpha',
      'octocat/beta',
      'octocat/delta',
    ]);
    expect(projects.some((project) => project.repo.isFork)).toBe(false);
    expect(projects.some((project) => project.repo.isProfileReadme)).toBe(false);
    expect(projects[0].languages[0]).toEqual({ name: 'TypeScript', percentage: 80 });
  });
});
