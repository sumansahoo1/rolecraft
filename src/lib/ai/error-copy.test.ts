import { describe, expect, it } from 'vitest';
import { describePipelineError } from './error-copy';

const AUTH_COPY = 'The AI provider rejected the request. Check your API key and model in Settings.';
const RATE_LIMIT_COPY = 'The AI provider is rate-limiting requests. Wait a moment and try again.';
const QUOTA_COPY =
  'The AI provider reports insufficient credits or quota. Check your provider account.';
const NETWORK_COPY = "Couldn't reach the AI provider. Check your connection and try again.";
const GENERIC_COPY = 'Pipeline failed. Check the browser console for details.';

describe('describePipelineError', () => {
  it('maps authentication and authorization failures', () => {
    expect(describePipelineError(new Error('openai error (401): invalid_api_key'))).toBe(AUTH_COPY);
    expect(describePipelineError(new Error('403 Forbidden'))).toBe(AUTH_COPY);
    expect(describePipelineError(new Error('Authentication failed'))).toBe(AUTH_COPY);
  });

  it('maps quota before auth when a 403 carries billing details', () => {
    expect(describePipelineError(new Error('403 Quota exceeded for this project'))).toBe(
      QUOTA_COPY
    );
  });

  it('maps api key not valid wording', () => {
    expect(
      describePipelineError(new Error('400 API key not valid. Please pass a valid API key.'))
    ).toBe(AUTH_COPY);
    expect(describePipelineError(new Error('API_KEY_INVALID'))).toBe(AUTH_COPY);
  });

  it('maps rate limits', () => {
    expect(describePipelineError(new Error('openai error (429): rate limited'))).toBe(
      RATE_LIMIT_COPY
    );
    expect(describePipelineError(new Error('Too many requests'))).toBe(RATE_LIMIT_COPY);
  });

  it('maps quota and billing failures', () => {
    expect(describePipelineError(new Error('openai error (402): payment required'))).toBe(
      QUOTA_COPY
    );
    expect(describePipelineError(new Error('insufficient_quota'))).toBe(QUOTA_COPY);
    expect(describePipelineError(new Error('429 insufficient_quota'))).toBe(QUOTA_COPY);
    expect(describePipelineError(new Error('Insufficient credits'))).toBe(QUOTA_COPY);
    expect(describePipelineError(new Error('Billing issue'))).toBe(QUOTA_COPY);
  });

  it('maps network failures', () => {
    expect(describePipelineError(new TypeError('Failed to fetch'))).toBe(NETWORK_COPY);
    expect(describePipelineError(new TypeError('Load failed'))).toBe(NETWORK_COPY);
    expect(describePipelineError(new Error('Network error'))).toBe(NETWORK_COPY);
  });

  it('falls back to the generic message for unknown errors and non-Error values', () => {
    expect(describePipelineError(new Error('Unexpected parse failure'))).toBe(GENERIC_COPY);
    expect(describePipelineError('Failed to fetch')).toBe(NETWORK_COPY);
    expect(describePipelineError(null)).toBe(GENERIC_COPY);
    expect(describePipelineError({ reason: 'unknown' })).toBe(GENERIC_COPY);
  });
});
