'use client';

import { Copy, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { GitHubDataset, GitHubRunStatus, GitHubSummaryMeta, GitHubWorkSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  dataset: GitHubDataset;
  summary: GitHubWorkSummary | null;
  summaryMeta: GitHubSummaryMeta | null;
  summaryError: string | null;
  summaryWarnings: string[];
  status: GitHubRunStatus;
  onRetrySummary: () => void;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  } catch {
    toast.error('Could not copy to the clipboard');
  }
}

export function GitHubSummaryPanel({
  dataset,
  summary,
  summaryMeta,
  summaryError,
  summaryWarnings,
  status,
  onRetrySummary,
}: Props) {
  if (status === 'summarizing') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Sparkles className="size-4 animate-pulse" />
          Generating a grounded summary from the fetched work…
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {summaryError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-4 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">AI summary unavailable</p>
              <p className="text-muted-foreground mt-1">{summaryError}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                The sampled data in the Data tab is still available.
              </p>
              {summaryWarnings.length > 0 && (
                <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-xs">
                  {summaryWarnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onRetrySummary}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry summary
            </Button>
          </div>
        </div>
      )}

      {summary ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">{summary.headline}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {summary.professionalOverview}
            </p>
            {summaryMeta && (
              <p className="text-muted-foreground mt-2 text-xs">
                AI-generated with {summaryMeta.provider} ({summaryMeta.model}). Verify before using
                in a resume.
              </p>
            )}
          </div>

          {summaryWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Grounding adjustments — unverified numeric claims were removed.
              </p>
              <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-4 text-xs">
                {summaryWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.expertise.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Expertise</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {summary.expertise.map((item) => (
                  <Card key={item.area} size="sm">
                    <CardContent>
                      <p className="font-medium">{item.area}</p>
                      <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-4 text-xs">
                        {item.evidence.map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {summary.workTimeline.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Work timeline</h3>
              <div className="flex flex-col gap-3">
                {summary.workTimeline.map((item) => (
                  <div
                    key={`${item.fromYear}-${item.toYear}-${item.label}`}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {item.fromYear}–{item.toYear}
                      </Badge>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.projectSpotlights.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Project spotlights</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {summary.projectSpotlights.map((item) => {
                  const project = dataset.projects.find(
                    (project) => project.repo.fullName === item.repo
                  );
                  return (
                    <Card key={item.repo} size="sm">
                      <CardHeader>
                        <CardTitle>
                          {project ? (
                            <a
                              href={project.repo.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {item.repo}
                            </a>
                          ) : (
                            item.repo
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <p>{item.whatItIs}</p>
                        {item.technicalSignals.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.technicalSignals.map((signal) => (
                              <Badge key={signal} variant="outline">
                                {signal}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-muted-foreground mt-2 text-xs">{item.whyItMatters}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {summary.collaborationSignals.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Collaboration signals</h3>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                {summary.collaborationSignals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.workStyleObservations.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Work style observations</h3>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                {summary.workStyleObservations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            </section>
          )}

          {summary.resumeBullets.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Suggested resume bullets</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyText(summary.resumeBullets.map((bullet) => `- ${bullet.text}`).join('\n'))
                  }
                >
                  <Copy className="mr-1.5 size-3.5" />
                  Copy all
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {summary.resumeBullets.map((bullet) => (
                  <div
                    key={bullet.text}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <p className="text-sm">{bullet.text}</p>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy resume bullet"
                      onClick={() => copyText(bullet.text)}
                    >
                      <Copy />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                Grounded in fetched data, but review wording before adding to a resume.
              </p>
            </section>
          )}

          {summary.caveats.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Caveats</h3>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                {summary.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        !summaryError && (
          <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">
            No AI summary was generated. The fetched project and timeline data is available in the
            Data tab.
          </div>
        )
      )}

      {!summary && dataset.projects.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Top fetched projects</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {dataset.projects.slice(0, 4).map((project) => (
              <div key={project.repo.fullName} className="rounded-lg border p-3">
                <a
                  href={project.repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {project.repo.fullName}
                </a>
                <p className="text-muted-foreground mt-1 text-xs">
                  {project.repo.description ?? 'Public GitHub repository'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
