'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FolderGit2,
  Loader2,
  Play,
  Search,
  Square,
} from 'lucide-react';
import type { GitHubProgress, GitHubProject, GitHubRunStatus } from '@/types';
import type { GitHubWorkState } from '@/lib/github/state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { parseGitHubUsername } from '@/lib/github/username';
import { GitHubReport } from './GitHubReport';
import type { MergeResult } from '@/lib/github/resume-merge';

interface Props {
  state: GitHubWorkState;
  run: (input: string) => Promise<void>;
  cancel: () => void;
  retrySummary: () => Promise<void>;
  addProjectsToResume: (projects?: GitHubProject[]) => MergeResult;
  hasResume: boolean;
  hasToken: boolean;
}

const STAGES: Array<{ id: GitHubProgress['stage']; label: string; short: string }> = [
  { id: 'profile', label: 'Profile', short: 'Profile' },
  { id: 'repositories', label: 'Repositories', short: 'Repos' },
  { id: 'details', label: 'Project details', short: 'Details' },
  { id: 'activity', label: 'Activity', short: 'Activity' },
  { id: 'aggregate', label: 'Work summary', short: 'Summary' },
];

const EXAMPLES = ['torvalds', 'sindresorhus', 'gaearon'];

function stageIndex(stage: GitHubProgress['stage'] | null): number {
  if (!stage) return -1;
  if (stage === 'preflight') return 0;
  return STAGES.findIndex((item) => item.id === stage);
}

function progressValue(status: GitHubRunStatus, progress: GitHubProgress | null): number {
  if (status === 'complete') return 100;
  if (!progress) return 4;
  const index = Math.max(0, stageIndex(progress.stage));
  const base = (index / STAGES.length) * 100;
  const fraction =
    progress.total && progress.completed != null
      ? Math.min(1, progress.completed / progress.total)
      : 0;
  return Math.min(96, Math.round(base + (100 / STAGES.length) * fraction + 4));
}

function formatReset(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { timeStyle: 'short' });
}

function ErrorCard({
  state,
  onRetry,
  hasToken,
}: {
  state: GitHubWorkState;
  onRetry: () => void;
  hasToken: boolean;
}) {
  if (!state.error) return null;
  const reset = formatReset(state.error.resetAt);
  const isKey = state.error.code === 'AI_KEY_MISSING';
  const isRateLimit =
    state.error.code === 'RATE_LIMITED' || state.error.code === 'SECONDARY_RATE_LIMITED';

  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 rounded-lg border p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">{state.error.message}</p>
          {isRateLimit && reset && (
            <p className="text-muted-foreground mt-1 text-xs">
              GitHub&apos;s quota resets around {reset}.
            </p>
          )}
          {isRateLimit && !hasToken && (
            <p className="text-muted-foreground mt-1 text-xs">
              Anonymous GitHub access allows 60 core requests per hour. A token raises this to
              5,000/hour.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {isKey || (isRateLimit && !hasToken) ? (
              <Button variant="outline" size="sm" render={<Link href="/app/settings" />}>
                Open Settings
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
            {isRateLimit && hasToken && (
              <Button variant="ghost" size="sm" render={<Link href="/app/settings" />}>
                Check token
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressPanel({
  status,
  progress,
}: {
  status: GitHubRunStatus;
  progress: GitHubProgress | null;
}) {
  const activeIndex = stageIndex(progress?.stage ?? null);
  return (
    <div className="rounded-xl border p-4" aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {status === 'summarizing' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {status === 'summarizing'
            ? 'Generating the AI work summary…'
            : (progress?.message ?? 'Collecting public GitHub data…')}
        </div>
        {progress && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {progress.requests.core} core · {progress.requests.search} search requests
            {progress.coreRemaining != null ? ` · ${progress.coreRemaining} core left` : ''}
          </span>
        )}
      </div>
      <Progress value={progressValue(status, progress)} />
      <ol className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {STAGES.map((stage, index) => {
          const done = status === 'complete' || (activeIndex >= 0 && index < activeIndex);
          const active = index === activeIndex && status !== 'complete';
          return (
            <li
              key={stage.id}
              className="text-muted-foreground flex items-center gap-1.5"
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <CheckCircle2 className="size-3.5 text-green-600" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Circle className="size-3.5" />
              )}
              <span className={active ? 'text-foreground' : undefined}>{stage.short}</span>
            </li>
          );
        })}
      </ol>
      {progress?.stage === 'details' && progress.total != null && (
        <p className="text-muted-foreground mt-2 text-xs">
          Project details {progress.completed ?? 0}/{progress.total}
        </p>
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-center gap-4 rounded-xl border p-5">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-5 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}

export function GitHubWorkPanel({
  state,
  run,
  cancel,
  retrySummary,
  addProjectsToResume,
  hasResume,
  hasToken,
}: Props) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const running = state.status === 'running' || state.status === 'summarizing';

  const handleRun = () => {
    const parsed = parseGitHubUsername(input);
    if (!parsed.ok) {
      setInputError(parsed.message);
      return;
    }
    setInputError(null);
    void run(input);
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="size-5" />
              <h1 className="text-xl font-semibold">GitHub Work</h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              Turn a public GitHub profile into a grounded, multi-year work summary.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={hasToken ? 'default' : 'secondary'}>
              {hasToken ? 'GitHub token' : 'Anonymous'}
            </Badge>
            <Badge variant="outline">Client-side</Badge>
            <Button variant="ghost" size="sm" render={<Link href="/app/settings" />}>
              Settings
            </Button>
          </div>
        </header>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="github-profile">GitHub profile</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="github-profile"
                  placeholder="https://github.com/username"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !running) handleRun();
                  }}
                  aria-invalid={Boolean(inputError)}
                  aria-describedby={inputError ? 'github-profile-error' : 'github-profile-hint'}
                  disabled={running}
                  autoComplete="off"
                  spellCheck={false}
                />
                {running ? (
                  <Button variant="destructive" onClick={cancel} className="sm:w-32">
                    <Square className="mr-1.5 size-3.5" />
                    Cancel
                  </Button>
                ) : (
                  <Button onClick={handleRun} className="sm:w-32">
                    <Play className="mr-1.5 size-3.5" />
                    Analyze
                  </Button>
                )}
              </div>
              {inputError && (
                <p id="github-profile-error" className="text-destructive text-xs" role="alert">
                  {inputError}
                </p>
              )}
              <p id="github-profile-hint" className="text-muted-foreground text-xs">
                Accepts a profile URL, @handle, or username. Public data is fetched directly from
                api.github.com in your browser. Only a compact dossier goes to your AI provider.
              </p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                <span>Try:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="hover:bg-muted hover:text-foreground rounded-full border px-2 py-0.5"
                    onClick={() => {
                      setInput(example);
                      setInputError(null);
                    }}
                    disabled={running}
                  >
                    @{example}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {running && <ProgressPanel status={state.status} progress={state.progress} />}

        {state.error && (
          <ErrorCard
            state={state}
            onRetry={() => {
              if (input.trim()) void run(input);
            }}
            hasToken={hasToken}
          />
        )}

        {state.dataset ? (
          <GitHubReport
            dataset={state.dataset}
            summary={state.summary}
            summaryMeta={state.summaryMeta}
            summaryError={state.summaryError}
            summaryWarnings={state.summaryWarnings}
            status={state.status}
            hasResume={hasResume}
            onRetrySummary={() => void retrySummary()}
            onAddProjects={addProjectsToResume}
          />
        ) : running ? (
          <ReportSkeleton />
        ) : (
          !state.error && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
              <FolderGit2 className="text-muted-foreground/40 size-10" />
              <h2 className="mt-3 text-base font-medium">See the work behind the profile</h2>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Analyze public repositories, languages, commits, and pull requests across the
                account&apos;s history. The result is a sampled, evidence-grounded summary — not a
                complete contribution graph.
              </p>
              <ul className="text-muted-foreground mt-4 max-w-md space-y-1 text-left text-xs">
                <li>• Public repositories and language mix</li>
                <li>• Sampled commit, PR, and issue signals by year</li>
                <li>• Grounded project spotlights and resume bullets</li>
              </ul>
            </div>
          )
        )}
      </div>
    </div>
  );
}
