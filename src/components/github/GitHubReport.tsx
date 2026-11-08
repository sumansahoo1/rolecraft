'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Copy,
  Download,
  ExternalLink,
  GitFork,
  GitPullRequest,
  Plus,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  GitHubDataset,
  GitHubProject,
  GitHubRunStatus,
  GitHubSummaryMeta,
  GitHubWorkSummary,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildGitHubMarkdown, buildGitHubMarkdownFilename } from '@/lib/github/markdown';
import { downloadMarkdown } from '@/lib/github/markdown-download';
import type { MergeResult } from '@/lib/github/resume-merge';
import { GitHubSummaryPanel } from './GitHubSummaryPanel';
import { GitHubCoveragePanel } from './GitHubCoveragePanel';

interface Props {
  dataset: GitHubDataset;
  summary: GitHubWorkSummary | null;
  summaryMeta: GitHubSummaryMeta | null;
  summaryError: string | null;
  summaryWarnings: string[];
  status: GitHubRunStatus;
  hasResume: boolean;
  onRetrySummary: () => void;
  onAddProjects: (projects?: GitHubProject[]) => MergeResult;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'GH'
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icon className="size-3.5" />
          {label}
        </div>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function GitHubReport({
  dataset,
  summary,
  summaryMeta,
  summaryError,
  summaryWarnings,
  status,
  hasResume,
  onRetrySummary,
  onAddProjects,
}: Props) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { profile, stats, coverage, timeline, projects, collaboration } = dataset;
  const displayName = profile.name ?? profile.login;
  const markdown = buildGitHubMarkdown(dataset, summary);
  const maxActivity = Math.max(1, ...timeline.map((row) => row.activityValue));
  const projectPreview = projects.slice(0, 4);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Markdown copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const handleDownload = () => {
    downloadMarkdown(markdown, buildGitHubMarkdownFilename(profile.login));
    toast.success('Markdown download started');
  };

  const handleAddProjects = () => {
    const result = onAddProjects(projectPreview);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        'no-resume': 'Add a master resume first.',
        'invalid-extraction': 'The saved master resume is not a valid object.',
        'invalid-projects': 'The saved master resume has an invalid projects field.',
        quota: 'Could not save to browser storage. Free up space and try again.',
      };
      toast.error(messages[result.reason]);
      return;
    }
    if (result.added.length === 0) {
      toast.info('Those projects are already in your master resume.');
    } else {
      toast.success(`Added ${result.added.length} project${result.added.length === 1 ? '' : 's'}.`);
    }
    setAddOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-start">
        <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold">
          {profile.avatarUrl && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-16 object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            initials(displayName)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <a
              href={profile.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground text-sm hover:underline"
            >
              @{profile.login}
              <ExternalLink className="ml-1 inline size-3" />
            </a>
            <Badge variant={coverage.mode === 'token' ? 'default' : 'secondary'}>
              {coverage.mode === 'token' ? 'Token' : 'Anonymous'}
            </Badge>
            <Badge variant="outline">Sampled</Badge>
          </div>

          {profile.bio && <p className="text-muted-foreground mt-2 text-sm">{profile.bio}</p>}

          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {profile.company && <span>{profile.company}</span>}
            {profile.location && <span>{profile.location}</span>}
            {profile.blog && (
              <a
                href={profile.blog}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground hover:underline"
              >
                {profile.blog.replace(/^https?:\/\//, '')}
              </a>
            )}
            {stats.accountCreatedYear && <span>Joined {stats.accountCreatedYear}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-1.5 size-3.5" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 size-3.5" />
            Download
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!hasResume}>
            <Plus className="mr-1.5 size-3.5" />
            Add projects
          </Button>
        </div>
      </section>

      {!hasResume && (
        <p className="text-muted-foreground -mt-3 text-xs">
          Add a{' '}
          <Link href="/app/resume" className="hover:text-foreground underline underline-offset-2">
            master resume
          </Link>{' '}
          to import GitHub projects.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={GitPullRequest}
          label="Public repos"
          value={formatNumber(stats.publicRepos)}
          detail={`${stats.reposAnalyzed} analyzed`}
        />
        <StatCard
          icon={Star}
          label="Stars"
          value={formatNumber(stats.starsAnalyzed)}
          detail="On analyzed originals"
        />
        <StatCard
          icon={GitFork}
          label="Forks"
          value={formatNumber(stats.forksAnalyzed)}
          detail="On analyzed originals"
        />
        <StatCard icon={Users} label="Followers" value={formatNumber(stats.followers)} />
        <StatCard
          icon={Calendar}
          label="Active years"
          value={String(stats.activeYearCount)}
          detail={
            stats.firstActivityYear && stats.lastActivityYear
              ? `${stats.firstActivityYear}–${stats.lastActivityYear}`
              : undefined
          }
        />
        <StatCard
          icon={GitPullRequest}
          label="PRs authored"
          value={stats.pullRequestsTotal != null ? formatNumber(stats.pullRequestsTotal) : '—'}
          detail={`${stats.mergedPullRequestsSampled} merged in sample`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Languages</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topLanguages.length > 0 ? (
              <>
                <p className="text-muted-foreground mb-3 text-xs">
                  {stats.languageSource === 'languages-api'
                    ? 'Based on language byte counts from fetched repositories.'
                    : 'Based on primary-language repo counts.'}
                </p>
                <ul className="flex flex-col gap-2">
                  {stats.topLanguages.slice(0, 8).map((language) => (
                    <li key={language.name}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span>{language.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {language.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.max(1, language.percentage)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Language breakdown unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Sampled activity by year</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length > 0 ? (
              <>
                <p className="text-muted-foreground mb-3 text-xs">
                  Sampled commit + PR + issue signals (lower bound). Missing or zero years may
                  reflect sampling, not inactivity.
                </p>
                <ol className="flex min-h-32 items-end gap-1 overflow-x-auto pb-1">
                  {timeline.map((row) => {
                    const height = Math.max(2, (row.activityValue / maxActivity) * 100);
                    return (
                      <li
                        key={row.year}
                        className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1"
                        title={`${row.year}: ${row.activityValue} sampled signals`}
                      >
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          {row.activityValue}
                        </span>
                        <div
                          className="bg-primary/80 w-full rounded-t-sm"
                          style={{ height: `${height}px` }}
                          aria-hidden="true"
                        />
                        <span className="text-muted-foreground text-[10px]">{row.year}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No dated public activity found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <GitHubSummaryPanel
            dataset={dataset}
            summary={summary}
            summaryMeta={summaryMeta}
            summaryError={summaryError}
            summaryWarnings={summaryWarnings}
            status={status}
            onRetrySummary={onRetrySummary}
          />
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <div className="flex flex-col gap-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Top projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {projects.map((project) => (
                      <div key={project.repo.fullName} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={project.repo.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium hover:underline"
                          >
                            {project.repo.fullName}
                          </a>
                          {project.repo.isArchived && <Badge variant="outline">Archived</Badge>}
                        </div>
                        {project.repo.description && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {project.repo.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {project.repo.topics.slice(0, 5).map((topic) => (
                            <Badge key={topic} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {project.repo.stars} stars · {project.repo.forks} forks ·{' '}
                          {project.commitCountSampled} sampled commits
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No owned original repositories in the sampled data.
                  </p>
                )}
              </CardContent>
            </Card>

            {collaboration.externalRepos.length > 0 && (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>External collaboration</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1 text-sm">
                    {collaboration.externalRepos.slice(0, 10).map((repo) => (
                      <li key={repo.fullName} className="flex justify-between gap-3">
                        <span className="truncate">{repo.fullName}</span>
                        <span className="text-muted-foreground">
                          {repo.pullRequests} PRs · {repo.merged} merged
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <GitHubCoveragePanel dataset={dataset} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add GitHub projects to master resume</DialogTitle>
            <DialogDescription>
              These factual project entries will be appended to the existing master resume. Nothing
              is overwritten, and duplicates are skipped.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {projectPreview.map((project) => (
              <li key={project.repo.fullName}>{project.repo.fullName}</li>
            ))}
          </ul>
          {projectPreview.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No original repositories are available to add.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProjects} disabled={projectPreview.length === 0}>
              Add {projectPreview.length} project{projectPreview.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
