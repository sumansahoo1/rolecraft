import type {
  FetchedJobDescription,
  FetchJobDescriptionOptions,
  FetchJobDescriptionResult,
} from '@/types';
import { toJdLinkErrorInfo } from './errors';
import type { JobFetchAction } from './state';

export interface JobFetchStartOptions {
  allowReader: boolean;
  attemptedUrl: string;
}

export interface JobFetchController {
  start(input: string, options: JobFetchStartOptions): Promise<FetchedJobDescription | null>;
  cancel(): void;
  dispose(): void;
}

/**
 * Plain, node-testable abortable fetch lifecycle controller. The React hook is
 * only an adapter; runId/AbortController ownership lives here.
 */
export function createJobFetchController(deps: {
  dispatch: (action: JobFetchAction) => void;
  fetchJobDescription: (
    input: string,
    options: FetchJobDescriptionOptions
  ) => Promise<FetchJobDescriptionResult>;
  isMounted: () => boolean;
}): JobFetchController {
  // Per-controller state: two controller instances never share a runId.
  let runId = 0;
  let active: AbortController | null = null;

  async function start(
    input: string,
    { allowReader, attemptedUrl }: JobFetchStartOptions
  ): Promise<FetchedJobDescription | null> {
    if (!deps.isMounted()) return null;
    const id = ++runId;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    deps.dispatch({ type: 'START', runId: id, attemptedUrl });

    try {
      const result = await deps.fetchJobDescription(input, {
        signal: controller.signal,
        allowReader,
      });
      if (!deps.isMounted() || id !== runId || controller.signal.aborted) return null;
      if (result.ok) {
        deps.dispatch({ type: 'SUCCESS', runId: id, data: result.data });
        return result.data;
      }
      if (result.error.code === 'aborted') {
        // R3-26: a current-run aborted result must not strand status:'fetching'.
        deps.dispatch({ type: 'RESET' });
        return null;
      }
      deps.dispatch({ type: 'FAILURE', runId: id, error: result.error });
      return null;
    } catch (err) {
      if (!deps.isMounted() || id !== runId || controller.signal.aborted) return null;
      const error = toJdLinkErrorInfo(err);
      if (error.code === 'aborted') {
        deps.dispatch({ type: 'RESET' });
        return null;
      }
      deps.dispatch({ type: 'FAILURE', runId: id, error });
      return null;
    } finally {
      if (active === controller) active = null;
    }
  }

  function cancel(): void {
    runId += 1;
    active?.abort();
    active = null;
    deps.dispatch({ type: 'RESET' });
  }

  function dispose(): void {
    runId += 1;
    active?.abort();
    active = null;
  }

  return { start, cancel, dispose };
}
