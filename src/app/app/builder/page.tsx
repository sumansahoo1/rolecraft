"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square, FileText, AlertTriangle, Copy } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineProgress } from "@/components/pipeline/PipelineProgress";
import { JDAnalysisPanel } from "@/components/pipeline/JDAnalysisPanel";
import { ExperienceMappingPanel } from "@/components/pipeline/ExperienceMappingPanel";
import { ResumeDisplay } from "@/components/pipeline/ResumeDisplay";
import { CritiquePanel } from "@/components/pipeline/CritiquePanel";
import VerificationPanel from "@/components/pipeline/VerificationPanel";
import { usePipeline } from "@/hooks/usePipeline";
import { getMasterResume, getApiKey } from "@/lib/storage";
import type { MasterResume } from "@/types";
import { copyToClipboard } from "@/lib/export";

const EXAMPLE_JD = `Senior Frontend Engineer

We're looking for a Senior Frontend Engineer to join our product team. You'll build and maintain high-quality web applications using React and TypeScript.

Requirements:
- 5+ years of experience in frontend development
- Strong proficiency in React, TypeScript, and modern CSS
- Experience with state management (Redux, Zustand, or similar)
- Familiarity with testing frameworks (Jest, Playwright)
- Understanding of web performance optimization
- Nice to have: Next.js, GraphQL, design systems`;

export default function BuilderPage() {
  const router = useRouter();
  const pipeline = usePipeline();
  const [jd, setJd] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const [userPickedTab, setUserPickedTab] = useState(false);
  const [masterResume, setMasterResume] = useState<MasterResume | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);

  // Load master resume on the client only to avoid hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMasterResume(getMasterResume());
    setResumeLoaded(true);
  }, []);

  const handleRun = () => {
    if (!jd.trim()) {
      toast.error("Paste a job description first");
      return;
    }
    if (!masterResume) {
      toast.error("No master resume found. Add one first.");
      router.push("/app/resume");
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      toast.error("Set your DeepSeek API key in Settings first");
      router.push("/app/settings");
      return;
    }

    setActiveTab("analysis");
    setUserPickedTab(false);
    pipeline.run(jd, masterResume);
  };

  const pipelineDone = !pipeline.running && pipeline.currentResume != null;
  const latexAvailable = !pipeline.running && pipeline.latexSource != null;
  const latexPhase = pipeline.running &&
    (pipeline.currentStep === "resume-spec" ||
     pipeline.currentStep === "latex-generation" ||
     pipeline.currentStep === "latex-verification");

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
  const displayTab = pipelineDone && !userPickedTab
    ? (latexAvailable ? "latex" : "resume")
    : activeTab;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: JD Input */}
      <div className="flex w-80 shrink-0 flex-col border-r p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Job Description</h2>
          {masterResume && (
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
        ) : !masterResume ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle className="size-6 text-yellow-600" />
              <p className="text-center text-sm text-muted-foreground">
                No master resume found. Add your resume first to start building.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/app/resume")}
              >
                <FileText className="mr-1.5 size-3.5" />
                Add Master Resume
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Textarea
              placeholder="Paste the job description here..."
              className="min-h-[200px] flex-1 resize-none font-mono text-sm"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={pipeline.running}
            />
            <div className="mt-3 flex gap-2">
              {!pipeline.running ? (
                <Button onClick={handleRun} className="flex-1">
                  <Play className="mr-1.5 size-4" />
                  Generate Resume
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={pipeline.cancel}
                  className="flex-1"
                >
                  <Square className="mr-1.5 size-4" />
                  Cancel
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => setJd(EXAMPLE_JD)}
              disabled={pipeline.running}
            >
              Load example JD
            </Button>
          </>
        )}
      </div>

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
          <div className="mx-6 mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {pipeline.error}
          </div>
        )}

        {!pipeline.analysis && !pipeline.running && !pipeline.error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Paste a job description and click Generate Resume
              </p>
            </div>
          </div>
        )}

        {pipelineDone && (
          <div className="mx-6 mt-4 rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {isConverged
                    ? "Resume Converged!"
                    : `Resume Ready (${pipeline.iteration} iterations)`}
                  {latexAvailable && " • LaTeX Generated"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isConverged
                    ? `Score: ${pipeline.critique?.score}/100 — ATS Score: ${pipeline.critique?.atsScore}/100`
                    : `Max iterations reached. Best score: ${pipeline.bestScore}/100.`}
                  {pipeline.convergenceResult?.reason &&
                    pipeline.convergenceResult.reason !== "llm_judgment" &&
                    ` • Stopped: ${pipeline.convergenceResult.reason.replace(/_/g, " ")}`}
                </p>
                {pipeline.bestScore > (pipeline.critique?.score ?? 0) && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Best resume (score {pipeline.bestScore}) shown. Last iteration scored{" "}
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
                  {pipeline.analysis && (
                    <CheckBadge className="ml-1.5 size-3 text-green-600" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="mapping">
                  Mapping
                  {pipeline.mapping && (
                    <CheckBadge className="ml-1.5 size-3 text-green-600" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="resume"
                  className={
                    pipelineDone && !userPickedTab && !latexAvailable
                      ? "ring-2 ring-green-500/50"
                      : ""
                  }
                >
                  Text
                  {pipeline.currentResume && (
                    <span className="ml-1.5 flex size-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="critique">
                  Critique
                  {pipeline.critique && (
                    <CheckBadge className="ml-1.5 size-3 text-green-600" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="latex"
                  className={
                    latexAvailable && !userPickedTab
                      ? "ring-2 ring-green-500/50"
                      : ""
                  }
                >
                  LaTeX
                  {pipeline.latexSource && (
                    <span className="ml-1.5 flex size-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="verify">
                  Verify
                  {pipeline.latexVerification && (
                    pipeline.latexVerification.passes ? (
                      <CheckBadge className="ml-1.5 size-3 text-green-600" />
                    ) : (
                      <span className="ml-1.5 flex size-2 rounded-full bg-amber-500" />
                    )
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analysis" className="mt-4">
                {pipeline.analysis ? (
                  <JDAnalysisPanel data={pipeline.analysis} />
                ) : pipeline.running &&
                  pipeline.currentStep === "jd-analysis" ? (
                  <LoadingCards />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Waiting for JD analysis...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="mapping" className="mt-4">
                {pipeline.mapping ? (
                  <ExperienceMappingPanel data={pipeline.mapping} />
                ) : pipeline.running &&
                  pipeline.currentStep === "experience-mapping" ? (
                  <LoadingCards />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Waiting for experience mapping...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="resume" className="mt-4">
                {pipeline.currentResume ? (
                  <ResumeDisplay
                    resume={pipeline.currentResume}
                    iteration={pipeline.iteration}
                    bestScore={pipeline.bestScore}
                    totalIterations={pipeline.history.length}
                  />
                ) : pipeline.running &&
                  (pipeline.currentStep === "resume-generation" ||
                    pipeline.currentStep === "resume-critique") ? (
                  <LoadingResume />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Waiting for resume generation...
                  </p>
                )}
              </TabsContent>

              <TabsContent value="critique" className="mt-4">
                {pipeline.critique ? (
                  <CritiquePanel
                    data={pipeline.critique}
                    iteration={pipeline.iteration}
                    converged={!!isConverged}
                    history={pipeline.history}
                    bestScore={pipeline.bestScore}
                    convergenceResult={pipeline.convergenceResult}
                  />
                ) : pipeline.running &&
                  pipeline.currentStep === "resume-critique" ? (
                  <LoadingCards />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Waiting for critique...
                  </p>
                )}
              </TabsContent>

              {/* LaTeX Tab */}
              <TabsContent value="latex" className="mt-4">
                {pipeline.latexSource ? (
                  <ResumeDisplay
                    resume={pipeline.currentResume || ""}
                    iteration={pipeline.iteration}
                    bestScore={pipeline.bestScore}
                    totalIterations={pipeline.history.length}
                    showLatex={true}
                    latexSource={pipeline.latexSource}
                    latexHtmlBlob={pipeline.latexPdfBlob}
                    resumeSpec={pipeline.resumeSpec}
                  />
                ) : latexPhase ? (
                  <LoadingResume />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    LaTeX will be generated after the critique phase...
                  </p>
                )}
              </TabsContent>

              {/* Verify Tab */}
              <TabsContent value="verify" className="mt-4">
                {pipeline.latexVerification ? (
                  <VerificationPanel
                    verification={pipeline.latexVerification}
                  />
                ) : latexPhase &&
                  pipeline.currentStep === "latex-verification" ? (
                  <LoadingCards />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
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
