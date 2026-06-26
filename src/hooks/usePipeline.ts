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
  extractRevisionReport,
  buildRevisionPlan,
  MAX_CRITIQUE_ITERATIONS,
  RESUME_SIMILARITY_THRESHOLD,
  RESUME_GENERATION_TEMPERATURE,
  DEFAULT_STEP_TEMPERATURE,
} from '@/lib/pipeline';
import type {
  MasterResume,
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

  const abortRef = useRef(false);

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
    async (jd: string, masterResume: MasterResume) => {
      abortRef.current = false;
      setState({
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
      });

      const apiKey = getApiKey();
      if (!apiKey) {
        setState((s) => ({
          ...s,
          running: false,
          error: 'API key not set. Go to Settings.',
        }));
        return;
      }

      try {
        // Step 1: JD Analysis
        const analysisRaw = await runStep('jd-analysis', `Analyze this job description:\n\n${jd}`);
        if (abortRef.current) return;
        const analysis = extractJsonFromLLMResponse(analysisRaw) as JDAnalysis;
        setState((s) => ({
          ...s,
          currentStep: 'experience-mapping',
          analysis,
        }));

        // Step 2: Experience Mapping
        const mappingRaw = await runStep(
          'experience-mapping',
          `Job Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nCandidate Master Resume:\n${JSON.stringify(masterResume, null, 2)}`
        );
        if (abortRef.current) return;
        const mapping = extractJsonFromLLMResponse(mappingRaw) as ExperienceMapping;
        setState((s) => ({
          ...s,
          currentStep: 'resume-generation',
          mapping,
        }));

        // Step 3: Initial Resume Generation
        const resumeRaw = await runStep(
          'resume-generation',
          `TARGET ROLE: ${analysis.roleTitle}\n\nJOB ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nEXPERIENCE MAPPING (what to feature, what to downplay):\n${JSON.stringify(mapping, null, 2)}\n\nMASTER RESUME (source of truth — USE ONLY THIS DATA):\n${JSON.stringify(masterResume, null, 2)}`
        );
        if (abortRef.current) return;
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
          setState((s) => ({
            ...s,
            currentStep: 'resume-critique',
            currentResume: resume,
            iteration,
          }));

          // Early-exit: if the resume text is essentially unchanged from the
          // previous iteration, the revision had no effect — skip the critique
          // API call and converge immediately to avoid token waste.
          if (localHistory.length > 0) {
            const prevResume = localHistory[localHistory.length - 1].resume;
            const similarity = computeResumeTextSimilarity(resume, prevResume);
            if (similarity >= RESUME_SIMILARITY_THRESHOLD) {
              setState((s) => ({
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
              }));
              break;
            }
          }

          // Critique with full history context for diffing
          const critiqueContext = buildCritiqueContext(
            resume,
            analysis,
            jd,
            masterResume,
            iteration,
            localHistory
          );
          const critiqueRaw = await runStep('resume-critique', critiqueContext);
          if (abortRef.current) return;

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

          setState((s) => ({
            ...s,
            critique,
            currentResume: resume,
            history: [...localHistory],
            bestResume,
            bestScore,
            convergenceResult,
          }));

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
              masterResume
            );
            const regenRaw = await runStep(
              'resume-generation',
              regenContext,
              RESUME_REVISION_PROMPT,
              0.3 // Lower temperature for surgical edits
            );
            if (abortRef.current) return;

            // Parse revision report if present
            const { resume: cleanedResume } = extractRevisionReport(regenRaw);
            resume = cleanedResume;
          }
        } while (iteration < MAX_CRITIQUE_ITERATIONS);

        // ─── LaTeX Phase ─────────────────────────────────────────

        // Step 5: Generate ResumeSpec from best text resume
        setState((s) => ({
          ...s,
          currentStep: 'resume-spec',
        }));

        const specRaw = await runStep(
          'resume-spec',
          `Target Role: ${analysis.roleTitle}\n\nConvert this resume into the structured format:\n\n${bestResume}`
        );
        if (abortRef.current) return;

        let resumeSpec: ResumeSpec;
        try {
          resumeSpec = extractJsonFromLLMResponse(specRaw) as ResumeSpec;

          // Merge MasterResume contact details into the spec.
          // The text resume may not include structured contact fields,
          // but the MasterResume always has them as the source of truth.
          resumeSpec.meta = {
            ...resumeSpec.meta,
            name: masterResume.name || resumeSpec.meta.name,
            email: masterResume.email || resumeSpec.meta.email,
            phone: masterResume.phone || resumeSpec.meta.phone || undefined,
            linkedin: masterResume.linkedin || resumeSpec.meta.linkedin || undefined,
            portfolio: masterResume.portfolio || resumeSpec.meta.portfolio || undefined,
          };
        } catch {
          // If parsing fails, set error and skip LaTeX phase
          setState((s) => ({
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
          }));
          return;
        }

        // Step 6: Generate LaTeX source from ResumeSpec (deterministic)
        setState((s) => ({
          ...s,
          currentStep: 'latex-generation',
          resumeSpec,
        }));

        // Generate LaTeX source for .tex download
        const latexSource = generateLatexSource(resumeSpec);
        if (abortRef.current) return;

        // Step 7: Render resume as HTML for preview and PDF
        setState((s) => ({
          ...s,
          currentStep: 'latex-verification',
          latexSource,
        }));

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

        setState((s) => ({
          ...s,
          latexSource,
          latexHtmlBlob,
          latexVerification,
        }));

        // Final state
        setState((s) => ({
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
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Pipeline failed';
        setState((s) => ({ ...s, running: false, error: message }));
      }
    },
    [runStep]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((s) => ({
      ...s,
      running: false,
      currentStep: null,
    }));
  }, []);

  return { ...state, run, cancel };
}
