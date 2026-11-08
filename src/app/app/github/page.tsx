'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GitHubWorkPanel } from '@/components/github/GitHubWorkPanel';
import { useGitHubWorkSummary } from '@/hooks/useGitHubWorkSummary';

export default function GitHubPage() {
  const github = useGitHubWorkSummary();

  return (
    <ErrorBoundary>
      <GitHubWorkPanel
        state={{
          status: github.status,
          runId: github.runId,
          dataset: github.dataset,
          summary: github.summary,
          summaryMeta: github.summaryMeta,
          summaryError: github.summaryError,
          summaryWarnings: github.summaryWarnings,
          error: github.error,
          progress: github.progress,
          lastCompleted: github.lastCompleted,
        }}
        run={github.run}
        cancel={github.cancel}
        retrySummary={github.retrySummary}
        addProjectsToResume={github.addProjectsToResume}
        hasResume={github.hasResume}
        hasToken={github.hasToken}
      />
    </ErrorBoundary>
  );
}
