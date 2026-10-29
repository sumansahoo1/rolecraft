'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, Copy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PipelineProgress } from '@/components/pipeline/PipelineProgress';
import { JDAnalysisPanel } from '@/components/pipeline/JDAnalysisPanel';
import { ExperienceMappingPanel } from '@/components/pipeline/ExperienceMappingPanel';
import { ResumeDisplay } from '@/components/pipeline/ResumeDisplay';
import { CritiquePanel } from '@/components/pipeline/CritiquePanel';
import VerificationPanel from '@/components/pipeline/VerificationPanel';
import { JDInputPanel } from '@/components/pipeline/JDInputPanel';
import { usePipeline } from '@/hooks/usePipeline';
import { useJobDescriptionFetch } from '@/hooks/useJobDescriptionFetch';
import {
  getApiKey,
  getExtractionJson,
  getJdReaderFallbackEnabled,
  setJdReaderFallbackEnabled,
} from '@/lib/storage';
import { MAX_JD_CHARS } from '@/lib/jd-link/constants';
import { UI_COPY, truncatedNote } from '@/lib/jd-link/messages';
import { isStaleFetchedLink, parseJobUrl } from '@/lib/jd-link/url';
import type { JdInputMode, StartBlockedReason } from '@/types';

import { copyToClipboard } from '@/lib/export';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const EXAMPLE_JD = `Senior Frontend Engineer

We're looking for a Senior Frontend Engineer to join our product team. You'll build and maintain high-quality web applications using React and TypeScript.

Requirements:
- 5+ years of experience in frontend development
- Strong proficiency in React, TypeScript, and modern CSS
- Experience with state management (Redux, Zustand, or similar)
- Familiarity with testing frameworks (Jest, Playwright)
- Understanding of web performance optimization
- Nice to have: Next.js, GraphQL, design systems`;

interface StartPipelineOptions {
  navigate: boolean;
}

export default function BuilderPage() {
  const router = useRouter();
  const pipeline = usePipeline();
  const jobFetch = useJobDescriptionFetch();
  const [mode, setMode] = useState<JdInputMode>('paste');
  const [manualJd, setManualJd] = useState('');
  const [linkJd, setLinkJd] = useState('');
  const [link, setLink] = useState('');
  const [autoRun, setAutoRun] = useState(true);
  const [readerEnabled, setReaderEnabled] = useState(true);
  const [lastFetchedSourceUrl, setLastFetchedSourceUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [userPickedTab, setUserPickedTab] = useState(false);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [startBlocked, setStartBlocked] = useState<StartBlockedReason | null>(null);

  useEffect(() => {
    const extractionJson = getExtractionJson();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResumeLoaded(true);
    if (!extractionJson) {
      toast.error(UI_COPY.noResume);
      router.push('/app/resume');
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReaderEnabled(getJdReaderFallbackEnabled());
  }, []);

  const linkStale = linkJd.trim().length > 0 && isStaleFetchedLink(link, lastFetchedSourceUrl);

  const startPipeline = async (
    text: string,
    { navigate }: StartPipelineOptions
  ): Promise<boolean> => {
    setStartBlocked(null);

    if (!text.trim()) {
      toast.error(UI_COPY.pasteJdFirst);
      return false;
    }
    if (text.length > MAX_JD_CHARS) {
      toast.error(UI_COPY.jdTooLong);
      return false;
    }
    if (pipeline.running) {
      toast.error(UI_COPY.waitForRun);
      return false;
    }
    const extractionJson = getExtractionJson();
    if (!extractionJson) {
      if (navigate) {
        toast.error(UI_COPY.noResume);
        router.push('/app/resume');
      } else {
        setStartBlocked('no_resume');
      }
      return false;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      if (navigate) {
        toast.error(UI_COPY.missingApiKey);
        router.push('/app/settings');
      } else {
        setStartBlocked('no_api_key');
      }
      return false;
    }
    setActiveTab('analysis');
    setUserPickedTab(false);
    return await pipeline.run(text, extractionJson);
  };

  const handleRun = () => {
    const activeJd = mode === 'paste' ? manualJd : linkJd;
    if (!activeJd.trim()) {
      toast.error(mode === 'paste' ? UI_COPY.pasteJdFirst : UI_COPY.fetchLinkFirst);
      return;
    }
    void startPipeline(activeJd, { navigate: mode === 'paste' });
  };

  const loadJob = async (input: string, allowReader: boolean, attemptedUrl: string) => {
    const data = await jobFetch.fetchJob(input, { allowReader, attemptedUrl });
    if (!data) return;
    setLinkJd(data.text);
    setLastFetchedSourceUrl(data.sourceUrl);
    if (data.truncated) {
      toast.info(truncatedNote(MAX_JD_CHARS));
      return;
    }
    if (data.quality === 'low_confidence') {
      toast.warning(UI_COPY.lowConfidence);
      return;
    }
    if (data.warnings.length > 0) {
      toast.warning(UI_COPY.fetchedWithWarnings);
      return;
    }
    if (autoRun && !pipeline.running) {
      await startPipeline(data.text, { navigate: false });
    }
  };

  const handleFetchLink = () => {
    if (pipeline.running || jobFetch.status === 'fetching') return;
    if (!link.trim()) {
      toast.error(UI_COPY.pasteLinkFirst);
      return;
    }
    setStartBlocked(null);
    const parsed = parseJobUrl(link);
    const attemptedUrl = parsed.ok ? parsed.normalized : link.trim();
    void loadJob(link, readerEnabled, attemptedUrl);
  };

  const handleRetryWithReader = () => {
    if (pipeline.running || jobFetch.status === 'fetching') return;
    setReaderEnabled(true);
    try {
      setJdReaderFallbackEnabled(true);
    } catch {
      toast.error(UI_COPY.preferenceSaveFailed);
    }
    const parsed = parseJobUrl(link);
    const attemptedUrl = parsed.ok ? parsed.normalized : link.trim();
    void loadJob(link, true, attemptedUrl); // explicit true avoids stale state
  };

  const handleReaderEnabledChange = (next: boolean) => {
    setReaderEnabled(next);
    try {
      setJdReaderFallbackEnabled(next);
    } catch {
      toast.error(UI_COPY.preferenceSaveFailed);
    }
  };

  const pipelineDone = !pipeline.running && pipeline.currentResume != null;
  const latexAvailable = !pipeline.running && pipeline.latexSource != null;
  const latexPhase =
    pipeline.running &&
    (pipeline.currentStep === 'resume-spec' ||
      pipeline.currentStep === 'latex-generation' ||
      pipeline.currentStep === 'latex-verification');

  const isConverged =
    pipeline.critique?.score != null &&
    pipeline.critique.score >= 85 &&
    pipeline.critique.atsScore >= 90 &&
    pipeline.critique.isConverged;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (pipelineDone) setUserPickedTab(true);
  };

  // Auto-advance to LaTeX tab when it becomes available
  const displayTab =
    pipelineDone && !userPickedTab ? (latexAvailable ? 'latex' : 'resume') : activeTab;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: JD Input */}
      <JDInputPanel
        mode={mode}
        onModeChange={setMode}
        manualJd={manualJd}
        onManualJdChange={setManualJd}
        linkJd={linkJd}
        onLinkJdChange={setLinkJd}
        link={link}
        onLinkChange={setLink}
        onFetchLink={handleFetchLink}
        onCancelFetch={jobFetch.cancel}
        onRetryWithReader={handleRetryWithReader}
        fetchStatus={jobFetch.status}
        fetchResult={jobFetch.data}
        fetchError={jobFetch.error}
        attemptedUrl={jobFetch.attemptedUrl}
        linkStale={linkStale}
        readerEnabled={readerEnabled}
        onReaderEnabledChange={handleReaderEnabledChange}
        autoRun={autoRun}
        onAutoRunChange={setAutoRun}
        onRun={handleRun}
        onCancelRun={pipeline.cancel}
        running={pipeline.running}
        resumeLoaded={resumeLoaded}
        startBlocked={startBlocked}
        onDismissStartBlocked={() => setStartBlocked(null)}
        onLoadExample={() => setManualJd(EXAMPLE_JD)}
      />

      {/* Right: Results */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h2 className="text-sm font-semibold">Results</h2>
          {(pipeline.running || pipeline.currentResume) && (
            <PipelineProgress
              currentStep={pipeline.currentStep}
              running={pipeline.running}
              iteration={pipeline.iteration}
            />
          )}
        </div>

        {pipeline.error && (
          <div className="border-destructive/50 bg-destructive/10 text-destructive mx-6 mt-4 rounded-lg border p-4 text-sm">
            {pipeline.error}
          </div>
        )}

        {!pipeline.analysis && !pipeline.running && !pipeline.error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="text-muted-foreground/40 mx-auto size-10" />
              <p className="text-muted-foreground mt-3 text-sm">{UI_COPY.noDescriptionYet}</p>
            </div>
          </div>
        )}

        {pipelineDone && (
          <div className="mx-6 mt-4 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {isConverged
                    ? 'Resume Converged!'
                    : `Resume Ready (${pipeline.iteration} iterations)`}
                  {latexAvailable && ' • LaTeX Generated'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {isConverged
                    ? `Score: ${pipeline.critique?.score}/100 — ATS Score: ${pipeline.critique?.atsScore}/100`
                    : `Max iterations reached. Best score: ${pipeline.bestScore}/100.`}
                  {pipeline.convergenceResult?.reason &&
                    pipeline.convergenceResult.reason !== 'llm_judgment' &&
                    ` • Stopped: ${pipeline.convergenceResult.reason.replace(/_/g, ' ')}`}
                </p>
                {pipeline.bestScore > (pipeline.critique?.score ?? 0) && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Best resume (score {pipeline.bestScore}) shown. Last iteration scored{' '}
                    {pipeline.critique?.score}.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (pipeline.currentResume) {
                    await copyToClipboard(pipeline.currentResume);
                  }
                }}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy
              </Button>
            </div>
          </div>
        )}

        {(pipeline.analysis || pipeline.running) && (
          <div className="flex-1 overflow-auto p-6">
            <Tabs value={displayTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="analysis">
                  Analysis
                  {pipeline.analysis && <CheckBadge className="ml-1.5 size-3 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger value="mapping">
                  Mapping
                  {pipeline.mapping && <CheckBadge className="ml-1.5 size-3 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger
                  value="resume"
                  className={
                    pipelineDone && !userPickedTab && !latexAvailable
                      ? 'ring-2 ring-green-500/50'
                      : ''
                  }
                >
                  Text
                  {pipeline.currentResume && (
                    <span className="ml-1.5 flex size-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="critique">
                  Critique
                  {pipeline.critique && <CheckBadge className="ml-1.5 size-3 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger
                  value="latex"
                  className={latexAvailable && !userPickedTab ? 'ring-2 ring-green-500/50' : ''}
                >
                  LaTeX
                  {pipeline.latexSource && (
                    <span className="ml-1.5 flex size-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="verify">
                  Verify
                  {pipeline.latexVerification &&
                    (pipeline.latexVerification.passes ? (
                      <CheckBadge className="ml-1.5 size-3 text-green-600" />
                    ) : (
                      <span className="ml-1.5 flex size-2 rounded-full bg-amber-500" />
                    ))}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="mt-4">
                {pipeline.analysis ? (
                  <ErrorBoundary>
                    <JDAnalysisPanel data={pipeline.analysis} />
                  </ErrorBoundary>
                ) : pipeline.running && pipeline.currentStep === 'jd-analysis' ? (
                  <LoadingCards />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Waiting for JD analysis...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="mt-4">
                {pipeline.mapping ? (
                  <ErrorBoundary>
                    <ExperienceMappingPanel data={pipeline.mapping} />
                  </ErrorBoundary>
                ) : pipeline.running && pipeline.currentStep === 'experience-mapping' ? (
                  <LoadingCards />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Waiting for experience mapping...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="resume" className="mt-4">
                {pipeline.currentResume ? (
                  <ErrorBoundary>
                    <ResumeDisplay
                      resume={pipeline.currentResume}
                      iteration={pipeline.iteration}
                      bestScore={pipeline.bestScore}
                      totalIterations={pipeline.history.length}
                      roleTitle={pipeline.analysis?.roleTitle}
                      companyName={pipeline.analysis?.companyName}
                    />
                  </ErrorBoundary>
                ) : pipeline.running &&
                  (pipeline.currentStep === 'resume-generation' ||
                    pipeline.currentStep === 'resume-critique') ? (
                  <LoadingResume />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Waiting for resume generation...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="critique" className="mt-4">
                {pipeline.critique ? (
                  <ErrorBoundary>
                    <CritiquePanel
                      data={pipeline.critique}
                      iteration={pipeline.iteration}
                      converged={!!isConverged}
                      history={pipeline.history}
                      bestScore={pipeline.bestScore}
                      convergenceResult={pipeline.convergenceResult}
                    />
                  </ErrorBoundary>
                ) : pipeline.running && pipeline.currentStep === 'resume-critique' ? (
                  <LoadingCards />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Waiting for critique...
                  </p>
                )}
              </TabsContent>

              {/* LaTeX Tab */}
              <TabsContent value="latex" className="mt-4">
                {pipeline.latexSource ? (
                  <ErrorBoundary>
                    <ResumeDisplay
                      resume={pipeline.currentResume || ''}
                      iteration={pipeline.iteration}
                      bestScore={pipeline.bestScore}
                      totalIterations={pipeline.history.length}
                      roleTitle={pipeline.analysis?.roleTitle}
                      companyName={pipeline.analysis?.companyName}
                      showLatex={true}
                      latexSource={pipeline.latexSource}
                      latexHtmlBlob={pipeline.latexHtmlBlob}
                      resumeSpec={pipeline.resumeSpec}
                    />
                  </ErrorBoundary>
                ) : latexPhase ? (
                  <LoadingResume />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    LaTeX will be generated after the critique phase...
                  </p>
                )}
              </TabsContent>

              {/* Verify Tab */}
              <TabsContent value="verify" className="mt-4">
                {pipeline.latexVerification ? (
                  <ErrorBoundary>
                    <VerificationPanel verification={pipeline.latexVerification} />
                  </ErrorBoundary>
                ) : latexPhase && pipeline.currentStep === 'latex-verification' ? (
                  <LoadingCards />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Verification runs after LaTeX compilation...
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckBadge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
      />
    </svg>
  );
}

function LoadingCards() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-4">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="mb-2 h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="rounded-xl border p-4">
        <Skeleton className="mb-3 h-3 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function LoadingResume() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-3/4" />
        <Skeleton className="mb-6 h-3 w-5/6" />
        <Skeleton className="mb-2 h-3 w-1/2" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-2/3" />
        <Skeleton className="mb-6 h-3 w-4/5" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="mb-2 h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
