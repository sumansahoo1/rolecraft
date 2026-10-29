'use client';

import { useState } from 'react';
import { AlertTriangle, Globe, Loader2, Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { MAX_JD_CHARS } from '@/lib/jd-link/constants';
import { SOURCE_LABELS, UI_COPY, truncatedNote } from '@/lib/jd-link/messages';
import type {
  FetchedJobDescription,
  JdInputMode,
  JdLinkErrorInfo,
  JobFetchStatus,
  StartBlockedReason,
} from '@/types';

interface JDInputPanelProps {
  mode: JdInputMode;
  onModeChange: (mode: JdInputMode) => void;
  manualJd: string;
  onManualJdChange: (value: string) => void;
  linkJd: string;
  onLinkJdChange: (value: string) => void;
  link: string;
  onLinkChange: (value: string) => void;
  onFetchLink: () => void;
  onCancelFetch: () => void;
  onRetryWithReader: () => void;
  fetchStatus: JobFetchStatus;
  fetchResult: FetchedJobDescription | null;
  fetchError: JdLinkErrorInfo | null;
  attemptedUrl: string | null; // R3-12: URL actually attempted, not the edited input
  linkStale: boolean; // F16
  readerEnabled: boolean;
  onReaderEnabledChange: (value: boolean) => void;
  autoRun: boolean;
  onAutoRunChange: (value: boolean) => void;
  onRun: () => void;
  onCancelRun: () => void;
  running: boolean;
  resumeLoaded: boolean;
  startBlocked: StartBlockedReason | null; // R3-3
  onDismissStartBlocked: () => void;
  onLoadExample: () => void;
}

const OPEN_ORIGINAL_CODES = new Set([
  'blocked',
  'not_found',
  'empty_content',
  'too_large',
  'timeout',
  'network',
  'reader_disabled',
  'reader_failed',
  'bad_response',
]);

export function JDInputPanel({
  mode,
  onModeChange,
  manualJd,
  onManualJdChange,
  linkJd,
  onLinkJdChange,
  link,
  onLinkChange,
  onFetchLink,
  onCancelFetch,
  onRetryWithReader,
  fetchStatus,
  fetchResult,
  fetchError,
  attemptedUrl,
  linkStale,
  readerEnabled,
  onReaderEnabledChange,
  autoRun,
  onAutoRunChange,
  onRun,
  onCancelRun,
  running,
  resumeLoaded,
  startBlocked,
  onDismissStartBlocked,
  onLoadExample,
}: JDInputPanelProps) {
  const [noteDismissed, setNoteDismissed] = useState(false);

  const fetching = fetchStatus === 'fetching';
  const controlsDisabled = running || fetching;
  const invalidLink =
    fetchError?.code === 'invalid_url' || fetchError?.code === 'unsupported_scheme';
  const canOpenOriginal =
    attemptedUrl !== null && fetchError !== null && OPEN_ORIGINAL_CODES.has(fetchError.code);
  const showLinkText = fetchResult !== null || linkJd.length > 0;

  return (
    <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-r p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Job Description</h2>
        {resumeLoaded && (
          <Badge variant="secondary" className="text-xs">
            Resume loaded
          </Badge>
        )}
      </div>

      {!resumeLoaded ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs
            value={mode}
            onValueChange={(value) => onModeChange(value as JdInputMode)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste" disabled={fetching}>
                {UI_COPY.pasteTab}
              </TabsTrigger>
              <TabsTrigger value="link" disabled={fetching}>
                {UI_COPY.linkTab}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="mt-2 flex min-h-0 flex-1 flex-col">
              <Textarea
                aria-label="Job description"
                placeholder="Paste the job description here..."
                className="min-h-[160px] flex-1 resize-none font-mono text-sm"
                value={manualJd}
                onChange={(event) => onManualJdChange(event.target.value)}
                disabled={controlsDisabled}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 self-start"
                onClick={onLoadExample}
                disabled={controlsDisabled}
              >
                {UI_COPY.loadExample}
              </Button>
            </TabsContent>

            <TabsContent value="link" className="mt-2 flex min-h-0 flex-1 flex-col">
              {!noteDismissed && (
                <div
                  role="note"
                  className="mb-2 rounded-md border border-amber-600/30 bg-amber-600/10 p-2.5 text-[11px] leading-tight text-amber-900 dark:text-amber-200"
                >
                  <p>{UI_COPY.firstUseReaderNote}</p>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1"
                    onClick={() => setNoteDismissed(true)}
                  >
                    {UI_COPY.gotIt}
                  </Button>
                </div>
              )}

              <Label htmlFor="job-link" className="mb-1.5">
                Job link
              </Label>
              <Input
                id="job-link"
                placeholder="https://jobs.lever.co/company/123"
                autoComplete="off"
                spellCheck={false}
                value={link}
                onChange={(event) => onLinkChange(event.target.value)}
                disabled={controlsDisabled}
                aria-invalid={invalidLink || undefined}
                aria-describedby={invalidLink ? 'job-link-error' : undefined}
                aria-busy={fetching || undefined}
              />

              <div className="mt-2 flex gap-2">
                <Button
                  onClick={onFetchLink}
                  disabled={controlsDisabled}
                  className="flex-1"
                  size="sm"
                >
                  {fetching ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Globe className="mr-1.5 size-4" />
                  )}
                  {UI_COPY.fetchDescription}
                </Button>
                {fetching && (
                  <Button variant="destructive" size="sm" onClick={onCancelFetch}>
                    <Square className="mr-1.5 size-4" />
                    {UI_COPY.cancel}
                  </Button>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={readerEnabled ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  aria-pressed={readerEnabled}
                  onClick={() => onReaderEnabledChange(!readerEnabled)}
                  disabled={controlsDisabled}
                >
                  <Globe className="mr-1 size-3.5" />
                  {readerEnabled ? UI_COPY.readerOn : UI_COPY.readerOff}
                </Button>
                <Button
                  type="button"
                  variant={autoRun ? 'secondary' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  aria-pressed={autoRun}
                  onClick={() => onAutoRunChange(!autoRun)}
                  disabled={controlsDisabled}
                >
                  <Play className="mr-1 size-3.5" />
                  {autoRun ? UI_COPY.autoRunOn : UI_COPY.autoRunOff}
                </Button>
              </div>

              {fetching && (
                <p
                  aria-live="polite"
                  className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs"
                >
                  <Loader2 className="size-3.5 animate-spin" />
                  {UI_COPY.fetching}
                </p>
              )}

              {startBlocked && (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-amber-600/30 bg-amber-600/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
                >
                  <p>
                    {startBlocked === 'no_api_key'
                      ? UI_COPY.startBlockedNoApiKey
                      : UI_COPY.startBlockedNoResume}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <a
                      href={startBlocked === 'no_api_key' ? '/app/settings' : '/app/resume'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-2"
                    >
                      {startBlocked === 'no_api_key' ? UI_COPY.openSettings : UI_COPY.addResume}
                    </a>
                    <Button variant="ghost" size="xs" onClick={onDismissStartBlocked}>
                      {UI_COPY.dismiss}
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">{UI_COPY.opensInNewTab}</p>
                </div>
              )}

              {fetchError && (
                <div
                  id="job-link-error"
                  role="alert"
                  className="border-destructive/50 bg-destructive/10 text-destructive mt-2 rounded-md border p-2.5 text-xs"
                >
                  <p>{fetchError.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {fetchError.retryable && (
                      <Button variant="outline" size="xs" onClick={onFetchLink}>
                        {UI_COPY.tryAgain}
                      </Button>
                    )}
                    {fetchError.code === 'reader_disabled' && (
                      <Button variant="outline" size="xs" onClick={onRetryWithReader}>
                        {UI_COPY.turnOnReader}
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" onClick={() => onModeChange('paste')}>
                      {UI_COPY.pasteManually}
                    </Button>
                    {canOpenOriginal && (
                      <a
                        href={attemptedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline underline-offset-2"
                      >
                        {UI_COPY.openOriginal}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {fetchResult && (
                <div className="text-muted-foreground mt-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{SOURCE_LABELS[fetchResult.source]}</Badge>
                    {fetchResult.truncated && (
                      <Badge variant="outline">{UI_COPY.truncatedBadge}</Badge>
                    )}
                    {fetchResult.quality === 'low_confidence' && (
                      <Badge
                        variant="outline"
                        className="border-amber-600/40 text-amber-700 dark:text-amber-300"
                      >
                        {UI_COPY.reviewBadge}
                      </Badge>
                    )}
                  </div>
                  {fetchResult.truncated && <p className="mt-1">{truncatedNote(MAX_JD_CHARS)}</p>}
                  {fetchResult.source === 'reader' && (
                    <p className="mt-1">{UI_COPY.readerResultLine}</p>
                  )}
                  {fetchResult.quality === 'low_confidence' && (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {UI_COPY.lowConfidenceNote}
                    </p>
                  )}
                  {(fetchResult.title || fetchResult.company) && (
                    <p className="text-foreground mt-1">
                      {[fetchResult.title, fetchResult.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              )}

              {fetchResult && fetchResult.warnings.length > 0 && (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-amber-600/30 bg-amber-600/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
                >
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <ul className="list-disc space-y-1 pl-3">
                      {fetchResult.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {linkStale && (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-amber-600/30 bg-amber-600/10 p-2.5 text-xs text-amber-900 dark:text-amber-200"
                >
                  <p className="font-medium">{UI_COPY.staleLinkTitle}</p>
                  <p className="mt-0.5">{UI_COPY.staleLinkDetail}</p>
                </div>
              )}

              {showLinkText && (
                <Textarea
                  aria-label="Fetched job description"
                  placeholder="Paste the job description here..."
                  className="mt-2 min-h-[160px] flex-1 resize-none font-mono text-sm"
                  value={linkJd}
                  onChange={(event) => onLinkJdChange(event.target.value)}
                  disabled={controlsDisabled}
                />
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-3 flex shrink-0 gap-2">
            <Button onClick={onRun} className="flex-1" disabled={controlsDisabled}>
              <Play className="mr-1.5 size-4" />
              {UI_COPY.generate}
            </Button>
            {running && (
              <Button variant="destructive" onClick={onCancelRun}>
                <Square className="mr-1.5 size-4" />
                {UI_COPY.cancel}
              </Button>
            )}
          </div>

          <p className="text-muted-foreground mt-2 shrink-0 text-[11px] leading-tight">
            {UI_COPY.readerDisclosure}
          </p>
        </>
      )}
    </div>
  );
}
