'use client';

import { useState, useCallback, useRef } from 'react';
import {
  createChatCompletion,
  extractJsonFromLLMResponse,
  JD_ANALYSIS_PROMPT,
  EXPERIENCE_MAPPING_PROMPT,
  RESUME_GENERATION_PROMPT,
  RESUME_REVISION_PROMPT,
  RESUME_CRITIQUE_PROMPT,
  RESUME_SPEC_GENERATION_PROMPT,
} from '@/lib/ai';
import { describePipelineError } from '@/lib/ai/error-copy';
import { getApiKey, getModel, getProvider } from '@/lib/storage';
import {
  generateLatexSource,
  getLatexEngine,
  shrinkSpecToFit,
  buildLatexVerificationResult,
} from '@/lib/latex';
import {
  computeResumeTextSimilarity,
  buildCritiqueContext,
  buildRevisionContext,
  checkAlgorithmicConvergence,
  createRunEpoch,
  extractRevisionReport,
  buildRevisionPlan,
  MAX_CRITIQUE_ITERATIONS,
  RESUME_SIMILARITY_THRESHOLD,
  RESUME_GENERATION_TEMPERATURE,
  DEFAULT_STEP_TEMPERATURE,
} from '@/lib/pipeline';
import { UI_COPY } from '@/lib/jd-link/messages';
import type {
  JDAnalysis,
  ExperienceMapping,
  ResumeCritique,
  PipelineStep,
  ConvergenceResult,
  ResumeSpec,
  LatexVerificationResult,
} from '@/types';
import { TOKEN_BUDGETS } from '@/types';

export interface PipelineState {
  running: boolean;
  currentStep: PipelineStep | null;
  error: string | null;
  analysis: JDAnalysis | null;
  mapping: ExperienceMapping | null;
  currentResume: string | null;
  critique: ResumeCritique | null;
  iteration: number;
  history: Array<{ iteration: number; resume: string; critique: ResumeCritique }>;
  bestResume: string | null;
  bestScore: number;
  convergenceResult: ConvergenceResult | null;
  // LaTeX pipeline fields
  resumeSpec: ResumeSpec | null;
  latexSource: string | null;
  latexHtmlBlob: Blob | null;
  latexVerification: LatexVerificationResult | null;
}

// ─── Hook ───────────────────────────────────────────────────────

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    running: false,
    currentStep: null,
    error: null,
    analysis: null,
    mapping: null,
    currentResume: null,
    critique: null,
    iteration: 0,
    history: [],
    bestResume: null,
    bestScore: 0,
    convergenceResult: null,
    resumeSpec: null,
    latexSource: null,
    latexHtmlBlob: null,
    latexVerification: null,
  });

  const [runEpoch] = useState(() => createRunEpoch());
  const runInFlightRef = useRef(false);

  const runStep = useCallback(
    async (
      step: PipelineStep,
      context: string,
      systemPromptOverride?: string,
      temperatureOverride?: number
    ) => {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('API key not set');

      let systemPrompt: string;
      if (systemPromptOverride) {
        systemPrompt = systemPromptOverride;
      } else {
        switch (step) {
          case 'jd-analysis':
            systemPrompt = JD_ANALYSIS_PROMPT;
            break;
          case 'experience-mapping':
            systemPrompt = EXPERIENCE_MAPPING_PROMPT;
            break;
          case 'resume-generation':
            systemPrompt = RESUME_GENERATION_PROMPT;
            break;
          case 'resume-critique':
            systemPrompt = RESUME_CRITIQUE_PROMPT;
            break;
          case 'resume-spec':
            systemPrompt = RESUME_SPEC_GENERATION_PROMPT;
            break;
          default:
            // latex-generation and latex-verification don't use runStep
            throw new Error(`No system prompt for step: ${step}`);
        }
      }

      const defaultTemp =
        step === 'resume-generation' ? RESUME_GENERATION_TEMPERATURE : DEFAULT_STEP_TEMPERATURE;
      const temperature = temperatureOverride ?? defaultTemp;

      const res = await createChatCompletion({
        provider: getProvider(),
        model: getModel(),
        apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context },
        ],
        temperature,
        maxTokens: TOKEN_BUDGETS[step],
      });

      return res.content;
    },
    []
  );

  const run = useCallback(
    async (jd: string, extractionJson: Record<string, unknown>): Promise<boolean> => {
      if (runInFlightRef.current) return false; // synchronous, before any await
      const myEpoch = runEpoch.begin();

      const setStateIfCurrent = (update: (s: PipelineState) => PipelineState): boolean => {
        if (!runEpoch.isCurrent(myEpoch)) return false;
        setState(update);
        return true;
      };

      try {
        runInFlightRef.current = true; // R3-8: inside try/finally, never stuck

        const resumeData = extractionJson;
        const resumeDataStr = JSON.stringify(resumeData, null, 2);

        if (
          !setStateIfCurrent(() => ({
            running: true,
            currentStep: 'jd-analysis',
            error: null,
            analysis: null,
            mapping: null,
            currentResume: null,
            critique: null,
            iteration: 0,
            history: [],
            bestResume: null,
            bestScore: 0,
            convergenceResult: null,
            resumeSpec: null,
            latexSource: null,
            latexHtmlBlob: null,
            latexVerification: null,
          }))
        ) {
          return false;
        }

        const apiKey = getApiKey();
        if (!apiKey) {
          setStateIfCurrent((s) => ({
            ...s,
            running: false,
            error: UI_COPY.missingApiKey,
          }));
          return false;
        }

        // Step 1: JD Analysis
        const analysisRaw = await runStep('jd-analysis', `Analyze this job description:\n\n${jd}`);
        if (!runEpoch.isCurrent(myEpoch)) return false;
        const analysis = extractJsonFromLLMResponse(analysisRaw) as JDAnalysis;
        if (
          !setStateIfCurrent((s) => ({
            ...s,
            currentStep: 'experience-mapping',
            analysis,
          }))
        ) {
          return false;
        }

        // Step 2: Experience Mapping
        const mappingRaw = await runStep(
          'experience-mapping',
          `Job Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nCandidate Master Resume:\n${resumeDataStr}`
        );
        if (!runEpoch.isCurrent(myEpoch)) return false;
        const mapping = extractJsonFromLLMResponse(mappingRaw) as ExperienceMapping;
        if (
          !setStateIfCurrent((s) => ({
            ...s,
            currentStep: 'resume-generation',
            mapping,
          }))
        ) {
          return false;
        }

        // Step 3: Initial Resume Generation
        const resumeRaw = await runStep(
          'resume-generation',
          `TARGET ROLE: ${analysis.roleTitle}\n\nJOB ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nEXPERIENCE MAPPING (what to feature, what to downplay):\n${JSON.stringify(mapping, null, 2)}\n\nMASTER RESUME (source of truth — USE ONLY THIS DATA):\n${resumeDataStr}`
        );
        if (!runEpoch.isCurrent(myEpoch)) return false;
        let resume = resumeRaw;

        // Step 4: Critique Loop (strengthened)
        let critique: ResumeCritique | null = null;
        let iteration = 0;
        const localHistory: Array<{
          iteration: number;
          resume: string;
          critique: ResumeCritique;
        }> = [];
        let bestResume = resume;
        let bestScore = 0;
        let previousCritique: ResumeCritique | null = null;

        do {
          iteration++;
          if (
            !setStateIfCurrent((s) => ({
              ...s,
              currentStep: 'resume-critique',
              currentResume: resume,
              iteration,
            }))
          ) {
            return false;
          }

          // Early-exit: if the resume text is essentially unchanged from the
          // previous iteration, the revision had no effect — skip the critique
          // API call and converge immediately to avoid token waste.
          if (localHistory.length > 0) {
            const prevResume = localHistory[localHistory.length - 1].resume;
            const similarity = computeResumeTextSimilarity(resume, prevResume);
            if (similarity >= RESUME_SIMILARITY_THRESHOLD) {
              if (
                !setStateIfCurrent((s) => ({
                  ...s,
                  critique,
                  currentResume: resume,
                  history: [...localHistory],
                  bestResume,
                  bestScore,
                  convergenceResult: {
                    isConverged: true,
                    reason: 'no_resume_change',
                    scoreDelta: null,
                    newWeaknesses: [],
                  },
                }))
              ) {
                return false;
              }
              break;
            }
          }

          // Critique with full history context for diffing
          const critiqueContext = buildCritiqueContext(
            resume,
            analysis,
            jd,
            resumeData,
            iteration,
            localHistory
          );
          const critiqueRaw = await runStep('resume-critique', critiqueContext);
          if (!runEpoch.isCurrent(myEpoch)) return false;

          critique = extractJsonFromLLMResponse(critiqueRaw) as ResumeCritique;

          // Accumulate history
          localHistory.push({ iteration, resume, critique });

          // Best-of-N tracking
          if (critique.score > bestScore) {
            bestScore = critique.score;
            bestResume = resume;
          }

          // Algorithmic convergence check
          const convergenceResult = checkAlgorithmicConvergence(
            critique,
            previousCritique,
            iteration,
            localHistory
          );

          if (
            !setStateIfCurrent((s) => ({
              ...s,
              critique,
              currentResume: resume,
              history: [...localHistory],
              bestResume,
              bestScore,
              convergenceResult,
            }))
          ) {
            return false;
          }

          if (convergenceResult.isConverged) break;

          previousCritique = critique;

          if (iteration < MAX_CRITIQUE_ITERATIONS) {
            // Build revision plan from critique
            const prevPlan =
              localHistory.length > 1
                ? buildRevisionPlan(localHistory[localHistory.length - 2].critique)
                : undefined;
            const revisionPlan = buildRevisionPlan(critique, prevPlan);

            // Regenerate using the dedicated revision prompt, with experience mapping
            const regenContext = buildRevisionContext(
              resume,
              critique,
              revisionPlan,
              analysis,
              mapping,
              resumeData
            );
            const regenRaw = await runStep(
              'resume-generation',
              regenContext,
              RESUME_REVISION_PROMPT,
              0.3 // Lower temperature for surgical edits
            );
            if (!runEpoch.isCurrent(myEpoch)) return false;

            // Parse revision report if present
            const { resume: cleanedResume } = extractRevisionReport(regenRaw);
            resume = cleanedResume;
          }
        } while (iteration < MAX_CRITIQUE_ITERATIONS);

        // ─── LaTeX Phase ─────────────────────────────────────────

        // Step 5: Generate ResumeSpec from best text resume
        if (!setStateIfCurrent((s) => ({ ...s, currentStep: 'resume-spec' }))) {
          return false;
        }

        const specRaw = await runStep(
          'resume-spec',
          `Target Role: ${analysis.roleTitle}\n\nConvert this resume into the structured format:\n\n${bestResume}`
        );
        if (!runEpoch.isCurrent(myEpoch)) return false;

        let resumeSpec: ResumeSpec;
        try {
          resumeSpec = extractJsonFromLLMResponse(specRaw) as ResumeSpec;

          // Merge extraction JSON contact details into the spec.
          resumeSpec.meta = {
            ...resumeSpec.meta,
            name: (resumeData.name as string) || resumeSpec.meta.name,
            email: (resumeData.email as string) || resumeSpec.meta.email,
            phone: (resumeData.phone as string) || resumeSpec.meta.phone || undefined,
            linkedin: (resumeData.linkedin as string) || resumeSpec.meta.linkedin || undefined,
            github: (resumeData.github as string) || resumeSpec.meta.github || undefined,
            twitter: (resumeData.twitter as string) || resumeSpec.meta.twitter || undefined,
            portfolio: (resumeData.portfolio as string) || resumeSpec.meta.portfolio || undefined,
          };
        } catch {
          // If parsing fails, set error and skip LaTeX phase
          if (
            !setStateIfCurrent((s) => ({
              ...s,
              running: false,
              currentStep: null,
              currentResume: bestResume,
              error:
                'Failed to parse ResumeSpec from AI response. The text resume is available for download.',
              critique,
              iteration,
              history: [...localHistory],
              bestResume,
              bestScore,
            }))
          ) {
            return false;
          }
          return false;
        }

        // Step 6: Generate LaTeX source from ResumeSpec (deterministic)
        if (
          !setStateIfCurrent((s) => ({
            ...s,
            currentStep: 'latex-generation',
            resumeSpec,
          }))
        ) {
          return false;
        }

        // Generate LaTeX source for .tex download
        const latexSource = generateLatexSource(resumeSpec);
        if (!runEpoch.isCurrent(myEpoch)) return false;

        // Step 7: Render resume as HTML for preview and PDF
        if (
          !setStateIfCurrent((s) => ({
            ...s,
            currentStep: 'latex-verification',
            latexSource,
          }))
        ) {
          return false;
        }

        let latexHtmlBlob: Blob | null = null;

        // Compile ResumeSpec → HTML preview (local, instant — no CDN)
        const engine = getLatexEngine();
        await engine.init();
        const compileResult = await engine.compile(resumeSpec);
        if (compileResult.success && engine.htmlPreviewBlob) {
          latexHtmlBlob = engine.htmlPreviewBlob;
        }

        // ─── Auto-shrink to fit 1 page ───
        // Renders HTML and measures actual browser layout (same engine as preview)
        const shrinkResult = await shrinkSpecToFit(resumeSpec);
        // Use the shrunk spec for final output if it was modified
        if (shrinkResult.level > 0) {
          resumeSpec = shrinkResult.spec;
        }

        // ─── Verification checks ───
        const latexVerification = buildLatexVerificationResult(resumeSpec, shrinkResult);

        if (
          !setStateIfCurrent((s) => ({
            ...s,
            latexSource,
            latexHtmlBlob,
            latexVerification,
          }))
        ) {
          return false;
        }

        // Final state
        if (
          !setStateIfCurrent((s) => ({
            ...s,
            running: false,
            currentStep: null,
            currentResume: bestResume,
            latexSource,
            latexHtmlBlob,
            latexVerification,
            resumeSpec,
            critique,
            iteration,
            history: [...localHistory],
            bestResume,
            bestScore,
          }))
        ) {
          return false;
        }
        return true;
      } catch (err) {
        console.error(err); // raw provider error: console only, never rendered
        if (!runEpoch.isCurrent(myEpoch)) return false;
        setState((s) => ({ ...s, running: false, error: describePipelineError(err) }));
        return false;
      } finally {
        if (runEpoch.current() === myEpoch) runInFlightRef.current = false;
      }
    },
    [runEpoch, runStep]
  );

  const cancel = useCallback(() => {
    runEpoch.cancel();
    runInFlightRef.current = false;
    setState((s) => ({
      ...s,
      running: false,
      currentStep: null,
    }));
  }, [runEpoch]);

  return { ...state, run, cancel };
}
