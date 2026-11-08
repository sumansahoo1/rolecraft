import { describe, expect, it } from 'vitest';
import { MAX_JD_CHARS, MIN_JD_CHARS } from './constants';
import { SIGN_IN_WALL_WARNING, truncationMarker } from './messages';
import {
  buildJobDescription,
  looksLikeAuthWall,
  normalizeJobText,
  stripMarkdownNoise,
} from './text';

const STRONG_BODY = `About the role
We are hiring a senior engineer to join the product team.

Responsibilities
- Build and ship user-facing features.
- Collaborate with design and product.

Requirements
- 5+ years of experience building web applications.
- Strong TypeScript and React skills.

Qualifications
- Experience with testing and performance work.

Benefits
- Health insurance and a learning budget.`;

function build(overrides: Partial<Parameters<typeof buildJobDescription>[0]> = {}) {
  return buildJobDescription({
    title: null,
    company: null,
    location: null,
    body: STRONG_BODY,
    source: 'greenhouse',
    sourceUrl: 'https://example.com/job',
    ...overrides,
  });
}

describe('normalizeJobText', () => {
  it('normalizes line endings, NBSP, zero-width characters, and blank lines', () => {
    expect(normalizeJobText('  a\r\nb\u00a0c\u200b\r\n\r\n\r\n d  ')).toBe('a\nb c\n\nd');
  });

  it('trims each line and collapses internal horizontal whitespace', () => {
    expect(normalizeJobText('  one   two  \n\t three \t four ')).toBe('one two\nthree four');
  });

  it('preserves list markers and paragraph breaks', () => {
    expect(normalizeJobText('- one\n- two\n\nParagraph')).toBe('- one\n- two\n\nParagraph');
  });
});

describe('stripMarkdownNoise', () => {
  it('removes images and unwraps links', () => {
    const result = stripMarkdownNoise('Intro ![alt](https://img) [Apply](https://x) end');
    expect(result).toContain('Intro');
    expect(result).toContain('Apply');
    expect(result).not.toContain('img');
    expect(result).not.toContain('](');
  });
});

describe('looksLikeAuthWall', () => {
  it('detects wall phrases in the first 2000 characters', () => {
    expect(looksLikeAuthWall('Please sign in to view this job.')).toBe(true);
    expect(looksLikeAuthWall('Enable JavaScript and cookies to continue')).toBe(true);
    expect(looksLikeAuthWall('Verify you are human to continue')).toBe(true);
  });

  it('does not match a bare sign-in navigation link', () => {
    expect(looksLikeAuthWall('Home\nAbout us\nCareers\nSign in')).toBe(false);
  });

  it('only inspects the first 2000 characters', () => {
    expect(looksLikeAuthWall(`${'a'.repeat(2001)} sign in to view this job`)).toBe(false);
  });
});

describe('buildJobDescription quality', () => {
  it('marks a real JD with strong signals as ok', () => {
    expect(build().quality).toBe('ok');
  });

  it('marks listing titles as low confidence even with job-ish body text', () => {
    expect(build({ title: 'Jobs in United States (11,000+ Open Roles)' }).quality).toBe(
      'low_confidence'
    );
  });

  it('treats an auth wall as decisive for auto-run', () => {
    const body = `Sign in to view this job\n\nSearch jobs\nHome\nAbout us\nCareers\nPrivacy\nTerms\n\n${STRONG_BODY}`;
    const result = build({ body });
    expect(result.quality).toBe('low_confidence');
    expect(result.warnings).toContain(SIGN_IN_WALL_WARNING);
  });

  it('does not infer quality from a title containing Requirements', () => {
    const body = 'We build software for companies around the world. '.repeat(4);
    expect(build({ title: 'Requirements', body }).quality).toBe('low_confidence');
  });

  it('assesses the body only, never the company header', () => {
    const withCompany = build({ company: 'Sign in to view this job' });
    expect(withCompany.quality).toBe('ok');
    expect(withCompany.text).toContain('Sign in to view this job');

    const short = build({ body: 'Short.', company: 'Requirements Inc' });
    expect(short.quality).toBe('low_confidence');
  });

  it('marks bodies shorter than MIN_JD_CHARS as low confidence', () => {
    const body = 'Short role.';
    expect(body.length).toBeLessThan(MIN_JD_CHARS);
    expect(build({ body }).quality).toBe('low_confidence');
  });
});

describe('buildJobDescription composition', () => {
  it('composes title, company, and location above the body', () => {
    const data = build({
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      body: 'Body text.',
    });
    expect(data.text).toBe('Senior Engineer\nAcme\nRemote\n\nBody text.');
    expect(data.title).toBe('Senior Engineer');
    expect(data.company).toBe('Acme');
    expect(data.location).toBe('Remote');
    expect(data.source).toBe('greenhouse');
    expect(data.sourceUrl).toBe('https://example.com/job');
  });

  it('sets an ISO fetchedAt timestamp', () => {
    const data = build();
    expect(new Date(data.fetchedAt).toISOString()).toBe(data.fetchedAt);
  });

  it('preserves and dedupes warnings', () => {
    const data = build({ warnings: ['one', 'one', '', 'two'] });
    expect(data.warnings).toEqual(['one', 'two']);
  });

  it('adds the sign-in warning only for wall bodies', () => {
    expect(build().warnings).toEqual([]);
    const wall = build({ body: 'Sign in to view this job' });
    expect(wall.warnings).toEqual([SIGN_IN_WALL_WARNING]);
  });
});

describe('buildJobDescription truncation', () => {
  it('leaves text at or below the cap unchanged', () => {
    const data = build({ body: 'Body text.', maxChars: 1000 });
    expect(data.truncated).toBe(false);
    expect(data.text).not.toContain('truncated');
  });

  it('prefers a paragraph boundary and appends the marker', () => {
    const body = `${'a'.repeat(200)}\n\n${'b'.repeat(400)}`;
    const data = build({ body, maxChars: 300 });
    expect(data.truncated).toBe(true);
    expect(data.text.startsWith('a'.repeat(200))).toBe(true);
    expect(data.text).not.toContain('bbbb');
    expect(data.text.endsWith(truncationMarker(300))).toBe(true);
    expect(data.text.length).toBeLessThanOrEqual(300);
    expect(data.warnings).toEqual([]);
  });

  it('hard-cuts when there is no late paragraph boundary', () => {
    const data = build({ body: 'a'.repeat(500), maxChars: 300 });
    expect(data.truncated).toBe(true);
    expect(data.text.endsWith(truncationMarker(300))).toBe(true);
    expect(data.text.length).toBeLessThanOrEqual(300);
  });

  it('uses the default cap and plain digits', () => {
    const data = build({ body: 'word '.repeat(7000) });
    expect(data.truncated).toBe(true);
    expect(data.text.length).toBeLessThanOrEqual(MAX_JD_CHARS);
    expect(data.text).toContain('30000');
    expect(data.text).not.toContain('30,000');
  });
});
