import { describe, expect, it, vi } from 'vitest';
import type {
  FetchedJobDescription,
  FetchJobDescriptionOptions,
  FetchJobDescriptionResult,
} from '@/types';
import { createJobFetchController } from './controller';
import type { JobFetchAction } from './state';
import { initialJobFetchState, reduceJobFetch } from './state';

const DATA: FetchedJobDescription = {
  text: 'A job description',
  title: 'Engineer',
  company: 'Acme',
  location: null,
  source: 'greenhouse',
  sourceUrl: 'https://example.com/job',
  fetchedAt: '2026-10-28T00:00:00.000Z',
  truncated: false,
  quality: 'ok',
  warnings: [],
};

const DATA_B: FetchedJobDescription = { ...DATA, text: 'Second job', sourceUrl: 'https://b' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Pending {
  input: string;
  options: FetchJobDescriptionOptions;
  deferred: ReturnType<typeof deferred<FetchJobDescriptionResult>>;
}

function setup() {
  let mounted = true;
  const actions: JobFetchAction[] = [];
  const pending: Pending[] = [];
  const fetchJobDescription = vi.fn((input: string, options: FetchJobDescriptionOptions) => {
    const d = deferred<FetchJobDescriptionResult>();
    pending.push({ input, options, deferred: d });
    return d.promise;
  });
  const controller = createJobFetchController({
    dispatch: (action) => actions.push(action),
    fetchJobDescription,
    isMounted: () => mounted,
  });
  return {
    actions,
    pending,
    controller,
    fetchJobDescription,
    setMounted: (value: boolean) => {
      mounted = value;
    },
  };
}

function statusOf(actions: JobFetchAction[]) {
  return actions.reduce(reduceJobFetch, initialJobFetchState).status;
}

describe('createJobFetchController', () => {
  it('dispatches START then SUCCESS for the current run and returns the data', async () => {
    const { controller, actions, pending } = setup();
    const promise = controller.start('https://example.com/job', {
      allowReader: true,
      attemptedUrl: 'https://example.com/job',
    });

    expect(actions).toEqual([{ type: 'START', runId: 1, attemptedUrl: 'https://example.com/job' }]);

    pending[0].deferred.resolve({ ok: true, data: DATA });
    await expect(promise).resolves.toBe(DATA);
    expect(actions).toEqual([
      { type: 'START', runId: 1, attemptedUrl: 'https://example.com/job' },
      { type: 'SUCCESS', runId: 1, data: DATA },
    ]);
  });

  it('aborts the previous request and ignores its late result', async () => {
    const { controller, actions, pending } = setup();
    const first = controller.start('a', { allowReader: true, attemptedUrl: 'a' });
    const firstSignal = pending[0].options.signal;
    const second = controller.start('b', { allowReader: false, attemptedUrl: 'b' });

    expect(firstSignal.aborted).toBe(true);
    expect(actions).toEqual([
      { type: 'START', runId: 1, attemptedUrl: 'a' },
      { type: 'START', runId: 2, attemptedUrl: 'b' },
    ]);

    pending[0].deferred.resolve({ ok: true, data: DATA });
    await expect(first).resolves.toBeNull();
    expect(actions).toHaveLength(2);

    pending[1].deferred.resolve({ ok: true, data: DATA_B });
    await expect(second).resolves.toBe(DATA_B);
    expect(actions.at(-1)).toEqual({ type: 'SUCCESS', runId: 2, data: DATA_B });
  });

  it('cancel resets state and suppresses the in-flight result', async () => {
    const { controller, actions, pending } = setup();
    const promise = controller.start('input', { allowReader: true, attemptedUrl: 'u' });

    controller.cancel();
    expect(actions).toEqual([{ type: 'START', runId: 1, attemptedUrl: 'u' }, { type: 'RESET' }]);
    expect(statusOf(actions)).toBe('idle');

    pending[0].deferred.resolve({ ok: true, data: DATA });
    await expect(promise).resolves.toBeNull();
    expect(actions).toHaveLength(2);
  });

  it('dispose aborts and suppresses later dispatches', async () => {
    const { controller, actions, pending, setMounted } = setup();
    const promise = controller.start('input', { allowReader: true, attemptedUrl: 'u' });
    const signal = pending[0].options.signal;

    setMounted(false);
    controller.dispose();
    expect(signal.aborted).toBe(true);

    pending[0].deferred.resolve({ ok: true, data: DATA });
    await expect(promise).resolves.toBeNull();
    expect(actions).toEqual([{ type: 'START', runId: 1, attemptedUrl: 'u' }]);
  });

  it('start after dispose returns null without dispatching', async () => {
    const { controller, actions, setMounted } = setup();
    setMounted(false);
    await expect(
      controller.start('input', { allowReader: true, attemptedUrl: 'u' })
    ).resolves.toBeNull();
    expect(actions).toEqual([]);
  });

  it('resets a current run that reports aborted instead of stranding fetching', async () => {
    const { controller, actions, pending } = setup();
    const promise = controller.start('input', { allowReader: true, attemptedUrl: 'u' });

    pending[0].deferred.resolve({
      ok: false,
      error: { code: 'aborted', message: 'Cancelled.', retryable: false },
    });
    await expect(promise).resolves.toBeNull();

    expect(actions).toEqual([{ type: 'START', runId: 1, attemptedUrl: 'u' }, { type: 'RESET' }]);
    expect(statusOf(actions)).toBe('idle');
    expect(actions.some((action) => action.type === 'FAILURE')).toBe(false);
  });

  it('resets a current run that throws an abort', async () => {
    const { controller, actions, pending } = setup();
    const promise = controller.start('input', { allowReader: true, attemptedUrl: 'u' });

    pending[0].deferred.reject(new DOMException('Aborted', 'AbortError'));
    await expect(promise).resolves.toBeNull();

    expect(actions).toEqual([{ type: 'START', runId: 1, attemptedUrl: 'u' }, { type: 'RESET' }]);
    expect(statusOf(actions)).toBe('idle');
  });

  it('maps unknown thrown errors to a network FAILURE', async () => {
    const { controller, actions, pending } = setup();
    const promise = controller.start('input', { allowReader: true, attemptedUrl: 'u' });

    pending[0].deferred.reject(new TypeError('Failed to fetch'));
    await expect(promise).resolves.toBeNull();

    expect(actions).toHaveLength(2);
    expect(actions[1]).toMatchObject({
      type: 'FAILURE',
      runId: 1,
      error: { code: 'network', retryable: true },
    });
    expect(statusOf(actions)).toBe('error');
  });

  it('passes the signal and allowReader through to the fetcher', async () => {
    const { controller, pending, fetchJobDescription } = setup();
    const promise = controller.start('input', { allowReader: false, attemptedUrl: 'u' });

    expect(fetchJobDescription).toHaveBeenCalledTimes(1);
    expect(fetchJobDescription).toHaveBeenCalledWith('input', {
      signal: pending[0].options.signal,
      allowReader: false,
    });
    expect(pending[0].options.signal).toBeInstanceOf(AbortSignal);

    pending[0].deferred.resolve({ ok: true, data: DATA });
    await promise;
  });

  it('aborts the signal on cancel and dispose', async () => {
    const first = setup();
    first.controller.start('input', { allowReader: true, attemptedUrl: 'u' });
    first.controller.cancel();
    expect(first.pending[0].options.signal.aborted).toBe(true);

    const second = setup();
    second.controller.start('input', { allowReader: true, attemptedUrl: 'u' });
    second.controller.dispose();
    expect(second.pending[0].options.signal.aborted).toBe(true);
  });
});
