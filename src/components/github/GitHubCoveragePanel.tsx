'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { GitHubDataset } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatReset(value: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
}

export function GitHubCoveragePanel({ dataset }: { dataset: GitHubDataset }) {
  const { coverage, collaboration } = dataset;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={coverage.mode === 'token' ? 'default' : 'secondary'}>
          {coverage.mode === 'token' ? 'Token mode' : 'Anonymous mode'}
        </Badge>
        <Badge variant="outline">Sampled</Badge>
        {coverage.tokenInvalid && <Badge variant="destructive">Token rejected</Badge>}
        {coverage.repositoriesTruncated && <Badge variant="outline">Partial repo list</Badge>}
        {coverage.searchIncomplete && <Badge variant="outline">Search incomplete</Badge>}
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Repositories analyzed</dt>
              <dd>
                {coverage.repositoriesAnalyzed} of {coverage.repositoriesTotal}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Active years sampled</dt>
              <dd>
                {coverage.activeYearsSampled} of {coverage.activeYearsFound}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Project details</dt>
              <dd>
                {coverage.detailRepos} repos, {coverage.readmesFetched} READMEs
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Commit pages</dt>
              <dd>{coverage.commitPagesFetched}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Pull requests</dt>
              <dd>
                {coverage.pullRequestsTotal ?? 'unknown'} total · {coverage.pullRequestsSampled}{' '}
                sampled
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Issues</dt>
              <dd>
                {coverage.issuesTotal ?? 'unknown'} total · {coverage.issuesSampled} sampled
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">GitHub requests</dt>
              <dd>
                {coverage.requests.core} core · {coverage.requests.search} search
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">External repos with PRs</dt>
              <dd>{dataset.stats.externalReposCount ?? collaboration.externalRepos.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Rate limit at start</dt>
              <dd>{coverage.rateLimitStart?.core.remaining ?? 'unknown'} core left</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Rate limit at end</dt>
              <dd>{coverage.rateLimitEnd?.core.remaining ?? 'unknown'} core left</dd>
            </div>
          </dl>
          {coverage.rateLimitStart?.core.resetAt && (
            <p className="text-muted-foreground mt-3 text-xs">
              GitHub quota resets at {formatReset(coverage.rateLimitStart.core.resetAt)}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="size-4" />
          What this report is
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Sampled from public REST data. Yearly counts are lower bounds; a year with no sampled
          evidence is not necessarily inactive. This is not a GitHub contribution graph.
        </p>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
          {coverage.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </div>

      {coverage.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-amber-600" />
            Warnings
          </div>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
            {coverage.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
