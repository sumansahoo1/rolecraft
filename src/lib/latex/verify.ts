import type {
  ResumeSpec,
  LatexVerificationResult,
  LatexVerificationCheck,
  LatexVerificationIssue,
} from '@/types';

const SECTION_KEYWORDS: Record<string, string[]> = {
  summary: ['summary', 'professional summary', 'profile'],
  experience: ['experience', 'work experience', 'employment', 'professional experience'],
  projects: ['projects', 'personal projects', 'side projects'],
  skills: ['skills', 'technical skills', 'core competencies', 'technologies'],
  education: ['education', 'academic background'],
};

function extractPageCount(log: string): number | null {
  // TeX log ends with: "Output written on <file>.pdf (N pages, ...)"
  const match = log.match(/Output written on .*?\((\d+)\s*pages?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Alternative: try a different pattern
  const altMatch = log.match(/\((\d+)\s*page/);
  if (altMatch) {
    return parseInt(altMatch[1], 10);
  }
  return null;
}

function extractErrors(log: string): string[] {
  const errors: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    if (line.startsWith('!')) {
      errors.push(line.replace(/^!\s*/, '').trim());
    }
  }
  return errors;
}

function extractOverfullBoxes(log: string): string[] {
  const warnings: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    if (/Overfull\\s+\\\\hbox/i.test(line) || line.includes('Overfull \\hbox')) {
      warnings.push(line.trim());
    }
  }
  return warnings;
}

function extractUnderfullBoxes(log: string): string[] {
  const warnings: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    if (/Underfull\\s+\\\\hbox/i.test(line) || line.includes('Underfull \\hbox')) {
      warnings.push(line.trim());
    }
  }
  return warnings;
}

function extractFontWarnings(log: string): string[] {
  const warnings: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    if (
      line.includes('Font') &&
      (line.includes('not found') ||
        line.includes('not available') ||
        line.includes('No file') ||
        line.includes('substituted') ||
        line.includes('missing'))
    ) {
      warnings.push(line.trim());
    }
  }
  return warnings;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function countSectionsInLog(log: string): string[] {
  // The log won't have section headings directly.
  // Instead we check the LaTeX source was compiled successfully
  // and assume sections are present. This is checked during source generation.
  // We return any detected sections from log parsing.
  const detected: string[] = [];
  const lines = log.split('\n');
  for (const line of lines) {
    // Look for section markers in auxiliary files mentioned in log
    for (const [key, patterns] of Object.entries(SECTION_KEYWORDS)) {
      for (const pattern of patterns) {
        if (line.toLowerCase().includes(pattern.toLowerCase())) {
          if (!detected.includes(key)) {
            detected.push(key);
          }
        }
      }
    }
  }
  return detected;
}

export function verifyLatexOutput(
  log: string,
  compilationSuccess: boolean,
  spec: ResumeSpec,
  fixAttempts: number,
  latexSource: string
): LatexVerificationResult {
  const checks: LatexVerificationCheck[] = [];
  const issues: LatexVerificationIssue[] = [];

  // 1. Compilation success
  const errors = extractErrors(log);
  if (!compilationSuccess || errors.length > 0) {
    checks.push({
      name: 'Compilation Success',
      passed: false,
      detail:
        errors.length > 0
          ? `Compilation errors: ${errors.slice(0, 3).join('; ')}`
          : 'Compilation failed with unknown error',
    });
    issues.push({
      severity: 'error',
      category: 'compilation',
      message: errors.length > 0 ? errors[0] : 'LaTeX compilation failed',
    });
  } else {
    checks.push({
      name: 'Compilation Success',
      passed: true,
      detail: 'LaTeX compiled without errors',
    });
  }

  // 2. Page count check
  const pageCount = extractPageCount(log);
  if (pageCount === null) {
    checks.push({
      name: 'Page Count',
      passed: false,
      detail: 'Could not determine page count from log',
    });
    issues.push({
      severity: 'warning',
      category: 'page_count',
      message: 'Could not determine page count',
    });
  } else if (pageCount > 1) {
    checks.push({
      name: 'Page Count',
      passed: false,
      detail: `Output is ${pageCount} pages (target: 1 page)`,
    });
    issues.push({
      severity: 'error',
      category: 'page_count',
      message: `Resume is ${pageCount} pages — needs to fit on 1 page`,
    });
  } else {
    checks.push({
      name: 'Page Count',
      passed: true,
      detail: `Output is exactly 1 page`,
    });
  }

  // 3. Overfull hbox check
  const overfullBoxes = extractOverfullBoxes(log);
  if (overfullBoxes.length > 0) {
    checks.push({
      name: 'Text Overflow',
      passed: false,
      detail: `${overfullBoxes.length} overfull hbox warning(s) detected`,
    });
    issues.push({
      severity: 'warning',
      category: 'overflow',
      message: `${overfullBoxes.length} overfull hbox warning(s) — some text may overflow`,
    });
  } else {
    checks.push({
      name: 'Text Overflow',
      passed: true,
      detail: 'No overfull hbox warnings',
    });
  }

  // 4. Underfull hbox check (aesthetic, not blocking)
  const underfullBoxes = extractUnderfullBoxes(log);
  if (underfullBoxes.length > 2) {
    checks.push({
      name: 'Text Spacing',
      passed: false,
      detail: `${underfullBoxes.length} underfull hbox warning(s)`,
    });
    issues.push({
      severity: 'warning',
      category: 'formatting',
      message: `${underfullBoxes.length} underfull hbox warnings — spacing may be uneven`,
    });
  } else {
    checks.push({
      name: 'Text Spacing',
      passed: true,
      detail:
        underfullBoxes.length > 0
          ? `${underfullBoxes.length} minor underfull warnings (acceptable)`
          : 'No underfull hbox warnings',
    });
  }

  // 5. Font availability check
  const fontWarnings = extractFontWarnings(log);
  if (fontWarnings.length > 0) {
    checks.push({
      name: 'Font Availability',
      passed: false,
      detail: `${fontWarnings.length} font warning(s)`,
    });
    issues.push({
      severity: 'warning',
      category: 'font',
      message: `Font issue: ${fontWarnings[0]}`,
    });
  } else {
    checks.push({
      name: 'Font Availability',
      passed: true,
      detail: 'All fonts loaded correctly',
    });
  }

  // 6. Section completeness (based on source verification)
  const requiredSections: string[] = [];
  if (spec.summary.text) requiredSections.push('Summary');
  if (spec.experience.length > 0) requiredSections.push('Experience');
  if (spec.projects.length > 0) requiredSections.push('Projects');
  if (spec.skills.categories.length > 0) requiredSections.push('Skills');
  if (spec.education.length > 0) requiredSections.push('Education');

  const missingSections: string[] = [];
  for (const section of requiredSections) {
    if (!latexSource.includes(`\\section{${section}}`)) {
      missingSections.push(section);
    }
  }

  if (missingSections.length > 0) {
    checks.push({
      name: 'Section Completeness',
      passed: false,
      detail: `Missing sections: ${missingSections.join(', ')}`,
    });
    issues.push({
      severity: 'error',
      category: 'missing_section',
      message: `Missing required sections: ${missingSections.join(', ')}`,
    });
  } else {
    checks.push({
      name: 'Section Completeness',
      passed: true,
      detail: `All ${requiredSections.length} required sections present`,
    });
  }

  // Determine overall pass/fail
  const criticalErrors = issues.filter((i) => i.severity === 'error');
  const passes = criticalErrors.length === 0;

  return {
    passes,
    checks,
    issues,
    pageCount,
    fixAttempts,
  };
}
