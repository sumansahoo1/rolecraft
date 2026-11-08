import type { FetchedJobDescription, JdLinkErrorInfo, JobFetchStatus } from '@/types';

interface JobFetchState {
  status: JobFetchStatus;
  runId: number;
  attemptedUrl: string | null; // R3-12: the URL this attempt actually used
  data: FetchedJobDescription | null;
  error: JdLinkErrorInfo | null;
}

export type JobFetchAction =
  | { type: 'START'; runId: number; attemptedUrl: string }
  | { type: 'SUCCESS'; runId: number; data: FetchedJobDescription }
  | { type: 'FAILURE'; runId: number; error: JdLinkErrorInfo }
  | { type: 'RESET' };

export const initialJobFetchState: JobFetchState = {
  status: 'idle',
  runId: 0,
  attemptedUrl: null,
  data: null,
  error: null,
};

export function reduceJobFetch(state: JobFetchState, action: JobFetchAction): JobFetchState {
  switch (action.type) {
    case 'START':
      return {
        status: 'fetching',
        runId: action.runId,
        attemptedUrl: action.attemptedUrl,
        data: null,
        error: null,
      };

    case 'SUCCESS':
      if (action.runId !== state.runId || state.status !== 'fetching') return state;
      return { ...state, status: 'success', data: action.data, error: null };

    case 'FAILURE':
      if (action.runId !== state.runId || state.status !== 'fetching') return state;
      return { ...state, status: 'error', data: null, error: action.error };

    case 'RESET':
      return { ...initialJobFetchState, runId: state.runId };

    default:
      return state;
  }
}
