"use client";

import { useState, useCallback, useRef } from "react";
import {
  createChatCompletion,
  JD_ANALYSIS_PROMPT,
  EXPERIENCE_MAPPING_PROMPT,
  RESUME_GENERATION_PROMPT,
  RESUME_REVISION_PROMPT,
  RESUME_CRITIQUE_PROMPT,
  RESUME_SPEC_GENERATION_PROMPT,
} from "@/lib/ai";
import { getApiKey, getModel } from "@/lib/storage";
import { generateLatexSource, getLatexEngine } from "@/lib/latex";
import { generateSpecPdfBlob } from "@/lib/export";
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
  ResumeSpec,
  LatexVerificationResult,
} from "@/types";

const MAX_CRITIQUE_ITERATIONS = 50;
const TOP_SUGGESTIONS_COUNT = 5;
const MIN_SCORE_FOR_EARLY_EXIT = 75;
const SCORE_CEILING = 95;
const ATS_SCORE_CEILING = 90;
const SCORE_DELTA_THRESHOLD = 3;
const RESUME_SIMILARITY_THRESHOLD = 0.95; // Resume text ≥95% similar → unchanged
const CRITIQUE_STALENESS_THRESHOLD = 0.8; // Weaknesses/suggestions ≥80% overlap → stale

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
  // LaTeX pipeline fields
  resumeSpec: ResumeSpec | null;
  latexSource: string | null;
  latexPdfBlob: Blob | null;
  latexVerification: LatexVerificationResult | null;
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

/** Compute Jaccard similarity between two string arrays (0-1). Case-insensitive. */
function computeJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const aSet = new Set(a.map((s) => s.toLowerCase().trim()));
  const bSet = new Set(b.map((s) => s.toLowerCase().trim()));
  const intersection = [...aSet].filter((s) => bSet.has(s)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Compute word-level Jaccard similarity between two resume texts (0-1).
 *  Normalizes case, strips punctuation, and ignores words ≤2 chars. */
function computeResumeTextSimilarity(a: string, b: string): number {
  const normalize = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const aWords = new Set(normalize(a));
  const bWords = new Set(normalize(b));
  if (aWords.size === 0 && bWords.size === 0) return 1;
  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Multi-signal convergence detection combining LLM judgment and algorithmic checks. */
function checkAlgorithmicConvergence(
  current: ResumeCritique,
  previous: ResumeCritique | null,
  iteration: number,
  history: Array<{ iteration: number; resume: string; critique: ResumeCritique }>
): ConvergenceResult {
  const newWeaknesses = current.newWeaknesses ?? [];

  // 0a. Staleness detection — critique content is nearly identical to previous iteration
  //     (same weaknesses + same suggestions = AI has no new ideas → stop wasting tokens)
  if (previous && history.length >= 3) {
    const currWeakOverlap = computeJaccardSimilarity(
      current.weaknesses,
      previous.weaknesses
    );
    const currSuggOverlap = computeJaccardSimilarity(
      current.suggestions,
      previous.suggestions
    );

    if (
      currWeakOverlap >= CRITIQUE_STALENESS_THRESHOLD &&
      currSuggOverlap >= CRITIQUE_STALENESS_THRESHOLD
    ) {
      // Current critique is stale — was the previous one also stale?
      const prevPrev = history[history.length - 3].critique;
      const prevWeakOverlap = computeJaccardSimilarity(
        previous.weaknesses,
        prevPrev.weaknesses
      );
      const prevSuggOverlap = computeJaccardSimilarity(
        previous.suggestions,
        prevPrev.suggestions
      );

      if (
        prevWeakOverlap >= CRITIQUE_STALENESS_THRESHOLD &&
        prevSuggOverlap >= CRITIQUE_STALENESS_THRESHOLD
      ) {
        return {
          isConverged: true,
          reason: "stale_critique",
          scoreDelta: current.score - previous.score,
          newWeaknesses,
        };
      }
    }
  }

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
    resumeSpec: null,
    latexSource: null,
    latexPdfBlob: null,
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
          case "resume-spec":
            systemPrompt = RESUME_SPEC_GENERATION_PROMPT;
            break;
          default:
            // latex-generation and latex-verification don't use runStep
            throw new Error(`No system prompt for step: ${step}`);
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
        resumeSpec: null,
        latexSource: null,
        latexPdfBlob: null,
        latexVerification: null,
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
                  reason: "no_resume_change",
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

        // ─── LaTeX Phase ─────────────────────────────────────────

        // Step 5: Generate ResumeSpec from best text resume
        setState((s) => ({
          ...s,
          currentStep: "resume-spec",
        }));

        const specRaw = await runStep(
          "resume-spec",
          `Convert this resume into the structured format:\n\n${bestResume}`
        );
        if (abortRef.current) return;

        let resumeSpec: ResumeSpec;
        try {
          resumeSpec = parseJsonResponse(specRaw) as ResumeSpec;

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
            error: "Failed to parse ResumeSpec from AI response. The text resume is available for download.",
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
          currentStep: "latex-generation",
          resumeSpec,
        }));

        // Generate LaTeX source for .tex download
        const latexSource = generateLatexSource(resumeSpec);
        if (abortRef.current) return;

        // Step 7: Render resume as HTML for preview and PDF
        setState((s) => ({
          ...s,
          currentStep: "latex-verification",
          latexSource,
        }));

        let latexPdfBlob: Blob | null = null;
        let latexVerification: LatexVerificationResult | null = null;

        // Compile ResumeSpec → PDF (local, instant — no CDN)
        const engine = getLatexEngine();
        await engine.init();
        const compileResult = await engine.compile(resumeSpec);
        if (compileResult.success && engine.pdfBlob) {
          latexPdfBlob = engine.pdfBlob;
        }

        // Generate PDF and measure for verification
        const { finalY, pageHeight: pdfPageH, marginBottom: pdfMarginB } =
          await generateSpecPdfBlob(resumeSpec);

        const fitsOnePage = finalY <= pdfPageH - pdfMarginB;

        // ─── Real verification checks ───
        const vChecks: LatexVerificationResult["checks"] = [];

        // 1. Contact info completeness
        const missingContact: string[] = [];
        if (!resumeSpec.meta.name) missingContact.push("name");
        if (!resumeSpec.meta.email) missingContact.push("email");
        vChecks.push({
          name: "Contact Details",
          passed: missingContact.length === 0,
          detail:
            missingContact.length === 0
              ? `Name and email present`
              : `Missing: ${missingContact.join(", ")}`,
        });

        // 2. Section completeness
        const sectionsPresent: string[] = [];
        const sectionsMissing: string[] = [];
        if (resumeSpec.summary.text) sectionsPresent.push("Summary");
        else sectionsMissing.push("Summary");
        if (resumeSpec.experience.length > 0)
          sectionsPresent.push(`Experience (${resumeSpec.experience.length})`);
        else sectionsMissing.push("Experience");
        if (resumeSpec.projects.length > 0)
          sectionsPresent.push(`Projects (${resumeSpec.projects.length})`);
        else sectionsMissing.push("Projects");
        if (resumeSpec.skills.categories.length > 0)
          sectionsPresent.push(`Skills (${resumeSpec.skills.categories.length})`);
        else sectionsMissing.push("Skills");
        if (resumeSpec.education.length > 0)
          sectionsPresent.push(`Education (${resumeSpec.education.length})`);
        else sectionsMissing.push("Education");

        vChecks.push({
          name: "Section Completeness",
          passed: sectionsMissing.length === 0,
          detail:
            sectionsMissing.length === 0
              ? `All present: ${sectionsPresent.join(", ")}`
              : `Present: ${sectionsPresent.join(", ")}${
                  sectionsMissing.length > 0
                    ? ` | Missing: ${sectionsMissing.join(", ")}`
                    : ""
                }`,
        });

        // 3. Page count (from actual PDF measurement)
        vChecks.push({
          name: "Page Count",
          passed: fitsOnePage,
          detail: fitsOnePage
            ? `Fits on 1 letter page (content ends at ${finalY}pt / ${pdfPageH - pdfMarginB}pt)`
            : `Content overflows — ends at ${finalY}pt but page limit is ${pdfPageH - pdfMarginB}pt`,
        });

        // 4. LaTeX source
        vChecks.push({
          name: "LaTeX Source",
          passed: true,
          detail: ".tex source available for download",
        });

        // Build issues list from failed checks
        const vIssues: LatexVerificationResult["issues"] = [];
        for (const check of vChecks) {
          if (!check.passed) {
            vIssues.push({
              severity: check.name === "Contact Details" ? "error" : "warning",
              category:
                check.name === "Contact Details"
                  ? "missing_section"
                  : check.name === "Page Count"
                  ? "page_count"
                  : "formatting",
              message: `${check.name}: ${check.detail}`,
            });
          }
        }

        latexVerification = {
          passes: vChecks.every((c) => c.passed),
          checks: vChecks,
          issues: vIssues,
          pageCount: fitsOnePage ? 1 : 2,
          fixAttempts: 1,
        };

        setState((s) => ({
          ...s,
          latexSource,
          latexPdfBlob,
          latexVerification,
        }));

        // Final state
        setState((s) => ({
          ...s,
          running: false,
          currentStep: null,
          currentResume: bestResume,
          latexSource,
          latexPdfBlob,
          latexVerification,
          resumeSpec,
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
