import { describe, expect, it, vi } from 'vitest';
import { MAX_JD_CHARS } from './constants';
import { detectAtsJob, fetchAtsJob } from './ats';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function matchFor(url: string) {
  const match = detectAtsJob(new URL(url));
  if (!match) throw new Error(`Expected an ATS match for ${url}`);
  return match;
}

async function fetchAts(url: string, response: Response) {
  const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
  return fetchAtsJob(matchFor(url), {
    sourceUrl: url,
    signal: new AbortController().signal,
    fetchImpl,
    timeoutMs: 1000,
    maxChars: MAX_JD_CHARS,
  });
}

describe('detectAtsJob — Greenhouse', () => {
  const expected = {
    ats: 'greenhouse',
    company: 'acme',
    jobId: '123456',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123456?questions=false',
  };

  it('matches canonical, apply, embed, and gh_jid board URLs', () => {
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme/jobs/123456'))).toEqual(
      expected
    );
    expect(
      detectAtsJob(new URL('https://job-boards.greenhouse.io/acme/jobs/123456/apply'))
    ).toEqual(expected);
    expect(
      detectAtsJob(new URL('https://boards.greenhouse.io/embed/job_app?for=Acme&token=123456'))
    ).toEqual(expected);
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme?gh_jid=123456'))).toEqual(
      expected
    );
  });

  it('normalizes trailing slashes and double slashes', () => {
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme/jobs/123456/'))).toEqual(
      expected
    );
    expect(detectAtsJob(new URL('https://boards.greenhouse.io//acme//jobs//123456//'))).toEqual(
      expected
    );
  });

  it('returns null for unsupported Greenhouse shapes', () => {
    expect(detectAtsJob(new URL('https://example.com/acme?gh_jid=123456'))).toBeNull();
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme'))).toBeNull();
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme/jobs/12'))).toBeNull();
    expect(detectAtsJob(new URL('https://boards.eu.greenhouse.io/acme/jobs/123456'))).toBeNull();
    expect(detectAtsJob(new URL('https://boards.greenhouse.io/acme/jobs/123456/extra'))).toBeNull();
  });
});

describe('detectAtsJob — Lever', () => {
  it('matches canonical and apply URLs on both hosts', () => {
    expect(detectAtsJob(new URL('https://jobs.lever.co/acme/abc123'))).toEqual({
      ats: 'lever',
      company: 'acme',
      jobId: 'abc123',
      apiUrl: 'https://api.lever.co/v0/postings/acme/abc123?mode=json',
    });
    expect(detectAtsJob(new URL('https://jobs.lever.co/acme/abc123/apply'))).toEqual({
      ats: 'lever',
      company: 'acme',
      jobId: 'abc123',
      apiUrl: 'https://api.lever.co/v0/postings/acme/abc123?mode=json',
    });
    expect(detectAtsJob(new URL('https://jobs.eu.lever.co/acme/abc123'))).toEqual({
      ats: 'lever',
      company: 'acme',
      jobId: 'abc123',
      apiUrl: 'https://api.eu.lever.co/v0/postings/acme/abc123?mode=json',
    });
  });

  it('normalizes trailing slashes and double slashes', () => {
    expect(detectAtsJob(new URL('https://jobs.lever.co//acme//abc123//'))).toMatchObject({
      company: 'acme',
      jobId: 'abc123',
    });
  });

  it('returns null for roots and invalid ids', () => {
    expect(detectAtsJob(new URL('https://jobs.lever.co/acme'))).toBeNull();
    expect(detectAtsJob(new URL('https://jobs.lever.co/acme/ab'))).toBeNull();
  });
});

describe('detectAtsJob — SmartRecruiters', () => {
  it('matches slug and no-slug URLs with the exact API URL', () => {
    const expected = {
      ats: 'smartrecruiters',
      company: 'Acme',
      jobId: '743999999999999',
      apiUrl: 'https://api.smartrecruiters.com/v1/companies/Acme/postings/743999999999999',
    };
    expect(
      detectAtsJob(
        new URL('https://jobs.smartrecruiters.com/Acme/743999999999999-software-engineer')
      )
    ).toEqual(expected);
    expect(detectAtsJob(new URL('https://jobs.smartrecruiters.com/Acme/743999999999999'))).toEqual(
      expected
    );
  });

  it('normalizes trailing slashes and double slashes', () => {
    expect(
      detectAtsJob(
        new URL('https://jobs.smartrecruiters.com//Acme//743999999999999-software-engineer//')
      )
    ).toMatchObject({ company: 'Acme', jobId: '743999999999999' });
  });

  it('returns null for roots, invalid ids, and extra segments', () => {
    expect(detectAtsJob(new URL('https://jobs.smartrecruiters.com/Acme'))).toBeNull();
    expect(detectAtsJob(new URL('https://jobs.smartrecruiters.com/Acme/abc'))).toBeNull();
    expect(
      detectAtsJob(new URL('https://jobs.smartrecruiters.com/Acme/743999999999999/extra'))
    ).toBeNull();
  });
});

describe('detectAtsJob — other sites', () => {
  it('returns null for unsupported job boards and company sites', () => {
    for (const url of [
      'https://jobs.ashbyhq.com/acme/1234',
      'https://www.linkedin.com/jobs/view/123456',
      'https://acme.wd5.myworkdayjobs.com/en-US/careers/job/123',
      'https://example.com/careers/engineer',
    ]) {
      expect(detectAtsJob(new URL(url))).toBeNull();
    }
  });
});

describe('fetchAtsJob — parsing', () => {
  it('parses a Greenhouse fixture and ignores the board slug as company', async () => {
    const data = await fetchAts(
      'https://boards.greenhouse.io/acme/jobs/123456',
      jsonResponse({
        title: 'Senior Engineer',
        company_name: 'Acme Corp',
        location: { name: 'Remote' },
        content:
          '&lt;p&gt;Build &lt;strong&gt;things&lt;/strong&gt;.&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;li&gt;Two&lt;/li&gt;&lt;/ul&gt;',
      })
    );

    expect(data.source).toBe('greenhouse');
    expect(data.title).toBe('Senior Engineer');
    expect(data.company).toBe('Acme Corp');
    expect(data.location).toBe('Remote');
    expect(data.text.startsWith('Senior Engineer')).toBe(true);
    expect(data.text).toContain('Build things.');
    expect(data.text).toContain('- One\n- Two');
    expect(data.text).not.toContain('alert');
  });

  it('maps missing Greenhouse fields to empty_content', async () => {
    await expect(
      fetchAts('https://boards.greenhouse.io/acme/jobs/123456', jsonResponse({}))
    ).rejects.toMatchObject({ code: 'empty_content' });
    await expect(
      fetchAts('https://boards.greenhouse.io/acme/jobs/123456', jsonResponse({ title: 'Engineer' }))
    ).rejects.toMatchObject({ code: 'empty_content' });
  });

  it('parses a Lever fixture with lists and additional text', async () => {
    const data = await fetchAts(
      'https://jobs.lever.co/acme/abc123',
      jsonResponse({
        text: 'Staff Engineer',
        descriptionPlain: 'Intro\u00a0text',
        lists: [{ text: 'Requirements', content: '<ul><li>One</li><li>Two</li></ul>' }],
        additionalPlain: 'Extra details',
        categories: { location: 'Berlin' },
      })
    );

    expect(data.source).toBe('lever');
    expect(data.title).toBe('Staff Engineer');
    expect(data.company).toBeNull();
    expect(data.location).toBe('Berlin');
    expect(data.text).toContain('Intro text');
    expect(data.text).toContain('Requirements\n- One\n- Two');
    expect(data.text).toContain('Extra details');
  });

  it('falls back to Lever HTML when descriptionPlain is missing', async () => {
    const data = await fetchAts(
      'https://jobs.lever.co/acme/abc123',
      jsonResponse({
        text: 'Staff Engineer',
        description: '<p>Fallback body</p>',
      })
    );
    expect(data.text).toContain('Fallback body');
  });

  it('maps a missing Lever title to empty_content', async () => {
    await expect(
      fetchAts('https://jobs.lever.co/acme/abc123', jsonResponse({ descriptionPlain: 'No title' }))
    ).rejects.toMatchObject({ code: 'empty_content' });
  });

  it('parses SmartRecruiters sections in fixed order', async () => {
    const data = await fetchAts(
      'https://jobs.smartrecruiters.com/Acme/743999999999999-engineer',
      jsonResponse({
        name: 'Product Engineer',
        company: { name: 'HireCo' },
        location: { fullLocation: 'New York, NY' },
        jobAd: {
          sections: {
            qualifications: { title: 'Your Profile', text: '<ul><li>TypeScript</li></ul>' },
            jobDescription: { title: 'The Role', text: '<p>Build things</p>' },
            additionalInformation: { text: '<p>More details</p>' },
            companyDescription: { title: 'About Us', text: '<p>We hire</p>' },
          },
        },
      })
    );

    expect(data.source).toBe('smartrecruiters');
    expect(data.title).toBe('Product Engineer');
    expect(data.company).toBe('HireCo');
    expect(data.location).toBe('New York, NY');
    expect(data.text).toContain('The Role\nBuild things');
    expect(data.text).toContain('Your Profile\n- TypeScript');
    expect(data.text).toContain('Additional Information\nMore details');
    expect(data.text).toContain('About Us\nWe hire');
    expect(data.text.indexOf('The Role')).toBeLessThan(data.text.indexOf('Your Profile'));
    expect(data.text.indexOf('Your Profile')).toBeLessThan(
      data.text.indexOf('Additional Information')
    );
    expect(data.text.indexOf('Additional Information')).toBeLessThan(data.text.indexOf('About Us'));
  });

  it('avoids duplicating Remote and empty location segments', async () => {
    const data = await fetchAts(
      'https://jobs.smartrecruiters.com/Acme/743999999999999-engineer',
      jsonResponse({
        name: 'Product Engineer',
        remote: true,
        location: { fullLocation: 'Remote, , OTHER' },
        jobAd: { sections: { jobDescription: { text: '<p>Build things</p>' } } },
      })
    );
    expect(data.location).toBe('Remote, OTHER');
  });

  it('prefixes Remote only when the location does not already say it', async () => {
    const data = await fetchAts(
      'https://jobs.smartrecruiters.com/Acme/743999999999999-engineer',
      jsonResponse({
        name: 'Product Engineer',
        remote: true,
        location: { city: 'Austin', region: '', country: 'US' },
        jobAd: { sections: { jobDescription: { text: '<p>Build things</p>' } } },
      })
    );
    expect(data.location).toBe('Remote · Austin, US');
  });

  it('maps missing SmartRecruiters sections to empty_content', async () => {
    await expect(
      fetchAts(
        'https://jobs.smartrecruiters.com/Acme/743999999999999',
        jsonResponse({ name: 'Engineer' })
      )
    ).rejects.toMatchObject({ code: 'empty_content' });
  });

  it('returns a short but valid ATS JD as low-confidence success', async () => {
    const data = await fetchAts(
      'https://boards.greenhouse.io/acme/jobs/123456',
      jsonResponse({
        title: 'Engineer',
        content: '&lt;p&gt;Short role.&lt;/p&gt;',
      })
    );
    expect(data.quality).toBe('low_confidence');
    expect(data.text).toContain('Short role.');
  });

  it('maps a whitespace-only body to empty_content', async () => {
    await expect(
      fetchAts(
        'https://boards.greenhouse.io/acme/jobs/123456',
        jsonResponse({
          title: 'Engineer',
          content: '&lt;p&gt;   &lt;/p&gt;',
        })
      )
    ).rejects.toMatchObject({ code: 'empty_content' });
  });
});

describe('fetchAtsJob — status and transport', () => {
  const url = 'https://boards.greenhouse.io/acme/jobs/123456';

  it('uses the exact API URL and privacy-preserving request options', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ title: 'Engineer', content: '&lt;p&gt;Body&lt;/p&gt;' })
    ) as unknown as typeof fetch;
    await fetchAtsJob(matchFor(url), {
      sourceUrl: url,
      signal: new AbortController().signal,
      fetchImpl,
      timeoutMs: 1000,
      maxChars: MAX_JD_CHARS,
    });

    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
    expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe(
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs/123456?questions=false'
    );
    const init = vi.mocked(fetchImpl).mock.calls[0][1];
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(new Headers(init?.headers).get('accept')).toBe('application/json');
  });

  it('maps 404 and 410 to not_found', async () => {
    await expect(fetchAts(url, new Response('', { status: 404 }))).rejects.toMatchObject({
      code: 'not_found',
      retryable: false,
    });
    await expect(fetchAts(url, new Response('', { status: 410 }))).rejects.toMatchObject({
      code: 'not_found',
      retryable: false,
    });
  });

  it('maps 401, 403, and 451 to blocked', async () => {
    for (const status of [401, 403, 451]) {
      await expect(fetchAts(url, new Response('', { status }))).rejects.toMatchObject({
        code: 'blocked',
        retryable: false,
        status,
      });
    }
  });

  it('maps 429 to a retryable blocked error', async () => {
    await expect(fetchAts(url, new Response('', { status: 429 }))).rejects.toMatchObject({
      code: 'blocked',
      retryable: true,
      status: 429,
    });
  });

  it('maps 408 and 504 to a retryable timeout', async () => {
    for (const status of [408, 504]) {
      await expect(fetchAts(url, new Response('', { status }))).rejects.toMatchObject({
        code: 'timeout',
        retryable: true,
        status,
      });
    }
  });

  it('maps other 5xx responses to a retryable bad_response', async () => {
    await expect(fetchAts(url, new Response('', { status: 500 }))).rejects.toMatchObject({
      code: 'bad_response',
      retryable: true,
      status: 500,
    });
    await expect(fetchAts(url, new Response('', { status: 400 }))).rejects.toMatchObject({
      code: 'bad_response',
      retryable: false,
    });
  });

  it('maps non-JSON content types and parse failures to bad_response', async () => {
    await expect(
      fetchAts(
        url,
        new Response('<html>challenge</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    ).rejects.toMatchObject({ code: 'bad_response' });

    await expect(
      fetchAts(
        url,
        new Response('not json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    ).rejects.toMatchObject({ code: 'bad_response' });
  });
});
