import type { JdLinkErrorCode, JdLinkErrorInfo } from '@/types';
import { messageForCode } from './messages';

const RETRYABLE: Record<JdLinkErrorCode, boolean> = {
  invalid_url: false,
  unsupported_scheme: false,
  blocked: false,
  not_found: false,
  empty_content: false,
  too_large: false,
  timeout: true,
  aborted: false,
  network: true,
  reader_disabled: false,
  reader_failed: true,
  bad_response: false,
};

export class JdLinkError extends Error {
  readonly code: JdLinkErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(code: JdLinkErrorCode, options: { status?: number; retryable?: boolean } = {}) {
    super(messageForCode(code));
    this.name = 'JdLinkError';
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? RETRYABLE[code];
  }
}

export function isJdLinkError(value: unknown): value is JdLinkError {
  return value instanceof JdLinkError;
}

export function isAbortError(value: unknown): boolean {
  return (
    (value instanceof DOMException && value.name === 'AbortError') ||
    (value instanceof Error && value.name === 'AbortError') ||
    (value instanceof JdLinkError && value.code === 'aborted')
  );
}

export function toJdLinkErrorInfo(error: unknown): JdLinkErrorInfo {
  if (isJdLinkError(error)) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      retryable: error.retryable,
    };
  }
  if (isAbortError(error)) {
    return { code: 'aborted', message: messageForCode('aborted'), retryable: false };
  }
  return { code: 'network', message: messageForCode('network'), retryable: true };
}

export function abortError(): JdLinkError {
  return new JdLinkError('aborted');
}

export function timeoutError(): JdLinkError {
  return new JdLinkError('timeout');
}

export function networkError(): JdLinkError {
  return new JdLinkError('network');
}

export function tooLargeError(): JdLinkError {
  return new JdLinkError('too_large');
}
