"use client";

import { useState, useCallback, useRef } from "react";
import {
  createChatCompletion,
  JD_ANALYSIS_PROMPT,
  EXPERIENCE_MAPPING_PROMPT,
  RESUME_GENERATION_PROMPT,
  RESUME_REVISION_PROMPT,
  RESUME_CRITIQUE_PROMPT,
} from "@/lib/ai";
import { getApiKey, getModel } from "@/lib/storage";
import type {
  MasterResume,
  JDAnalysis,
  ExperienceMapping,
  ResumeCritique,
  PipelineStep,
  CategorizedSuggestions,
  RevisionPlan,
  ConvergenceResult,
  CritiqueCategory,
} from "@/types";

const MAX_CRITIQUE_ITERATIONS = 50;
const TOP_SUGGESTIONS_COUNT = 5;
const MIN_SCORE_FOR_EARLY_EXIT = 75;
const SCORE_CEILING = 95;
const ATS_SCORE_CEILING = 90;
const SCORE_DELTA_THRESHOLD = 3;

interface PipelineState {
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
}

// ─── Helper functions ───────────────────────────────────────────

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

/** Keyword-based fallback classifier for when the LLM doesn't provide categorized suggestions. */
function categorizeSuggestions(suggestions: string[]): CategorizedSuggestions {
  const result: CategorizedSuggestions = {
    fabrication: [],
    content: [],
    impact: [],
    ats: [],
    clarity: [],
  };

  for (const s of suggestions) {
    const lower = s.toLowerCase();
    if (
      lower.includes("fabricat") ||
      lower.includes("invent") ||
      lower.includes("not in master resume") ||
      lower.includes("made up") ||
      lower.includes("hallucinat") ||
      lower.includes("false") ||
      lower.includes("does not appear in")
    ) {
      result.fabrication.push(s);
    } else if (
      lower.includes("impact") ||
      lower.includes("outcome") ||
      lower.includes("metric") ||
      lower.includes("quantif") ||
      lower.includes("bullet") ||
      lower.includes("demonstrat") ||
      lower.includes("result")
    ) {
      result.impact.push(s);
    } else if (
      lower.includes("ats") ||
      lower.includes("applicant tracking") ||
      lower.includes("keyword") ||
      lower.includes("screen")
    ) {
      result.ats.push(s);
    } else if (
      lower.includes("clear") ||
      lower.includes("concis") ||
      lower.includes("wordy") ||
      lower.includes("verbos") ||
      lower.includes("tighten") ||
      lower.includes("redundan") ||
      lower.includes("readab")
    ) {
      result.clarity.push(s);
    } else {
      result.content.push(s);
    }
  }

  return result;
}

function getCategoryLabel(cat: CritiqueCategory): string {
  const labels: Record<CritiqueCategory, string> = {
    fabrication: "CRITICAL",
    impact: "HIGH",
    ats: "MEDIUM",
    clarity: "LOW",
    content: "MEDIUM",
  };
  return labels[cat];
}

const CATEGORY_PRIORITY: CritiqueCategory[] = [
  "fabrication",
  "impact",
  "ats",
  "content",
  "clarity",
];

/** Build a prioritized revision plan from a critique result. */
function buildRevisionPlan(
  critique: ResumeCritique,
  previousPlan?: RevisionPlan
): RevisionPlan {
  const cats: CategorizedSuggestions =
    critique.categorizedSuggestions ??
    categorizeSuggestions(critique.suggestions);

  // Flatten in priority order
  const topSuggestions: string[] = [];
  for (const cat of CATEGORY_PRIORITY) {
    for (const s of cats[cat]) {
      if (topSuggestions.length >= TOP_SUGGESTIONS_COUNT) break;
      topSuggestions.push(`[${getCategoryLabel(cat)}] ${s}`);
    }
    if (topSuggestions.length >= TOP_SUGGESTIONS_COUNT) break;
  }

  // Compute addressed / unresolved from previous plan
  const addressedFromPrevious: string[] = [];
  const unresolvedFromPrevious: string[] = [];

  if (previousPlan) {
    const addressedWeaknesses = new Set(
      (critique.previousWeaknessesAddressed ?? []).map((w) =>
        w.toLowerCase().trim()
      )
    );
    for (const s of previousPlan.topSuggestions) {
      const stripped = s.replace(/^\[.*?\]\s*/, "").toLowerCase().trim();
      // Check if any addressed weakness overlaps with this suggestion
      const wasAddressed = [...addressedWeaknesses].some(
        (aw) => aw.includes(stripped.substring(0, 20)) || stripped.includes(aw.substring(0, 20))
      );
      if (wasAddressed) {
        addressedFromPrevious.push(s);
      } else {
        unresolvedFromPrevious.push(s);
      }
    }
  }

  return { topSuggestions, categories: cats, addressedFromPrevious, unresolvedFromPrevious };
}

/** Multi-signal convergence detection combining LLM judgment and algorithmic checks. */
function checkAlgorithmicConvergence(
  current: ResumeCritique,
  previous: ResumeCritique | null,
  iteration: number,
  history: Array<{ iteration: number; resume: string; critique: ResumeCritique }>
): ConvergenceResult {
  const newWeaknesses = current.newWeaknesses ?? [];

  // 1. Dual ceiling: both overall score AND ATS score must be exceptional
  if (current.score >= SCORE_CEILING && current.atsScore >= ATS_SCORE_CEILING) {
    return {
      isConverged: true,
      reason: "score_ceiling",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 1b. Overall score ceiling alone: exceptional quality, but note ATS gap
  if (current.score >= SCORE_CEILING) {
    return {
      isConverged: true,
      reason: "score_ceiling",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 2. Score delta: less than threshold improvement over last iteration,
  //    and at least 2 iterations completed (so we have a trend)
  //    Only applies when score is already decent AND ATS score is respectable
  if (previous && history.length >= 2) {
    const scoreDelta = current.score - previous.score;
    if (scoreDelta < SCORE_DELTA_THRESHOLD && current.score >= MIN_SCORE_FOR_EARLY_EXIT && current.atsScore >= 80) {
      // Check the last two deltas — if both are tiny, we've stagnated
      const prevPrev = history.length >= 2 ? history[history.length - 2].critique : null;
      if (prevPrev) {
        const prevDelta = previous.score - prevPrev.score;
        if (prevDelta < SCORE_DELTA_THRESHOLD) {
          return {
            isConverged: true,
            reason: "score_delta",
            scoreDelta,
            newWeaknesses,
          };
        }
      }
    }
  }

  // 3. No new weaknesses: critique found nothing new to fix, and score is decent
  if (previous && newWeaknesses.length === 0 && current.score >= MIN_SCORE_FOR_EARLY_EXIT) {
    return {
      isConverged: true,
      reason: "no_new_weaknesses",
      scoreDelta: current.score - previous.score,
      newWeaknesses: [],
    };
  }

  // 4. Max iterations reached
  if (iteration >= MAX_CRITIQUE_ITERATIONS) {
    return {
      isConverged: false,
      reason: "max_iterations",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  // 5. LLM self-judgment
  if (current.isConverged && current.score >= 85) {
    return {
      isConverged: true,
      reason: "llm_judgment",
      scoreDelta: previous ? current.score - previous.score : null,
      newWeaknesses,
    };
  }

  return {
    isConverged: false,
    reason: "llm_judgment",
    scoreDelta: previous ? current.score - previous.score : null,
    newWeaknesses,
  };
}

/** Parse the revision report marker from LLM output. Falls back gracefully. */
function extractRevisionReport(rawText: string): {
  resume: string;
  report: {
    addressedSuggestions: string[];
    unaddressedSuggestions: string[];
    unchangedSections: string[];
  } | null;
} {
  const marker = "---REVISION REPORT---";
  const idx = rawText.indexOf(marker);
  if (idx === -1) {
    return { resume: rawText, report: null };
  }

  const resume = rawText.substring(0, idx).trim();
  const reportRaw = rawText.substring(idx + marker.length).trim();

  try {
    // Extract JSON object from the report section
    const jsonMatch = reportRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const report = JSON.parse(jsonMatch[0]);
      return {
        resume,
        report: {
          addressedSuggestions: report.addressedSuggestions ?? [],
          unaddressedSuggestions: report.unaddressedSuggestions ?? [],
          unchangedSections: report.unchangedSections ?? [],
        },
      };
    }
  } catch {
    // Fall through to graceful fallback
  }

  return { resume, report: null };
}

/** Build the critique user message including full iteration history. */
function buildCritiqueContext(
  resume: string,
  analysis: JDAnalysis,
  jd: string,
  masterResume: MasterResume,
  iteration: number,
  history: Array<{ iteration: number; resume: string; critique: ResumeCritique }>
): string {
  let context = `Review this resume for the role:\n\nResume:\n${resume}\n\nTarget Role:\n${analysis.roleTitle}\n\nJob Description:\n${jd}\n\nMaster Resume (for authenticity verification):\n${JSON.stringify(masterResume, null, 2)}\n\nIteration: ${iteration}`;

  if (history.length > 0) {
    context += `\n\n## PREVIOUS CRITIQUE HISTORY\n`;
    for (const entry of history) {
      // Truncate long weakness lists to keep context manageable
      const weaknesses = entry.critique.weaknesses.slice(0, 5);
      context += `\nIteration ${entry.iteration}: Score ${entry.critique.score}, Strengths: ${entry.critique.strengths.slice(0, 3).join("; ")}, Weaknesses: ${weaknesses.join("; ")}`;
    }
    const lastCritique = history[history.length - 1].critique;
    context += `\n\n## PREVIOUS WEAKNESSES (check which are addressed):\n${lastCritique.weaknesses.map((w) => `- ${w}`).join("\n")}`;
    context += `\n\n## PREVIOUS SUGGESTIONS (check which were applied):\n${lastCritique.suggestions.map((s) => `- ${s}`).join("\n")}`;
  }

  return context;
}

/** Build the revision user message with prioritized action plan and full context. */
function buildRevisionContext(
  resume: string,
  critique: ResumeCritique,
  revisionPlan: RevisionPlan,
  analysis: JDAnalysis,
  mapping: ExperienceMapping | null,
  masterResume: MasterResume
): string {
  const parts = [
    `## CURRENT RESUME\n${resume}`,
    `## CRITIQUE SCORE: ${critique.score}/100 (ATS: ${critique.atsScore}/100)`,
    `## STRENGTHS (PRESERVE THESE)\n${critique.strengths.map((s) => `- ${s}`).join("\n")}`,
    `## PRIORITIZED ACTION PLAN (address in priority order — focus on top items)\n${revisionPlan.topSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
  ];

  if (mapping) {
    parts.push(
      `## EXPERIENCE MAPPING\n- Matched Skills: ${mapping.matchedSkills.join(", ")}\n- Missing Skills: ${mapping.missingSkills.join(", ")}\n- Feature These Experiences: ${mapping.recommendedExperience.join(", ")}\n- Feature These Projects: ${mapping.recommendedProjects.join(", ")}\n- Downplay: ${mapping.sectionsToDownplay.join(", ")}`
    );
  }

  if (revisionPlan.unresolvedFromPrevious.length > 0) {
    parts.push(
      `## UNRESOLVED FROM PREVIOUS ITERATION (these were not addressed — try again)\n${revisionPlan.unresolvedFromPrevious.join("\n")}`
    );
  }

  parts.push(
    `## TARGET ROLE: ${analysis.roleTitle}`,
    `## JOB ANALYSIS\n${JSON.stringify(analysis, null, 2)}`,
    `## MASTER RESUME (source of truth — USE ONLY THIS DATA)\n${JSON.stringify(masterResume, null, 2)}`
  );

  return parts.join("\n\n");
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
      if (!apiKey) throw new Error("API key not set");

      let systemPrompt: string;
      if (systemPromptOverride) {
        systemPrompt = systemPromptOverride;
      } else {
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
      }

      const defaultTemp = step === "resume-generation" ? 0.4 : 0.2;
      const temperature = temperatureOverride ?? defaultTemp;

      const res = await createChatCompletion({
        model: getModel(),
        apiKey,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature,
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
        history: [],
        bestResume: null,
        bestScore: 0,
        convergenceResult: null,
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

        // Step 3: Initial Resume Generation
        const resumeRaw = await runStep(
          "resume-generation",
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
            currentStep: "resume-critique",
            currentResume: resume,
            iteration,
          }));

          // Critique with full history context for diffing
          const critiqueContext = buildCritiqueContext(
            resume,
            analysis,
            jd,
            masterResume,
            iteration,
            localHistory
          );
          const critiqueRaw = await runStep("resume-critique", critiqueContext);
          if (abortRef.current) return;

          critique = parseJsonResponse(critiqueRaw) as ResumeCritique;

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
              "resume-generation",
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

        // Final state: use best resume across all iterations
        setState((s) => ({
          ...s,
          running: false,
          currentStep: null,
          currentResume: bestResume,
          critique,
          iteration,
          history: [...localHistory],
          bestResume,
          bestScore,
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
    setState((s) => ({
      ...s,
      running: false,
      currentStep: null,
    }));
  }, []);

  return { ...state, run, cancel };
}
