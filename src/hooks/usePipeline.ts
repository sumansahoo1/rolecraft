"use client";

import { useState, useCallback, useRef } from "react";
import {
  createChatCompletion,
  JD_ANALYSIS_PROMPT,
  EXPERIENCE_MAPPING_PROMPT,
  RESUME_GENERATION_PROMPT,
  RESUME_CRITIQUE_PROMPT,
} from "@/lib/ai";
import { getApiKey, getModel } from "@/lib/storage";
import type {
  MasterResume,
  JDAnalysis,
  ExperienceMapping,
  ResumeCritique,
  PipelineStep,
} from "@/types";

const MAX_CRITIQUE_ITERATIONS = 5;

interface PipelineState {
  running: boolean;
  currentStep: PipelineStep | null;
  error: string | null;
  analysis: JDAnalysis | null;
  mapping: ExperienceMapping | null;
  currentResume: string | null;
  critique: ResumeCritique | null;
  iteration: number;
}

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

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
  });

  const abortRef = useRef(false);

  const runStep = useCallback(
    async (step: PipelineStep, context: string) => {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API key not set");

      let systemPrompt: string;
      switch (step) {
        case "jd-analysis":
          systemPrompt = JD_ANALYSIS_PROMPT;
          break;
        case "experience-mapping":
          systemPrompt = EXPERIENCE_MAPPING_PROMPT;
          break;
        case "resume-generation":
          systemPrompt = RESUME_GENERATION_PROMPT;
          break;
        case "resume-critique":
          systemPrompt = RESUME_CRITIQUE_PROMPT;
          break;
      }

      const res = await createChatCompletion({
        model: getModel(),
        apiKey,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: step === "resume-generation" ? 0.7 : 0.2,
        maxTokens: 4096,
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
        currentStep: "jd-analysis",
        error: null,
        analysis: null,
        mapping: null,
        currentResume: null,
        critique: null,
        iteration: 0,
      });

      const apiKey = getApiKey();
      if (!apiKey) {
        setState((s) => ({
          ...s,
          running: false,
          error: "API key not set. Go to Settings.",
        }));
        return;
      }

      try {
        // Step 1: JD Analysis
        const analysisRaw = await runStep(
          "jd-analysis",
          `Analyze this job description:\n\n${jd}`
        );
        if (abortRef.current) return;
        const analysis = parseJsonResponse(analysisRaw) as JDAnalysis;
        setState((s) => ({
          ...s,
          currentStep: "experience-mapping",
          analysis,
        }));

        // Step 2: Experience Mapping
        const mappingRaw = await runStep(
          "experience-mapping",
          `Job Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nCandidate Master Resume:\n${JSON.stringify(masterResume, null, 2)}`
        );
        if (abortRef.current) return;
        const mapping = parseJsonResponse(mappingRaw) as ExperienceMapping;
        setState((s) => ({
          ...s,
          currentStep: "resume-generation",
          mapping,
        }));

        // Step 3: Resume Generation
        const resumeRaw = await runStep(
          "resume-generation",
          `Create a tailored resume for this role.\n\nJob Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nExperience Mapping:\n${JSON.stringify(mapping, null, 2)}\n\nMaster Resume:\n${JSON.stringify(masterResume, null, 2)}`
        );
        if (abortRef.current) return;
        let resume = resumeRaw;

        // Step 4: Critique Loop
        let critique: ResumeCritique;
        let iteration = 0;

        do {
          iteration++;
          setState((s) => ({
            ...s,
            currentStep: "resume-critique",
            currentResume: resume,
            iteration,
          }));

          const critiqueRaw = await runStep(
            "resume-critique",
            `Review this resume for the role:\n\nResume:\n${resume}\n\nJob Description:\n${jd}\n\nIteration: ${iteration}`
          );
          if (abortRef.current) return;

          critique = parseJsonResponse(critiqueRaw) as ResumeCritique;
          setState((s) => ({
            ...s,
            critique,
            currentResume: resume,
          }));

          if (critique.score >= 85 && critique.isConverged) break;

          if (iteration < MAX_CRITIQUE_ITERATIONS) {
            // Regenerate with critique suggestions
            const regenRaw = await runStep(
              "resume-generation",
              `Revise this resume based on the critique suggestions.\n\nCurrent Resume:\n${resume}\n\nCritique Suggestions:\n${critique.suggestions.join("\n")}\n\nJob Analysis:\n${JSON.stringify(analysis, null, 2)}\n\nMaster Resume:\n${JSON.stringify(masterResume, null, 2)}`
            );
            if (abortRef.current) return;
            resume = regenRaw;
          }
        } while (iteration < MAX_CRITIQUE_ITERATIONS);

        setState((s) => ({
          ...s,
          running: false,
          currentStep: null,
          currentResume: resume,
          critique,
          iteration,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pipeline failed";
        setState((s) => ({ ...s, running: false, error: message }));
      }
    },
    [runStep]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((s) => ({ ...s, running: false }));
  }, []);

  return { ...state, run, cancel };
}
