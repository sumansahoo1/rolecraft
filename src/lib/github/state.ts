import type {
  GitHubDataset,
  GitHubErrorCode,
  GitHubProgress,
  GitHubRunStatus,
  GitHubSummaryMeta,
  GitHubWorkSummary,
  Provider,
} from '@/types';
import { getProviderApiKey } from '@/lib/storage';
import { GitHubError, isAbortError } from './client';
import { parseGitHubUsername } from './username';

interface GitHubLastCompleted {
  dataset: GitHubDataset;
  summary: GitHubWorkSummary | null;
  summaryMeta: GitHubSummaryMeta | null;
  summaryWarnings: string[];
}

export interface GitHubWorkState {
  status: GitHubRunStatus;
  runId: number;
  dataset: GitHubDataset | null;
  summary: GitHubWorkSummary | null;
  summaryMeta: GitHubSummaryMeta | null;
  summaryError: string | null;
  summaryWarnings: string[];
  error: { code: GitHubErrorCode; message: string; resetAt?: string } | null;
  progress: GitHubProgress | null;
  lastCompleted: GitHubLastCompleted | null;
}

export type GitHubWorkAction =
  | { type: 'RUN_STARTED'; runId: number }
  | { type: 'PROGRESS'; runId: number; progress: GitHubProgress }
  | { type: 'DATASET_READY'; runId: number; dataset: GitHubDataset }
  | { type: 'SUMMARY_STARTED'; runId: number }
  | {
      type: 'SUMMARY_READY';
      runId: number;
      summary: GitHubWorkSummary;
      summaryMeta: GitHubSummaryMeta;
      summaryWarnings: string[];
    }
  | { type: 'SUMMARY_FAILED'; runId: number; message: string; warnings?: string[] }
  | { type: 'COLLECTION_FATAL'; runId: number; error: GitHubWorkState['error'] }
  | { type: 'CANCELLED'; runId: number; phase: 'collection' | 'summary' }
  | { type: 'RESET' };

export const initialGitHubWorkState: GitHubWorkState = {
  status: 'idle',
  runId: 0,
  dataset: null,
  summary: null,
  summaryMeta: null,
  summaryError: null,
  summaryWarnings: [],
  error: null,
  progress: null,
  lastCompleted: null,
};

function isCurrent(state: GitHubWorkState, runId: number): boolean {
  return state.runId === runId;
}

function restoreLastCompleted(state: GitHubWorkState): GitHubWorkState {
  if (!state.lastCompleted) {
    return {
      ...initialGitHubWorkState,
      runId: state.runId,
    };
  }
  return {
    ...state,
    status: 'complete',
    dataset: state.lastCompleted.dataset,
    summary: state.lastCompleted.summary,
    summaryMeta: state.lastCompleted.summaryMeta,
    summaryWarnings: state.lastCompleted.summaryWarnings,
    summaryError: null,
    progress: null,
  };
}

export function reduceGitHubWork(
  state: GitHubWorkState,
  action: GitHubWorkAction
): GitHubWorkState {
  switch (action.type) {
    case 'RUN_STARTED':
      return {
        ...state,
        status: 'running',
        runId: action.runId,
        dataset: null,
        summary: null,
        summaryMeta: null,
        summaryError: null,
        summaryWarnings: [],
        error: null,
        progress: null,
      };

    case 'PROGRESS':
      if (!isCurrent(state, action.runId) || state.status !== 'running') return state;
      return { ...state, progress: action.progress };

    case 'DATASET_READY':
      if (!isCurrent(state, action.runId)) return state;
      return {
        ...state,
        status: 'complete',
        dataset: action.dataset,
        summary: null,
        summaryMeta: null,
        summaryError: null,
        summaryWarnings: [],
        error: null,
        progress: null,
        lastCompleted: {
          dataset: action.dataset,
          summary: null,
          summaryMeta: null,
          summaryWarnings: [],
        },
      };

    case 'SUMMARY_STARTED':
      if (!isCurrent(state, action.runId) || !state.dataset) return state;
      return {
        ...state,
        status: 'summarizing',
        summaryError: null,
        summaryWarnings: [],
        error: null,
      };

    case 'SUMMARY_READY':
      if (!isCurrent(state, action.runId) || !state.dataset) return state;
      return {
        ...state,
        status: 'complete',
        summary: action.summary,
        summaryMeta: action.summaryMeta,
        summaryError: null,
        summaryWarnings: action.summaryWarnings,
        lastCompleted: {
          dataset: state.dataset,
          summary: action.summary,
          summaryMeta: action.summaryMeta,
          summaryWarnings: action.summaryWarnings,
        },
      };

    case 'SUMMARY_FAILED':
      if (!isCurrent(state, action.runId) || !state.dataset) return state;
      return {
        ...state,
        status: 'complete',
        summaryError: action.message,
        summaryWarnings: action.warnings ?? state.summaryWarnings,
      };

    case 'COLLECTION_FATAL':
      if (!isCurrent(state, action.runId)) return state;
      if (state.lastCompleted) {
        return {
          ...restoreLastCompleted(state),
          error: action.error,
        };
      }
      return {
        ...state,
        status: 'error',
        dataset: null,
        summary: null,
        summaryMeta: null,
        summaryWarnings: [],
        error: action.error,
        progress: null,
      };

    case 'CANCELLED':
      if (!isCurrent(state, action.runId)) return state;
      if (action.phase === 'summary') {
        return {
          ...state,
          status: 'complete',
          summaryError: 'Summary generation cancelled.',
          progress: null,
        };
      }
      return restoreLastCompleted(state);

    case 'RESET':
      return initialGitHubWorkState;

    default:
      return state;
  }
}

export async function runWithGuard<T>(args: {
  input: string;
  provider: Provider;
  collect: (username: string) => Promise<T>;
}): Promise<
  | { ok: true; data: T }
  | { ok: false; error: { code: GitHubErrorCode; message: string; resetAt?: string } }
> {
  const parsed = parseGitHubUsername(args.input);
  if (!parsed.ok) {
    return { ok: false, error: { code: 'INVALID_USERNAME', message: parsed.message } };
  }

  const apiKey = getProviderApiKey(args.provider);
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'AI_KEY_MISSING',
        message: 'Set your AI provider API key in Settings before analyzing a profile.',
      },
    };
  }

  try {
    const data = await args.collect(parsed.username);
    return { ok: true, data };
  } catch (err) {
    if (isAbortError(err)) {
      return { ok: false, error: { code: 'ABORTED', message: 'Analysis cancelled.' } };
    }
    if (err instanceof GitHubError) {
      return {
        ok: false,
        error: { code: err.code, message: err.message, resetAt: err.resetAt },
      };
    }
    return {
      ok: false,
      error: {
        code: 'API_ERROR',
        message: err instanceof Error ? err.message : 'GitHub analysis failed.',
      },
    };
  }
}
