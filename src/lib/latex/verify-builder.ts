import type { ResumeSpec, LatexVerificationResult } from "@/types";
import type { ShrinkResult } from "./shrink";

/** Build verification result from ResumeSpec and shrink-to-fit measurements. */
export function buildLatexVerificationResult(
  resumeSpec: ResumeSpec,
  shrinkResult: ShrinkResult
): LatexVerificationResult {
  const fit = shrinkResult.fit;
  const fitsOnePage = fit.fits;

  // 1. Contact info
  const missingContact: string[] = [];
  if (!resumeSpec.meta.name) missingContact.push("name");
  if (!resumeSpec.meta.email) missingContact.push("email");

  // 2. Section completeness
  const sPresent: string[] = [];
  const sMissing: string[] = [];
  if (resumeSpec.summary.text) sPresent.push("Summary");
  else sMissing.push("Summary");
  if (resumeSpec.experience.length > 0) sPresent.push(`Exp (${resumeSpec.experience.length})`);
  else sMissing.push("Experience");
  if (resumeSpec.projects.length > 0) sPresent.push(`Projects (${resumeSpec.projects.length})`);
  else sMissing.push("Projects");
  if (resumeSpec.skills.categories.length > 0) sPresent.push(`Skills (${resumeSpec.skills.categories.length})`);
  else sMissing.push("Skills");
  if (resumeSpec.education.length > 0) sPresent.push(`Edu (${resumeSpec.education.length})`);
  else sMissing.push("Education");

  const checks: LatexVerificationResult["checks"] = [
    {
      name: "Contact Details",
      passed: missingContact.length === 0,
      detail:
        missingContact.length === 0
          ? "Name and email present"
          : `Missing: ${missingContact.join(", ")}`,
    },
    {
      name: "Section Completeness",
      passed: sMissing.length === 0,
      detail: sMissing.length === 0
        ? `All present: ${sPresent.join(", ")}`
        : `Missing: ${sMissing.join(", ")}`,
    },
    {
      name: "Page Count",
      passed: fitsOnePage,
      detail: fitsOnePage
        ? `Fits on 1 letter page (${fit.scrollHeight}px / ${fit.pageHeight}px usable)`
        : `Overflows by ~${fit.overflowPx}px (est. ${fit.estPages} pages). Shrink level ${shrinkResult.level}/4 applied.`,
    },
    {
      name: "LaTeX Source",
      passed: true,
      detail: ".tex source available for download",
    },
  ];

  const issues: LatexVerificationResult["issues"] = [];
  for (const check of checks) {
    if (!check.passed) {
      issues.push({
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

  return {
    passes: checks.every((c) => c.passed),
    checks,
    issues,
    pageCount: fitsOnePage ? 1 : fit.estPages,
    fixAttempts: shrinkResult.level + 1,
  };
}
