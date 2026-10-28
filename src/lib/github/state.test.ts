import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubDataset } from '@/types';
import {
  initialGitHubWorkState,
  reduceGitHubWork,
  runWithGuard,
  type GitHubWorkState,
} from './state';
import { makeDataset, makeSummary } from './__tests__/fixtures';
import { getProviderApiKey } from '@/lib/storage';
import { GitHubError } from './client';

vi.mock('@/lib/storage', () => ({
  getProviderApiKey: vi.fn(),
}));

function readyState(dataset: GitHubDataset): GitHubWorkState {
  let state = reduceGitHubWork(initialGitHubWorkState, { type: 'RUN_STARTED', runId: 1 });
  state = reduceGitHubWork(state, { type: 'DATASET_READY', runId: 1, dataset });
  state = reduceGitHubWork(state, {
    type: 'SUMMARY_READY',
    runId: 1,
    summary: makeSummary(),
    summaryMeta: { provider: 'deepseek', model: 'deepseek-v4-pro', generatedAt: 'now' },
    summaryWarnings: ['warning'],
  });
  return state;
}

describe('GitHub runner state', () => {
  beforeEach(() => {
    vi.mocked(getProviderApiKey).mockReset();
  });

  it('starts a new run without losing the last completed report snapshot', () => {
    const completed = readyState(makeDataset());
    const next = reduceGitHubWork(completed, { type: 'RUN_STARTED', runId: 2 });
    expect(next.status).toBe('running');
    expect(next.runId).toBe(2);
    expect(next.dataset).toBeNull();
    expect(next.summary).toBeNull();
    expect(next.lastCompleted?.dataset).toBe(completed.dataset);
  });

  it('records dataset and summary into lastCompleted', () => {
    const completed = readyState(makeDataset());
    expect(completed.status).toBe('complete');
    expect(completed.lastCompleted?.summary).not.toBeNull();
    expect(completed.lastCompleted?.summaryWarnings).toEqual(['warning']);
  });

  it('restores the last completed report when a later collection fails', () => {
    const completed = readyState(makeDataset());
    const failed = reduceGitHubWork(completed, {
      type: 'COLLECTION_FATAL',
      runId: 1,
      error: { code: 'RATE_LIMITED', message: 'Slow down' },
    });
    expect(failed.status).toBe('complete');
    expect(failed.dataset).toBe(completed.dataset);
    expect(failed.error?.code).toBe('RATE_LIMITED');
  });

  it('shows an error-only state when the first collection fails', () => {
    const failed = reduceGitHubWork(
      reduceGitHubWork(initialGitHubWorkState, { type: 'RUN_STARTED', runId: 1 }),
      {
        type: 'COLLECTION_FATAL',
        runId: 1,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Missing' },
      }
    );
    expect(failed.status).toBe('error');
    expect(failed.dataset).toBeNull();
    expect(failed.error?.code).toBe('PROFILE_NOT_FOUND');
  });

  it('keeps the dataset when a summary is cancelled and ignores stale run ids', () => {
    let state = reduceGitHubWork(initialGitHubWorkState, { type: 'RUN_STARTED', runId: 1 });
    state = reduceGitHubWork(state, { type: 'DATASET_READY', runId: 1, dataset: makeDataset() });
    state = reduceGitHubWork(state, { type: 'SUMMARY_STARTED', runId: 1 });
    state = reduceGitHubWork(state, { type: 'CANCELLED', runId: 1, phase: 'summary' });
    expect(state.status).toBe('complete');
    expect(state.dataset).not.toBeNull();
    expect(state.summaryError).toBe('Summary generation cancelled.');

    const stale = reduceGitHubWork(state, {
      type: 'PROGRESS',
      runId: 999,
      progress: {
        stage: 'profile',
        message: 'stale',
        requests: { core: 0, search: 0 },
        coreRemaining: 1,
        searchRemaining: 1,
      },
    });
    expect(stale).toBe(state);
  });

  it('allows a summary retry to reuse the active run id', () => {
    const completed = readyState(makeDataset());
    const retrying = reduceGitHubWork(completed, { type: 'SUMMARY_STARTED', runId: 1 });
    expect(retrying.status).toBe('summarizing');
    expect(retrying.dataset).toBe(completed.dataset);
    const ready = reduceGitHubWork(retrying, {
      type: 'SUMMARY_READY',
      runId: 1,
      summary: makeSummary({ headline: 'Retried summary' }),
      summaryMeta: { provider: 'deepseek', model: 'deepseek-v4-pro', generatedAt: 'now' },
      summaryWarnings: [],
    });
    expect(ready.status).toBe('complete');
    expect(ready.summary?.headline).toBe('Retried summary');
  });

  it('ignores stale dataset, summary, fatal, and cancel actions', () => {
    const state = readyState(makeDataset());
    const actions = [
      { type: 'DATASET_READY' as const, runId: 999, dataset: makeDataset() },
      {
        type: 'SUMMARY_READY' as const,
        runId: 999,
        summary: makeSummary(),
        summaryMeta: { provider: 'deepseek', model: 'm', generatedAt: 'now' },
        summaryWarnings: [],
      },
      { type: 'SUMMARY_FAILED' as const, runId: 999, message: 'stale' },
      {
        type: 'COLLECTION_FATAL' as const,
        runId: 999,
        error: { code: 'API_ERROR' as const, message: 'stale' },
      },
      { type: 'CANCELLED' as const, runId: 999, phase: 'collection' as const },
    ];
    for (const action of actions) {
      expect(reduceGitHubWork(state, action)).toBe(state);
    }
  });

  it('restores lastCompleted when a new collection is cancelled', () => {
    const completed = readyState(makeDataset());
    let state = reduceGitHubWork(completed, { type: 'RUN_STARTED', runId: 2 });
    state = reduceGitHubWork(state, {
      type: 'PROGRESS',
      runId: 2,
      progress: {
        stage: 'profile',
        message: 'working',
        requests: { core: 1, search: 0 },
        coreRemaining: 10,
        searchRemaining: 5,
      },
    });
    state = reduceGitHubWork(state, { type: 'CANCELLED', runId: 2, phase: 'collection' });
    expect(state.status).toBe('complete');
    expect(state.dataset).toBe(completed.dataset);
    expect(state.progress).toBeNull();
    expect(state.error).toBeNull();
  });

  it('returns to idle when the first collection is cancelled', () => {
    let state = reduceGitHubWork(initialGitHubWorkState, { type: 'RUN_STARTED', runId: 1 });
    state = reduceGitHubWork(state, { type: 'CANCELLED', runId: 1, phase: 'collection' });
    expect(state.status).toBe('idle');
    expect(state.dataset).toBeNull();
    expect(state.runId).toBe(1);
  });

  it('keeps the dataset when summary generation fails or starts without one', () => {
    let state = reduceGitHubWork(initialGitHubWorkState, { type: 'RUN_STARTED', runId: 1 });
    state = reduceGitHubWork(state, { type: 'DATASET_READY', runId: 1, dataset: makeDataset() });
    const failed = reduceGitHubWork(state, {
      type: 'SUMMARY_FAILED',
      runId: 1,
      message: 'AI failed',
    });
    expect(failed.status).toBe('complete');
    expect(failed.dataset).not.toBeNull();
    expect(failed.summaryError).toBe('AI failed');

    const withoutDataset = reduceGitHubWork(initialGitHubWorkState, {
      type: 'SUMMARY_STARTED',
      runId: 0,
    });
    expect(withoutDataset.status).toBe('idle');
  });
});

describe('runWithGuard', () => {
  beforeEach(() => {
    vi.mocked(getProviderApiKey).mockReset();
  });

  it('stops before collection when the AI key is missing', async () => {
    vi.mocked(getProviderApiKey).mockReturnValue(null);
    const collect = vi.fn();
    const result = await runWithGuard({
      input: 'https://github.com/octocat',
      provider: 'deepseek',
      collect,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'AI_KEY_MISSING' } });
    expect(collect).not.toHaveBeenCalled();
  });

  it('parses the username and calls the collector with a valid key', async () => {
    vi.mocked(getProviderApiKey).mockReturnValue('api-key');
    const dataset = makeDataset();
    const collect = vi.fn(async () => dataset);
    const result = await runWithGuard({
      input: 'https://github.com/OctoCat?tab=repositories',
      provider: 'deepseek',
      collect,
    });
    expect(result).toEqual({ ok: true, data: dataset });
    expect(collect).toHaveBeenCalledWith('octocat');
    expect(getProviderApiKey).toHaveBeenCalledWith('deepseek');
  });

  it('rejects invalid usernames without reading a key or collecting', async () => {
    const collect = vi.fn();
    const result = await runWithGuard({
      input: 'https://github.com/octocat/alpha',
      provider: 'deepseek',
      collect,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_USERNAME' } });
    expect(collect).not.toHaveBeenCalled();
    expect(getProviderApiKey).not.toHaveBeenCalled();
  });

  it('maps GitHub, abort, and generic errors', async () => {
    vi.mocked(getProviderApiKey).mockReturnValue('key');
    const githubResult = await runWithGuard({
      input: 'octocat',
      provider: 'openai',
      collect: async () => {
        throw new GitHubError('RATE_LIMITED', 'slow down', { resetAt: '2026-01-01T00:00:00Z' });
      },
    });
    expect(githubResult).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', resetAt: '2026-01-01T00:00:00Z' },
    });

    const abortResult = await runWithGuard({
      input: 'octocat',
      provider: 'openai',
      collect: async () => {
        throw new DOMException('Aborted', 'AbortError');
      },
    });
    expect(abortResult).toMatchObject({ ok: false, error: { code: 'ABORTED' } });

    const genericResult = await runWithGuard({
      input: 'octocat',
      provider: 'openai',
      collect: async () => {
        throw new Error('boom');
      },
    });
    expect(genericResult).toMatchObject({
      ok: false,
      error: { code: 'API_ERROR', message: 'boom' },
    });
  });
});
