import { describe, expect, it } from 'vitest';
import type { JdLinkErrorCode } from '@/types';
import {
  READER_WARNING_PREFIX,
  SIGN_IN_WALL_WARNING,
  SOURCE_LABELS,
  UI_COPY,
  messageForCode,
  truncationMarker,
  truncatedNote,
} from './messages';

const CODES: JdLinkErrorCode[] = [
  'invalid_url',
  'unsupported_scheme',
  'blocked',
  'not_found',
  'empty_content',
  'too_large',
  'timeout',
  'aborted',
  'network',
  'reader_disabled',
  'reader_failed',
  'bad_response',
];

describe('canonical messages', () => {
  it('returns a non-empty canonical string for every code', () => {
    for (const code of CODES) {
      const message = messageForCode(code);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('keeps all canonical error strings unique and provider-neutral', () => {
    const messages = CODES.map((code) => messageForCode(code));
    expect(new Set(messages).size).toBe(CODES.length);
    for (const message of messages) {
      expect(message).not.toMatch(/deepseek/i);
    }
  });

  it('never forks copy by context', () => {
    for (const code of CODES) {
      expect(messageForCode(code, { status: 429 })).toBe(messageForCode(code));
    }
  });

  it('asserts the exact canonical error strings', () => {
    expect(messageForCode('invalid_url')).toBe(
      "That doesn't look like a valid job link. Paste the full URL, including https://."
    );
    expect(messageForCode('unsupported_scheme')).toBe('Only http and https links are supported.');
    expect(messageForCode('blocked')).toBe(
      'The site refused the request (sign-in, bot protection, or rate limit). Open the link and paste the description manually.'
    );
    expect(messageForCode('not_found')).toBe(
      'This job posting could not be found. It may have been removed or expired.'
    );
    expect(messageForCode('empty_content')).toBe(
      'No job description text was found on that page. It may require JavaScript or sign-in.'
    );
    expect(messageForCode('too_large')).toBe(
      'That page is too large to process. Paste the relevant job description manually.'
    );
    expect(messageForCode('timeout')).toBe(
      'Fetching the job description timed out. Try again or paste it manually.'
    );
    expect(messageForCode('aborted')).toBe('Cancelled.');
    expect(messageForCode('network')).toBe(
      "Couldn't reach the site. Check your connection and try again."
    );
    expect(messageForCode('reader_disabled')).toBe(
      "This link couldn't be read from a supported job board, and the reader fallback is off. Turn it on to try r.jina.ai, or paste the description manually."
    );
    expect(messageForCode('reader_failed')).toBe(
      "The reader couldn't extract this page. It may be rate-limiting or unable to read the site. Try again, or paste the description manually."
    );
    expect(messageForCode('bad_response')).toBe(
      'The job board returned an unexpected response. Try again, or paste the description manually.'
    );
  });
});

describe('UI copy', () => {
  it('keeps the missing-key copy provider-neutral', () => {
    expect(UI_COPY.missingApiKey).toBe('Set your API key in Settings first');
    expect(UI_COPY.missingApiKey).not.toMatch(/deepseek/i);
  });

  it('uses the canonical over-limit message with plain digits', () => {
    expect(UI_COPY.jdTooLong).toBe(
      'Job description is too long (30000-character limit). Trim it before generating.'
    );
    expect(UI_COPY.jdTooLong).toContain('30000');
    expect(UI_COPY.jdTooLong).not.toContain('30,000');
  });

  it('describes the new-tab behaviour for blocked starts', () => {
    expect(UI_COPY.opensInNewTab.length).toBeGreaterThan(0);
    expect(UI_COPY.opensInNewTab).toMatch(/new tab/i);
  });

  it('formats truncation markers with plain locale-independent digits', () => {
    expect(truncationMarker(30_000)).toContain('30000');
    expect(truncationMarker(30_000)).not.toContain('30,000');
    expect(truncatedNote(30_000)).toContain('30000');
    expect(truncatedNote(30_000)).not.toContain('30,000');
  });

  it('maps every source to its exact badge label', () => {
    expect(SOURCE_LABELS).toEqual({
      greenhouse: 'Greenhouse',
      lever: 'Lever',
      smartrecruiters: 'SmartRecruiters',
      reader: 'r.jina.ai reader',
    });
  });

  it('exposes the reader warning prefix and sign-in warning', () => {
    expect(READER_WARNING_PREFIX).toBe('Reader reported: ');
    expect(SIGN_IN_WALL_WARNING.length).toBeGreaterThan(0);
  });
});
