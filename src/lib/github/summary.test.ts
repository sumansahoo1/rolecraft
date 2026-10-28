import { describe, expect, it } from 'vitest';
import {
  buildAllowedNumbers,
  findUngroundedNumbers,
  isUsableGitHubSummary,
  validateGitHubSummary,
} from './summary';
import { makeDataset, makeSummary } from './__tests__/fixtures';

describe('GitHub summary validation', () => {
  it('accepts a valid grounded summary', () => {
    const result = validateGitHubSummary(makeSummary(), makeDataset());
    expect(result.usable).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.summary.headline.length).toBeLessThanOrEqual(120);
    expect(isUsableGitHubSummary(result.summary)).toBe(true);
  });

  it('drops spotlights for repositories that were not fetched', () => {
    const raw = makeSummary({
      projectSpotlights: [
        {
          repo: 'octocat/unknown',
          whatItIs: 'Invented project.',
          technicalSignals: [],
          whyItMatters: 'Not real.',
        },
        ...makeSummary().projectSpotlights,
      ],
    });
    const result = validateGitHubSummary(raw, makeDataset());
    expect(result.summary.projectSpotlights.map((item) => item.repo)).toEqual(['octocat/alpha']);
    expect(result.warnings.join(' ')).toContain('not in the fetched data');
  });

  it('clamps and swaps timeline years to the fetched range', () => {
    const result = validateGitHubSummary(
      makeSummary({
        workTimeline: [
          {
            fromYear: 2030,
            toYear: 1999,
            label: 'Out of range',
            summary: 'Clamped era.',
            evidence: [],
          },
        ],
      }),
      makeDataset()
    );
    expect(result.summary.workTimeline[0]).toMatchObject({ fromYear: 2015, toYear: 2026 });
  });

  it('strips HTML and markdown links from AI text', () => {
    const result = validateGitHubSummary(
      makeSummary({
        headline: '<b>Hello</b> [Docs](https://evil.example)',
        professionalOverview:
          'This is a long enough overview for validation, with a [link](https://evil.example) and <em>HTML</em> that should be removed completely.',
      }),
      makeDataset()
    );
    expect(result.summary.headline).toBe('Hello Docs');
    expect(result.summary.professionalOverview).not.toContain('<em>');
    expect(result.summary.professionalOverview).not.toContain('https://evil.example');
    expect(result.summary.professionalOverview).toContain('link');
  });

  it('removes ungrounded numbers from every generated field', () => {
    const raw = makeSummary({
      headline: 'Built 999 tools',
      professionalOverview:
        'This overview claims 999 stars and is intentionally long enough to pass the minimum length requirement for usability.',
      expertise: [{ area: 'Built 999 systems', evidence: ['octocat/alpha'] }],
      resumeBullets: [{ text: 'Delivered 999 things.', evidence: [] }],
    });
    const result = validateGitHubSummary(raw, makeDataset());
    expect(result.usable).toBe(false);
    expect(result.summary.headline).toBe('Public GitHub work by @octocat');
    expect(result.summary.professionalOverview).toContain('removed');
    expect(result.summary.expertise).toEqual([]);
    expect(result.summary.resumeBullets).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('allows derived cardinalities such as year span and project count', () => {
    const result = validateGitHubSummary(
      makeSummary({
        professionalOverview:
          'The sampled work spans 12 years, 3 projects, 2 languages, 6 active years, and 1 external repository. This sentence keeps the overview long enough for usability.',
      }),
      makeDataset()
    );
    expect(result.usable).toBe(true);
  });

  it('grounds timeline, spotlight, list, and caveat fields too', () => {
    const result = validateGitHubSummary(
      makeSummary({
        workTimeline: [
          {
            fromYear: 2020,
            toYear: 2020,
            label: '999 systems',
            summary: 'Delivered 999 things.',
            evidence: ['999 repos'],
          },
        ],
        projectSpotlights: [
          {
            repo: 'octocat/alpha',
            whatItIs: '999 tools',
            technicalSignals: ['999 commits'],
            whyItMatters: '999 users',
          },
        ],
        collaborationSignals: ['Reviewed 999 PRs'],
        workStyleObservations: ['Shipped 999 releases'],
        caveats: ['Based on 999 repos'],
      }),
      makeDataset()
    );
    expect(result.summary.workTimeline).toEqual([]);
    expect(result.summary.projectSpotlights).toEqual([]);
    expect(result.summary.collaborationSignals).toEqual([]);
    expect(result.summary.workStyleObservations).toEqual([]);
    expect(result.summary.caveats).toEqual([
      'Based on sampled public GitHub REST data; this is not a complete contribution history.',
    ]);
  });

  it('rejects numbers that appear only inside README text', () => {
    const dataset = makeDataset({
      profileReadme: 'Release v47 is available.',
      repoDetails: {
        ...makeDataset().repoDetails,
        'octocat/alpha': {
          ...makeDataset().repoDetails['octocat/alpha'],
          readmeExcerpt: 'Alpha v47 release notes.',
        },
      },
    });
    const result = validateGitHubSummary(
      makeSummary({
        professionalOverview:
          'This overview mentions release 47 and is intentionally long enough to pass the minimum length requirement for validation.',
      }),
      dataset
    );
    expect(result.usable).toBe(false);
    expect(result.summary.professionalOverview).toContain('removed');
  });

  it('returns a safe unusable fallback for malformed input', () => {
    const result = validateGitHubSummary({}, makeDataset());
    expect(result.usable).toBe(false);
    expect(result.summary.headline.length).toBeLessThanOrEqual(120);
    expect(result.summary.caveats.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    const allowed = buildAllowedNumbers(makeDataset());
    expect(findUngroundedNumbers('999999', allowed)).toEqual(['999999']);
    expect(findUngroundedNumbers('120', allowed)).toEqual([]);
    expect(findUngroundedNumbers('1,000 stars', new Set([1000]))).toEqual([]);
    expect(findUngroundedNumbers('ES6 and Node 20', new Set([20]))).toEqual([]);
  });
});
