import { describe, expect, it } from 'vitest';
import { buildGitHubMarkdown, buildGitHubMarkdownFilename, escapeMarkdownText } from './markdown';
import { makeDataset, makeSummary } from './__tests__/fixtures';

describe('GitHub Markdown export', () => {
  it('renders a full report with AI sections and coverage', () => {
    const markdown = buildGitHubMarkdown(makeDataset(), makeSummary());
    expect(markdown).toContain('# The Octocat — GitHub work summary');
    expect(markdown).toContain('## GitHub stats');
    expect(markdown).toContain('[octocat/alpha](https://github.com/octocat/alpha)');
    expect(markdown).toContain('TypeScript tooling and Go services');
    expect(markdown).toContain('## Resume bullets by project');
    expect(markdown).toContain('### octocat/alpha');
    expect(markdown).toContain('- Built a TypeScript command line tool');
    expect(markdown).toContain('## Open-source resume bullets');
    expect(markdown).toContain('### org/lib');
    expect(markdown).toContain('## Coverage and limitations');
    expect(markdown).toContain('Sampled from public GitHub REST data');
  });

  it('renders a deterministic fallback when the AI summary is unavailable', () => {
    const markdown = buildGitHubMarkdown(makeDataset(), null);
    expect(markdown).toContain('## GitHub stats');
    expect(markdown).toContain('## Project spotlights');
    expect(markdown).not.toContain('## Expertise');
    expect(markdown).not.toContain('## Additional resume bullets');
  });

  it('escapes untrusted text and never emits script or javascript links', () => {
    const summary = makeSummary({
      headline: 'Bad [click](javascript:alert(1)) <script>alert(1)</script>',
      professionalOverview:
        'Overview with [link](javascript:alert(2)) and <img src=x onerror=alert(3)> content.',
    });
    const markdown = buildGitHubMarkdown(makeDataset(), summary);
    expect(markdown).not.toMatch(/(?<!\\)<script/);
    expect(markdown).not.toMatch(/(?<!\\)<img/);
    expect(markdown).not.toContain('](javascript:');
    expect(markdown).toContain('Overview with');
    expect(escapeMarkdownText('a|b\nc')).toBe('a|b c');
  });

  it('escapes untrusted content in every summary section', () => {
    const summary = makeSummary({
      expertise: [{ area: '<script>area</script>', evidence: ['<img src=x>'] }],
      workTimeline: [
        {
          fromYear: 2015,
          toYear: 2020,
          label: '<script>label</script>',
          summary: '<img src=x>',
          evidence: [],
        },
      ],
      projectHighlights: [
        {
          repo: 'octocat/alpha',
          overview: '<script>what</script>',
          bullets: [{ text: '<img>', evidence: [] }],
        },
      ],
      openSourceHighlights: [
        {
          repo: 'org/lib',
          overview: '<script>open source</script>',
          bullets: [{ text: '<iframe>', evidence: [] }],
        },
      ],
      collaborationSignals: ['<script>collab</script>'],
      workStyleObservations: ['<img>'],
      resumeBullets: [{ text: '<script>bullet</script>', evidence: [] }],
      caveats: ['<img>'],
    });
    const markdown = buildGitHubMarkdown(makeDataset(), summary);
    expect(markdown).not.toMatch(/(?<!\\)<script/);
    expect(markdown).not.toMatch(/(?<!\\)<img/);
    expect(markdown).not.toMatch(/(?<!\\)<iframe/);
    expect(markdown).not.toContain('](javascript:');
  });

  it('builds a sanitized filename', () => {
    expect(buildGitHubMarkdownFilename('octo cat/../x', new Date('2026-06-01T00:00:00Z'))).toBe(
      'rolecraft-github-octo-cat-x-20260601.md'
    );
  });
});
