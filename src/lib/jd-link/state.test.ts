import { describe, expect, it } from 'vitest';
import { initialJobFetchState, reduceJobFetch } from './state';

const data = {
  text: 'A job description',
  title: 'Engineer',
  company: 'Acme',
  location: null,
  source: 'greenhouse' as const,
  sourceUrl: 'https://example.com/job',
  fetchedAt: '2026-10-28T00:00:00.000Z',
  truncated: false,
  quality: 'ok' as const,
  warnings: [],
};

const error = {
  code: 'timeout' as const,
  message: 'timed out',
  retryable: true,
};

describe('reduceJobFetch', () => {
  it('starts idle with no attempted URL', () => {
    expect(initialJobFetchState.attemptedUrl).toBeNull();
    expect(initialJobFetchState.status).toBe('idle');
  });

  it('START clears the previous result and records runId and attemptedUrl', () => {
    const started = reduceJobFetch(
      {
        ...initialJobFetchState,
        status: 'success',
        data,
        attemptedUrl: 'https://old.example/job',
      },
      { type: 'START', runId: 4, attemptedUrl: 'https://new.example/job' }
    );
    expect(started).toEqual({
      status: 'fetching',
      runId: 4,
      attemptedUrl: 'https://new.example/job',
      data: null,
      error: null,
    });
  });

  it('SUCCESS for the current run stores data and preserves attemptedUrl', () => {
    const started = reduceJobFetch(initialJobFetchState, {
      type: 'START',
      runId: 1,
      attemptedUrl: 'https://example.com/job',
    });
    const success = reduceJobFetch(started, { type: 'SUCCESS', runId: 1, data });
    expect(success.status).toBe('success');
    expect(success.data).toBe(data);
    expect(success.error).toBeNull();
    expect(success.attemptedUrl).toBe('https://example.com/job');
  });

  it('FAILURE stores the error, clears data, and preserves attemptedUrl', () => {
    const started = reduceJobFetch(initialJobFetchState, {
      type: 'START',
      runId: 1,
      attemptedUrl: 'https://example.com/job',
    });
    const failed = reduceJobFetch(started, { type: 'FAILURE', runId: 1, error });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe(error);
    expect(failed.data).toBeNull();
    expect(failed.attemptedUrl).toBe('https://example.com/job');
  });

  it('ignores stale SUCCESS and FAILURE actions', () => {
    const started = reduceJobFetch(initialJobFetchState, {
      type: 'START',
      runId: 2,
      attemptedUrl: 'https://example.com/job',
    });
    expect(reduceJobFetch(started, { type: 'SUCCESS', runId: 1, data })).toBe(started);
    expect(reduceJobFetch(started, { type: 'FAILURE', runId: 1, error })).toBe(started);
  });

  it('ignores results when not fetching', () => {
    expect(reduceJobFetch(initialJobFetchState, { type: 'SUCCESS', runId: 0, data })).toBe(
      initialJobFetchState
    );
  });

  it('RESET returns idle, clears the result and attemptedUrl, and keeps runId', () => {
    const started = reduceJobFetch(initialJobFetchState, {
      type: 'START',
      runId: 7,
      attemptedUrl: 'https://example.com/job',
    });
    const failed = reduceJobFetch(started, { type: 'FAILURE', runId: 7, error });
    const reset = reduceJobFetch(failed, { type: 'RESET' });
    expect(reset).toEqual({ ...initialJobFetchState, runId: 7 });
    expect(reset.attemptedUrl).toBeNull();
    expect(reset.error).toBeNull();
  });
});
