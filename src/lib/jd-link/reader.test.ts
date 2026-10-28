import { describe, expect, it, vi } from 'vitest';
import { MAX_JD_CHARS } from './constants';
import { READER_WARNING_PREFIX, SIGN_IN_WALL_WARNING } from './messages';
import { fetchViaReader } from './reader';

const USABLE_BODY = `About the role
We are hiring a senior engineer for our platform team.

Responsibilities
- Build reliable services.
- Review code from other engineers.

Requirements
- 5+ years of experience building web applications.
- Strong TypeScript and React skills.

Qualifications
- Experience with distributed systems.

Benefits
- Health insurance and a learning budget.`;

const LONG_WEAK_BODY = 'We write about our company and our customers. '.repeat(6);
const SHORT_BODY = 'This page has very little text.';
const WALL_BODY = `Sign in to view this job\n\n${'You need an account to continue. '.repeat(8)}`;

interface ReaderFixtureOptions {
  title?: string | null;
  body?: string;
  warnings?: string[];
}

function readerText({
  title = 'Senior Engineer',
  body = USABLE_BODY,
  warnings = [],
}: ReaderFixtureOptions = {}): string {
  const lines: string[] = [];
  if (title !== null) lines.push(`Title: ${title}`);
  lines.push('URL Source: https://example.com/jobs/1');
  lines.push('Published Time: 2026-10-28T00:00:00Z');
  for (const warning of warnings) lines.push(`Warning: ${warning}`);
  return `${lines.join('\n')}\n\nMarkdown Content:\n${body}`;
}

function readerResponse(
  text: string,
  options: { status?: number; contentType?: string | null } = {}
): Response {
  const response = new Response(text, { status: options.status ?? 200 });
  const contentType = options.contentType === undefined ? 'text/plain' : options.contentType;
  if (contentType === null) response.headers.delete('content-type');
  else response.headers.set('content-type', contentType);
  return response;
}

function fetchReader(text: string, options: { status?: number; contentType?: string | null } = {}) {
  return vi.fn(async () => readerResponse(text, options)) as unknown as typeof fetch;
}

async function fetchVia(fetchImpl: typeof fetch, target = 'https://example.com/jobs/1?x=1#frag') {
  return fetchViaReader(new URL(target), {
    signal: new AbortController().signal,
    fetchImpl,
    timeoutMs: 1000,
    maxChars: MAX_JD_CHARS,
  });
}

describe('fetchViaReader — request', () => {
  it('builds the reader URL, strips the hash, and preserves the query', async () => {
    const fetchImpl = fetchReader(readerText());
    await fetchVia(fetchImpl);

    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
    expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe(
      'https://r.jina.ai/https://example.com/jobs/1?x=1'
    );
    expect(new Headers(vi.mocked(fetchImpl).mock.calls[0][1]?.headers).get('accept')).toBe(
      'text/plain'
    );
  });
});

describe('fetchViaReader — response parsing', () => {
  it('parses metadata, warnings, and only the body after the marker', async () => {
    const text = readerText({
      warnings: ['This is a cached snapshot'],
      body: `${USABLE_BODY}\n\nWarning: inside the body, not metadata`,
    });
    const data = await fetchVia(fetchReader(text));

    expect(data.title).toBe('Senior Engineer');
    expect(data.text).toContain('About the role');
    expect(data.text).toContain('Warning: inside the body, not metadata');
    expect(data.warnings).toEqual([]);
  });

  it('accepts a marker at position zero', async () => {
    const data = await fetchVia(fetchReader(`Markdown Content:\n${USABLE_BODY}`));
    expect(data.title).toBeNull();
    expect(data.text).toContain('About the role');
  });

  it('accepts an indented marker with trailing spaces', async () => {
    const data = await fetchVia(
      fetchReader(`Title: Engineer\n\n  Markdown Content:  \n${USABLE_BODY}`)
    );
    expect(data.title).toBe('Engineer');
    expect(data.text).toContain('About the role');
  });

  it('falls back to metadata lines when the marker is missing', async () => {
    const data = await fetchVia(
      fetchReader(
        `Title: Fallback Role\nURL Source: https://example.com/jobs/1\nWarning: This is a cached snapshot\n\n${USABLE_BODY}`
      )
    );
    expect(data.title).toBe('Fallback Role');
    expect(data.text).toContain('About the role');
    expect(data.text).not.toContain('URL Source');
  });

  it('strips markdown noise', async () => {
    const data = await fetchVia(
      fetchReader(
        readerText({ body: `![logo](https://img)\n\n[Apply now](https://x)\n\n${USABLE_BODY}` })
      )
    );
    expect(data.text).toContain('Apply now');
    expect(data.text).not.toContain('![logo]');
    expect(data.text).not.toContain('](');
  });
});

describe('fetchViaReader — target warnings', () => {
  it.each([
    [404, 'not_found', false],
    [410, 'not_found', false],
    [401, 'blocked', false],
    [403, 'blocked', false],
    [451, 'blocked', false],
    [429, 'blocked', true],
    [408, 'timeout', true],
    [504, 'timeout', true],
    [500, 'reader_failed', false],
  ])('maps a target %i warning to %s', async (status, code, retryable) => {
    const text = readerText({
      body: SHORT_BODY,
      warnings: [`Target URL returned error ${status}: Something went wrong`],
    });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({ code, retryable });
  });

  it('scans past benign warnings to find a target error', async () => {
    const text = readerText({
      body: SHORT_BODY,
      warnings: [
        'This page maybe not yet fully loaded',
        'Target URL returned error 404: Not Found',
        'This is a cached snapshot',
      ],
    });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({ code: 'not_found' });
  });

  it('returns the first target error when several are present', async () => {
    const text = readerText({
      body: SHORT_BODY,
      warnings: [
        'Target URL returned error 403: Forbidden',
        'This is a cached snapshot',
        'Target URL returned error 404: Not Found',
      ],
    });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({ code: 'blocked' });
  });

  it('ignores benign warnings and reports short bodies as empty_content', async () => {
    const text = readerText({
      body: SHORT_BODY,
      warnings: ['This is a cached snapshot', 'This page maybe not yet fully loaded'],
    });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({
      code: 'empty_content',
    });
  });

  it('returns a usable quality-ok body as success with the reader warning', async () => {
    const warning = 'Target URL returned error 404: Not Found';
    const data = await fetchVia(
      fetchReader(readerText({ body: USABLE_BODY, warnings: [warning] }))
    );
    expect(data.quality).toBe('ok');
    expect(data.warnings).toContain(`${READER_WARNING_PREFIX}${warning}`);
  });

  it('returns a usable non-wall body as success for a 403 warning', async () => {
    const warning = 'Target URL returned error 403: Forbidden';
    const data = await fetchVia(
      fetchReader(readerText({ body: USABLE_BODY, warnings: [warning] }))
    );
    expect(data.quality).toBe('ok');
    expect(data.warnings).toContain(`${READER_WARNING_PREFIX}${warning}`);
  });

  it('discards a long low-quality body when a target error is present', async () => {
    const text = readerText({
      title: 'Company',
      body: LONG_WEAK_BODY,
      warnings: ['Target URL returned error 404: Not Found'],
    });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('keeps an auth-wall body even when the target refused it', async () => {
    const warning = 'Target URL returned error 403: Forbidden';
    const data = await fetchVia(fetchReader(readerText({ body: WALL_BODY, warnings: [warning] })));
    expect(data.quality).toBe('low_confidence');
    expect(data.warnings).toContain(SIGN_IN_WALL_WARNING);
    expect(data.warnings).toContain(`${READER_WARNING_PREFIX}${warning}`);
  });
});

describe('fetchViaReader — content type and bodies', () => {
  it('accepts text/plain and text/markdown', async () => {
    await expect(
      fetchVia(fetchReader(readerText(), { contentType: 'text/plain' }))
    ).resolves.toMatchObject({ source: 'reader' });
    await expect(
      fetchVia(fetchReader(readerText(), { contentType: 'text/markdown; charset=utf-8' }))
    ).resolves.toMatchObject({ source: 'reader' });
  });

  it('converts text/html before parsing', async () => {
    const html = `<h1>Engineer</h1><p>${USABLE_BODY.replace(/\n/g, ' ')}</p>`;
    const data = await fetchVia(fetchReader(html, { contentType: 'text/html' }));
    expect(data.text).toContain('Engineer');
    expect(data.text).not.toContain('<h1>');
  });

  it('rejects application/json and missing content types', async () => {
    await expect(
      fetchVia(fetchReader(readerText(), { contentType: 'application/json' }))
    ).rejects.toMatchObject({ code: 'reader_failed' });
    await expect(fetchVia(fetchReader(readerText(), { contentType: null }))).rejects.toMatchObject({
      code: 'reader_failed',
    });
  });

  it('accepts a long low-confidence body with no target error', async () => {
    const data = await fetchVia(
      fetchReader(readerText({ title: 'Company', body: LONG_WEAK_BODY }))
    );
    expect(data.quality).toBe('low_confidence');
    expect(data.text).toContain('We write about our company');
  });

  it('accepts an auth-wall body without a target error as low confidence', async () => {
    const data = await fetchVia(fetchReader(readerText({ body: WALL_BODY })));
    expect(data.quality).toBe('low_confidence');
    expect(data.warnings).toContain(SIGN_IN_WALL_WARNING);
  });

  it('marks a listing title as low confidence', async () => {
    const data = await fetchVia(
      fetchReader(
        readerText({
          title: 'Jobs in United States (11,000+ Open Roles)',
          body: LONG_WEAK_BODY,
        })
      )
    );
    expect(data.quality).toBe('low_confidence');
  });

  it('maps empty bodies to empty_content', async () => {
    const text = readerText({ body: '' });
    await expect(fetchVia(fetchReader(text))).rejects.toMatchObject({
      code: 'empty_content',
    });
  });
});

describe('fetchViaReader — reader HTTP statuses', () => {
  it('maps 429 to retryable reader_failed', async () => {
    await expect(fetchVia(fetchReader('', { status: 429 }))).rejects.toMatchObject({
      code: 'reader_failed',
      retryable: true,
      status: 429,
    });
  });

  it('maps 500 to retryable reader_failed', async () => {
    await expect(fetchVia(fetchReader('', { status: 500 }))).rejects.toMatchObject({
      code: 'reader_failed',
      retryable: true,
      status: 500,
    });
  });

  it('maps 400 to non-retryable reader_failed', async () => {
    await expect(fetchVia(fetchReader('', { status: 400 }))).rejects.toMatchObject({
      code: 'reader_failed',
      retryable: false,
      status: 400,
    });
  });
});
