import { describe, expect, it } from 'vitest';
import type { JdLinkErrorCode } from '@/types';
import {
  JdLinkError,
  abortError,
  isAbortError,
  isJdLinkError,
  networkError,
  timeoutError,
  toJdLinkErrorInfo,
  tooLargeError,
} from './errors';
import { messageForCode } from './messages';

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

describe('JdLinkError', () => {
  it('uses the canonical message for every code', () => {
    for (const code of CODES) {
      expect(new JdLinkError(code).message).toBe(messageForCode(code));
    }
  });

  it('applies the documented retryable defaults', () => {
    const retryable = new Set<JdLinkErrorCode>(['timeout', 'network', 'reader_failed']);
    for (const code of CODES) {
      expect(new JdLinkError(code).retryable).toBe(retryable.has(code));
    }
  });

  it('allows callers to override retryable', () => {
    expect(new JdLinkError('bad_response', { status: 500, retryable: true })).toMatchObject({
      code: 'bad_response',
      status: 500,
      retryable: true,
    });
    expect(new JdLinkError('blocked', { status: 429, retryable: true }).retryable).toBe(true);
  });

  it('creates typed helpers with the right codes', () => {
    expect(abortError()).toMatchObject({ code: 'aborted', retryable: false });
    expect(timeoutError()).toMatchObject({ code: 'timeout', retryable: true });
    expect(networkError()).toMatchObject({ code: 'network', retryable: true });
    expect(tooLargeError()).toMatchObject({ code: 'too_large', retryable: false });
    expect(isJdLinkError(timeoutError())).toBe(true);
    expect(isJdLinkError(new Error('nope'))).toBe(false);
  });
});

describe('toJdLinkErrorInfo', () => {
  it('maps a typed error including status and retryable', () => {
    const error = new JdLinkError('blocked', { status: 429, retryable: true });
    expect(toJdLinkErrorInfo(error)).toEqual({
      code: 'blocked',
      message: messageForCode('blocked'),
      status: 429,
      retryable: true,
    });
  });

  it('maps a DOM abort to the canonical aborted info', () => {
    expect(toJdLinkErrorInfo(new DOMException('Aborted', 'AbortError'))).toEqual({
      code: 'aborted',
      message: messageForCode('aborted'),
      retryable: false,
    });
  });

  it('maps unknown errors to canonical network info', () => {
    expect(toJdLinkErrorInfo(new TypeError('Failed to fetch'))).toEqual({
      code: 'network',
      message: messageForCode('network'),
      retryable: true,
    });
  });

  it('never includes the attempted URL, host, or query in messages', () => {
    const input = new URL('https://secret-host.example/path?token=distinctive-query');
    for (const code of CODES) {
      const message = new JdLinkError(code).message;
      expect(message).not.toContain(input.href);
      expect(message).not.toContain(input.host);
      expect(message).not.toContain('secret-host.example');
      expect(message).not.toContain('distinctive-query');
    }
  });

  it('detects abort errors from DOM, plain errors, and typed errors', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
    expect(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isAbortError(abortError())).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
  });
});
