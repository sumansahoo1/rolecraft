import { describe, expect, it } from 'vitest';
import { MAX_URL_LENGTH } from './constants';
import { isStaleFetchedLink, parseJobUrl } from './url';

function expectOk(input: string) {
  const parsed = parseJobUrl(input);
  if (!parsed.ok) throw new Error(`Expected ${input} to parse, got ${parsed.code}`);
  return parsed;
}

function expectCode(input: string, code: 'invalid_url' | 'unsupported_scheme') {
  const parsed = parseJobUrl(input);
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.code).toBe(code);
}

describe('parseJobUrl', () => {
  it('accepts http and https URLs and normalizes them', () => {
    const https = expectOk('https://example.com/jobs/1');
    expect(https.normalized).toBe('https://example.com/jobs/1');
    expect(https.host).toBe('example.com');

    const http = expectOk('http://example.com/jobs/1');
    expect(http.normalized).toBe('http://example.com/jobs/1');
  });

  it('accepts a bare host by prepending https', () => {
    expect(expectOk('jobs.lever.co/acme/123').normalized).toBe('https://jobs.lever.co/acme/123');
  });

  it('treats a bare host with :// in the query as a bare host', () => {
    expect(expectOk('jobs.lever.co/acme/123?x=https://foo').normalized).toBe(
      'https://jobs.lever.co/acme/123?x=https://foo'
    );
  });

  it('classifies host:port before schemes and rejects private hosts', () => {
    expectCode('localhost:3000/job', 'invalid_url');
    expect(expectOk('example.com:8080/job').normalized).toBe('https://example.com:8080/job');
    expectCode('http://intranet/job', 'invalid_url');
  });

  it('accepts markdown links including bare and protocol-relative targets', () => {
    expect(expectOk('[Job](https://example.com/job)').normalized).toBe('https://example.com/job');
    expect(expectOk('[Job](jobs.lever.co/acme/1)').normalized).toBe('https://jobs.lever.co/acme/1');
    expect(expectOk('[Job](//jobs.lever.co/acme/1)').normalized).toBe(
      'https://jobs.lever.co/acme/1'
    );
  });

  it('strips trailing punctuation but keeps balanced parentheses', () => {
    expect(expectOk('https://example.com/job.').normalized).toBe('https://example.com/job');
    expect(expectOk('https://example.com/job,').normalized).toBe('https://example.com/job');
    expect(expectOk('https://example.com/job);').normalized).toBe('https://example.com/job');
    expect(expectOk('"https://example.com/job"').normalized).toBe('https://example.com/job');
    expect(expectOk('<https://example.com/job>').normalized).toBe('https://example.com/job');
    expect(expectOk('https://example.com/job_(remote)').normalized).toBe(
      'https://example.com/job_(remote)'
    );
  });

  it('strips wrapping brackets', () => {
    expect(expectOk('(https://example.com/job)').normalized).toBe('https://example.com/job');
    expect(expectOk('[https://example.com/job]').normalized).toBe('https://example.com/job');
    expect(expectOk('{https://example.com/job}').normalized).toBe('https://example.com/job');
  });

  it('takes the first token when extra prose follows', () => {
    expect(expectOk('https://example.com/job (Remote)').normalized).toBe('https://example.com/job');
  });

  it('rejects empty and over-long inputs', () => {
    expectCode('', 'invalid_url');
    expectCode('   ', 'invalid_url');
    expectCode(`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`, 'invalid_url');
  });

  it('rejects non-http(s) schemes', () => {
    expectCode('javascript:alert(1)', 'unsupported_scheme');
    expectCode('data:text/html,hello', 'unsupported_scheme');
    expectCode('file:///etc/passwd', 'unsupported_scheme');
    expectCode('mailto:', 'unsupported_scheme');
    expectCode('tel:', 'unsupported_scheme');
    expectCode('blob:https://example.com/id', 'unsupported_scheme');
  });

  it('rejects malformed https URLs', () => {
    expectCode('https://', 'invalid_url');
  });

  it('rejects embedded credentials before scheme inference', () => {
    expectCode('user:pass@example.com/job', 'invalid_url');
    expectCode('https://user:pass@example.com/job', 'invalid_url');
    expect(expectOk('https://example.com/job?x=a@b').normalized).toBe(
      'https://example.com/job?x=a@b'
    );
  });

  it('rejects private and local hosts', () => {
    for (const input of [
      'localhost',
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.1',
      '169.254.1.1',
      'https://[::1]/job',
      'foo.local',
      '2130706433',
      '0x7f000001',
      '127.1',
      'intranet',
      'foo.corp',
      'foo.lan',
      'foo.home',
      'foo.intranet',
      'foo.internal',
      'foo.home.arpa',
    ]) {
      expectCode(input, 'invalid_url');
    }
  });

  it('rejects mapped and private IPv6 literals', () => {
    for (const input of [
      'https://[::ffff:127.0.0.1]/job',
      'https://[::ffff:7f00:1]/job',
      'https://[::ffff:a00:1]/job',
      'https://[fc00::1]/job',
      'https://[fe80::1]/job',
      'https://[::]/job',
    ]) {
      expectCode(input, 'invalid_url');
    }
  });

  it('accepts public hosts, public IPv4, and public IPv6', () => {
    expect(expectOk('https://example.com/job').host).toBe('example.com');
    expect(expectOk('https://8.8.8.8/job').host).toBe('8.8.8.8');
    expect(expectOk('https://[2001:4860:4860::8888]/job').normalized).toBe(
      'https://[2001:4860:4860::8888]/job'
    );
  });

  it('preserves query strings and strips fragments', () => {
    const parsed = expectOk('https://boards.greenhouse.io/acme/jobs/123?gh_jid=456#apply');
    expect(parsed.normalized).toBe('https://boards.greenhouse.io/acme/jobs/123?gh_jid=456');
  });

  it('normalizes unicode hosts to punycode', () => {
    expect(expectOk('https://bücher.example/job').host).toBe('xn--bcher-kva.example');
  });
});

describe('isStaleFetchedLink', () => {
  it('returns false when nothing has been fetched', () => {
    expect(isStaleFetchedLink('https://example.com/job', null)).toBe(false);
  });

  it('compares normalized URLs', () => {
    const source = 'https://example.com/job';
    expect(isStaleFetchedLink('https://example.com/job', source)).toBe(false);
    expect(isStaleFetchedLink('example.com/job', source)).toBe(false);
    expect(isStaleFetchedLink('https://example.com/job.', source)).toBe(false);
    expect(isStaleFetchedLink('https://example.com/job#apply', source)).toBe(false);
  });

  it('is stale for a different or unparseable link', () => {
    expect(isStaleFetchedLink('https://example.com/other', 'https://example.com/job')).toBe(true);
    expect(isStaleFetchedLink('not a url', 'https://example.com/job')).toBe(true);
  });
});
