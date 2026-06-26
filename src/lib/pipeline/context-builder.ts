import type { JDAnalysis, ExperienceMapping, MasterResume, ResumeCritique, RevisionPlan } from "@/types";

/** Build the critique user message including full iteration history. */
export function buildCritiqueContext(
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
export function buildRevisionContext(
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
