import { describe, expect, it, vi } from 'vitest';
import type { FetchJobDescriptionOptions } from '@/types';
import { MAX_JD_CHARS } from './constants';
import { fetchJobDescription } from './extract';

const GREENHOUSE_URL = 'https://boards.greenhouse.io/acme/jobs/123456';
const LEVER_URL = 'https://jobs.lever.co/acme/abc123';
const SMARTRECRUITERS_URL = 'https://jobs.smartrecruiters.com/Acme/743999999999999-engineer';
const UNKNOWN_URL = 'https://example.com/careers/engineer';

const GH_API = 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123456?questions=false';
const LEVER_API = 'https://api.lever.co/v0/postings/acme/abc123?mode=json';
const SR_API = 'https://api.smartrecruiters.com/v1/companies/Acme/postings/743999999999999';

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function readerText({
  title = 'Senior Engineer',
  body = USABLE_BODY,
  warnings = [],
}: { title?: string | null; body?: string; warnings?: string[] } = {}): string {
  const lines: string[] = [];
  if (title !== null) lines.push(`Title: ${title}`);
  lines.push('URL Source: https://example.com/jobs/1');
  for (const warning of warnings) lines.push(`Warning: ${warning}`);
  return `${lines.join('\n')}\n\nMarkdown Content:\n${body}`;
}

function greenhouseFixture(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Senior Engineer',
    company_name: 'Acme Corp',
    location: { name: 'Remote' },
    content:
      '&lt;p&gt;Build things.&lt;/p&gt;&lt;h2&gt;Responsibilities&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Ship features&lt;/li&gt;&lt;/ul&gt;&lt;h2&gt;Requirements&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Five years of experience&lt;/li&gt;&lt;/ul&gt;',
    ...overrides,
  };
}

function options(
  fetchImpl: typeof fetch,
  overrides: Partial<FetchJobDescriptionOptions> = {}
): FetchJobDescriptionOptions {
  return {
    signal: new AbortController().signal,
    allowReader: true,
    fetchImpl,
    ...overrides,
  };
}

function callsOf(fetchImpl: typeof fetch): string[] {
  return vi.mocked(fetchImpl).mock.calls.map(([url]) => String(url));
}

function router(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) =>
    handler(String(input))
  ) as unknown as typeof fetch;
}

describe('fetchJobDescription — ATS happy paths', () => {
  it('reads a Greenhouse posting with exactly one request', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) return jsonResponse(greenhouseFixture());
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('greenhouse');
    expect(result.data.company).toBe('Acme Corp');
    expect(callsOf(fetchImpl)).toEqual([GH_API]);
  });

  it('reads a Lever posting', async () => {
    const fetchImpl = router((url) => {
      if (url === LEVER_API) {
        return jsonResponse({
          text: 'Staff Engineer',
          descriptionPlain: 'Intro',
          lists: [{ text: 'Requirements', content: '<ul><li>One</li></ul>' }],
          categories: { location: 'Berlin' },
        });
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(LEVER_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('lever');
    expect(callsOf(fetchImpl)).toEqual([LEVER_API]);
  });

  it('reads a SmartRecruiters posting', async () => {
    const fetchImpl = router((url) => {
      if (url === SR_API) {
        return jsonResponse({
          name: 'Product Engineer',
          company: { name: 'HireCo' },
          location: { fullLocation: 'New York, NY' },
          jobAd: {
            sections: {
              jobDescription: { title: 'The Role', text: '<p>Build things</p>' },
            },
          },
        });
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(SMARTRECRUITERS_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('smartrecruiters');
    expect(callsOf(fetchImpl)).toEqual([SR_API]);
  });
});

describe('fetchJobDescription — ATS fall-through', () => {
  const readerUrl = `https://r.jina.ai/${GREENHOUSE_URL}`;

  it('falls through an ATS 404 to the reader', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) return jsonResponse({ message: 'Not Found' }, 404);
      if (url === readerUrl) return textResponse(readerText());
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('reader');
    expect(callsOf(fetchImpl)).toEqual([GH_API, readerUrl]);
  });

  it('reports not_found when the reader also reports 404', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) return jsonResponse({ message: 'Not Found' }, 404);
      if (url === readerUrl) {
        return textResponse(
          readerText({
            body: SHORT_BODY,
            warnings: ['Target URL returned error 404: Not Found'],
          })
        );
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(callsOf(fetchImpl)).toEqual([GH_API, readerUrl]);
  });

  it('reports not_found for an ATS 404 when the reader is disabled', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) return jsonResponse({ message: 'Not Found' }, 404);
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(
      GREENHOUSE_URL,
      options(fetchImpl, { allowReader: false })
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(callsOf(fetchImpl)).toEqual([GH_API]);
  });

  it('reports not_found for an ATS 410 when the reader is disabled', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) return jsonResponse({ message: 'Gone' }, 410);
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(
      GREENHOUSE_URL,
      options(fetchImpl, { allowReader: false })
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(callsOf(fetchImpl)).toEqual([GH_API]);
  });

  it.each([500, 408, 504, 401, 403, 451, 429])(
    'falls through an ATS %i to the reader',
    async (status) => {
      const fetchImpl = router((url) => {
        if (url === GH_API) return jsonResponse({}, status);
        if (url === readerUrl) return textResponse(readerText());
        throw new TypeError(`Unexpected URL ${url}`);
      });

      const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.source).toBe('reader');
      expect(callsOf(fetchImpl)).toEqual([GH_API, readerUrl]);
    }
  );

  it('falls through an ATS network failure to the reader', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) throw new TypeError('Failed to fetch');
      if (url === readerUrl) return textResponse(readerText());
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('reader');
  });

  it('reports reader_disabled after an ATS network failure when the reader is off', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) throw new TypeError('Failed to fetch');
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(
      GREENHOUSE_URL,
      options(fetchImpl, { allowReader: false })
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'reader_disabled' } });
    expect(callsOf(fetchImpl)).toEqual([GH_API]);
  });
});

describe('fetchJobDescription — reader-only paths', () => {
  const readerUrl = `https://r.jina.ai/${UNKNOWN_URL}`;

  it('reads non-ATS links through the reader with one request', async () => {
    const fetchImpl = router((url) => {
      if (url === readerUrl) return textResponse(readerText());
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(UNKNOWN_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe('reader');
    expect(callsOf(fetchImpl)).toEqual([readerUrl]);
  });

  it('makes no requests when the reader is off for an unknown host', async () => {
    const fetchImpl = router(() => {
      throw new TypeError('Should not fetch');
    });

    const result = await fetchJobDescription(
      UNKNOWN_URL,
      options(fetchImpl, { allowReader: false })
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'reader_disabled' } });
    expect(callsOf(fetchImpl)).toEqual([]);
  });

  it('maps a reader target 404 to not_found', async () => {
    const fetchImpl = router((url) => {
      if (url === readerUrl) {
        return textResponse(
          readerText({
            body: SHORT_BODY,
            warnings: ['Target URL returned error 404: Not Found'],
          })
        );
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(UNKNOWN_URL, options(fetchImpl));
    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('never contacts a non-ATS, non-reader host', async () => {
    const seen: string[] = [];
    const fetchImpl = router((url) => {
      seen.push(url);
      if (url === GH_API) return jsonResponse({}, 500);
      return textResponse(readerText());
    });

    await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    await fetchJobDescription(UNKNOWN_URL, options(fetchImpl));

    const allowedHosts = new Set([
      'boards-api.greenhouse.io',
      'api.lever.co',
      'api.eu.lever.co',
      'api.smartrecruiters.com',
      'r.jina.ai',
    ]);
    for (const url of seen) {
      expect(allowedHosts.has(new URL(url).hostname)).toBe(true);
    }
  });
});

describe('fetchJobDescription — validation and abort', () => {
  it('returns an error without fetching for invalid and unsupported URLs', async () => {
    for (const [input, code] of [
      ['not a url', 'invalid_url'],
      ['javascript:alert(1)', 'unsupported_scheme'],
      ['localhost:3000/job', 'invalid_url'],
    ] as const) {
      const fetchImpl = router(() => {
        throw new TypeError('Should not fetch');
      });
      const result = await fetchJobDescription(input, options(fetchImpl));
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(callsOf(fetchImpl)).toEqual([]);
    }
  });

  it('returns aborted without fetching for a pre-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = router(() => {
      throw new TypeError('Should not fetch');
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, {
      signal: controller.signal,
      allowReader: true,
      fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'aborted' } });
    expect(callsOf(fetchImpl)).toEqual([]);
  });

  it('aborts during the ATS request without calling the reader', async () => {
    const controller = new AbortController();
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          started();
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    ) as unknown as typeof fetch;

    const promise = fetchJobDescription(
      GREENHOUSE_URL,
      options(fetchImpl, { signal: controller.signal })
    );
    await startedPromise;
    controller.abort();

    await expect(promise).resolves.toMatchObject({ ok: false, error: { code: 'aborted' } });
    expect(callsOf(fetchImpl)).toHaveLength(1);
  });
});

describe('fetchJobDescription — results', () => {
  it('truncates long reader content and marks it', async () => {
    const readerUrl = `https://r.jina.ai/${UNKNOWN_URL}`;
    const fetchImpl = router((url) => {
      if (url === readerUrl) return textResponse(readerText({ body: 'a'.repeat(31_000) }));
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(UNKNOWN_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.truncated).toBe(true);
    expect(result.data.text.length).toBeLessThanOrEqual(MAX_JD_CHARS);
    expect(result.data.text).toContain('[Job description truncated at 30000 characters.]');
  });

  it('keeps a long low-confidence reader result as a success', async () => {
    const readerUrl = `https://r.jina.ai/${UNKNOWN_URL}`;
    const fetchImpl = router((url) => {
      if (url === readerUrl) {
        return textResponse(readerText({ title: 'Company', body: LONG_WEAK_BODY }));
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(UNKNOWN_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.quality).toBe('low_confidence');
  });

  it('returns a short ATS JD as low-confidence success without the reader', async () => {
    const fetchImpl = router((url) => {
      if (url === GH_API) {
        return jsonResponse({
          title: 'Engineer',
          content: '&lt;p&gt;Short role.&lt;/p&gt;',
        });
      }
      throw new TypeError(`Unexpected URL ${url}`);
    });

    const result = await fetchJobDescription(GREENHOUSE_URL, options(fetchImpl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.quality).toBe('low_confidence');
    expect(callsOf(fetchImpl)).toEqual([GH_API]);
  });
});
