'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GitHubDataset, GitHubProject, GitHubSummaryMeta, GitHubWorkSummary } from '@/types';
import { createChatCompletion, extractJsonFromLLMResponse } from '@/lib/ai';
import {
  getExtractionJson,
  getGitHubToken,
  getModel,
  getProvider,
  getProviderApiKey,
  setExtractionJson,
} from '@/lib/storage';
import { collectGitHubWork, GITHUB_LIMITS } from '@/lib/github/collect';
import { buildSummaryMessages } from '@/lib/github/context';
import { validateGitHubSummary } from '@/lib/github/summary';
import { initialGitHubWorkState, reduceGitHubWork, runWithGuard } from '@/lib/github/state';
import { mergeGitHubProjectsIntoExtraction } from '@/lib/github/resume-merge';
import { isAbortError } from '@/lib/github/client';

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'The AI summary could not be generated.';
}

function isAbort(err: unknown): boolean {
  return isAbortError(err) || (err instanceof Error && err.name === 'AbortError');
}

function datasetHasEvidence(dataset: GitHubDataset): boolean {
  return (
    dataset.repos.length > 0 ||
    dataset.pullRequests.length > 0 ||
    dataset.issues.length > 0 ||
    dataset.searchCommits.length > 0 ||
    dataset.stats.commitsSampled > 0
  );
}

export function useGitHubWorkSummary() {
  const [state, dispatch] = useReducer(reduceGitHubWork, initialGitHubWorkState);
  const [hasResume, setHasResume] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasResume(getExtractionJson() !== null);
    setHasToken(getGitHubToken() !== null);
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const current = useCallback((runId: number) => {
    return mountedRef.current && runIdRef.current === runId;
  }, []);

  const summarize = useCallback(
    async (dataset: GitHubDataset, runId: number, controller: AbortController) => {
      const provider = getProvider();
      const apiKey = getProviderApiKey(provider);
      if (!apiKey) {
        if (current(runId)) {
          dispatch({
            type: 'SUMMARY_FAILED',
            runId,
            message: 'Set your AI provider API key in Settings before generating a summary.',
          });
        }
        return;
      }

      dispatch({ type: 'SUMMARY_STARTED', runId });
      const maxChars =
        dataset.coverage.mode === 'token'
          ? GITHUB_LIMITS.token.contextChars
          : GITHUB_LIMITS.anonymous.contextChars;

      try {
        const result = await createChatCompletion({
          provider,
          model: getModel(),
          apiKey,
          messages: buildSummaryMessages(dataset, maxChars),
          temperature: 0.2,
          maxTokens: 4096,
          signal: controller.signal,
        });
        if (!current(runId) || controller.signal.aborted) return;

        const parsed = extractJsonFromLLMResponse(result.content);
        const validation = validateGitHubSummary(parsed, dataset);
        if (!validation.usable) {
          dispatch({
            type: 'SUMMARY_FAILED',
            runId,
            message:
              'The AI response did not pass validation. The fetched report is still available; you can retry the summary.',
            warnings: validation.warnings,
          });
          return;
        }

        const summaryMeta: GitHubSummaryMeta = {
          provider,
          model: result.model || getModel(),
          generatedAt: new Date().toISOString(),
        };
        dispatch({
          type: 'SUMMARY_READY',
          runId,
          summary: validation.summary as GitHubWorkSummary,
          summaryMeta,
          summaryWarnings: validation.warnings,
        });
      } catch (err) {
        if (controller.signal.aborted || isAbort(err) || !current(runId)) return;
        dispatch({ type: 'SUMMARY_FAILED', runId, message: errorMessage(err) });
      }
    },
    [current]
  );

  const run = useCallback(
    async (input: string) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      dispatch({ type: 'RUN_STARTED', runId });
      const provider = getProvider();

      const result = await runWithGuard({
        input,
        provider,
        collect: (username) =>
          collectGitHubWork({
            username,
            token: getGitHubToken(),
            signal: controller.signal,
            onProgress: (progress) => {
              if (current(runId)) dispatch({ type: 'PROGRESS', runId, progress });
            },
          }),
      });

      if (!current(runId) || controller.signal.aborted) return;
      if (!result.ok) {
        if (result.error.code === 'ABORTED') return;
        dispatch({ type: 'COLLECTION_FATAL', runId, error: result.error });
        return;
      }

      const dataset = result.data;
      dispatch({ type: 'DATASET_READY', runId, dataset });
      setHasToken(getGitHubToken() !== null);

      if (!datasetHasEvidence(dataset)) {
        dispatch({
          type: 'SUMMARY_FAILED',
          runId,
          message: 'Not enough public activity was found to summarize.',
        });
        return;
      }

      await summarize(dataset, runId, controller);
    },
    [current, summarize]
  );

  const cancel = useCallback(() => {
    if (state.status !== 'running' && state.status !== 'summarizing') return;
    controllerRef.current?.abort();
    dispatch({
      type: 'CANCELLED',
      runId: runIdRef.current,
      phase: state.status === 'summarizing' ? 'summary' : 'collection',
    });
  }, [state.status]);

  const retrySummary = useCallback(async () => {
    if (!state.dataset) return;
    if (!datasetHasEvidence(state.dataset)) {
      dispatch({
        type: 'SUMMARY_FAILED',
        runId: runIdRef.current,
        message: 'Not enough public activity was found to summarize.',
      });
      return;
    }
    // Reuse the current run id; the reducer only accepts actions for the active run.
    const runId = runIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    await summarize(state.dataset, runId, controller);
  }, [state.dataset, summarize]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    runIdRef.current += 1;
    dispatch({ type: 'RESET' });
  }, []);

  const addProjectsToResume = useCallback(
    (projects?: GitHubProject[]) => {
      if (!state.dataset) {
        return { ok: false as const, reason: 'no-resume' as const };
      }
      const extraction = getExtractionJson();
      const merged = mergeGitHubProjectsIntoExtraction(
        extraction,
        projects ?? state.dataset.projects
      );
      if (!merged.ok) return merged;
      try {
        setExtractionJson(merged.json);
        setHasResume(true);
        return { ok: true as const, json: merged.json, added: merged.added };
      } catch {
        return { ok: false as const, reason: 'quota' as const };
      }
    },
    [state.dataset]
  );

  return {
    ...state,
    run,
    cancel,
    retrySummary,
    reset,
    addProjectsToResume,
    hasResume,
    hasToken,
  };
}
