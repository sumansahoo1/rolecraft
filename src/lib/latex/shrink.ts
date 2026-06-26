import type { ResumeSpec } from "@/types";
import { renderResumeHtml } from "./render";
import { measureHtmlPageFit } from "./measure";
import type { PageFitResult } from "./measure";

export interface ShrinkResult {
  spec: ResumeSpec;
  fit: PageFitResult;
  level: number;
}

type ShrinkFn = (spec: ResumeSpec) => ResumeSpec;

/**
 * Returns a CSS scale factor <style> tag to inject before </head>.
 * Applies a uniform font-size scale to all body text while keeping
 * structure sizes (headings, name) slightly larger.
 */
function injectFontScale(html: string, scale: number): string {
  // Scale body font-size and all section-specific sizes
  return html.replace(
    "</style>",
    `:root { --scale: ${scale}; }
    body { font-size: calc(var(--scale) * 8.5pt) !important; }
    .exp-bullets li, .proj-bullets li, .opt-bullets li { font-size: calc(var(--scale) * 8.5pt) !important; line-height: ${1.08 + scale * 0.1} !important; }
    .section-heading { font-size: calc(var(--scale) * 9pt) !important; }
    .exp-role, .proj-name { font-size: calc(var(--scale) * 8.5pt) !important; }
</style>`
  );
}

const SHRINK_LEVELS: ShrinkFn[] = [
  // Level 1: Slight font reduction (95%)
  (spec) => spec,

  // Level 2: Reduce font to 90%
  (spec) => spec,

  // Level 3: Reduce to 85% + remove optional sections
  (spec) => ({
    ...spec,
    optionalSections: [],
  }),

  // Level 4: Cap experience bullets at 3, projects at 2
  (spec) => ({
    ...spec,
    optionalSections: [],
    experience: spec.experience.map((e) => ({
      ...e,
      bullets: e.bullets.slice(0, 3),
    })),
    projects: spec.projects.map((p) => ({
      ...p,
      bullets: p.bullets.slice(0, 2),
    })),
  }),

  // Level 5: Cap bullets at 2, merge all skills into one line
  (spec) => {
    const allSkills = spec.skills.categories.flatMap((c) => c.items);
    return {
      ...spec,
      optionalSections: [],
      experience: spec.experience.map((e) => ({
        ...e,
        bullets: e.bullets.slice(0, 2),
      })),
      projects: spec.projects.map((p) => ({
        ...p,
        bullets: p.bullets.slice(0, 1),
      })),
      skills: {
        categories: [{ name: "Skills", items: allSkills }],
      },
    };
  },
];

/** Font scaling factors per shrink level. Each maps to the same-index entry in SHRINK_LEVELS. */
const FONT_SCALES: readonly [number, number, number, number, number] = [0.95, 0.90, 0.85, 0.82, 0.78];

/**
 * Progressively shrink a ResumeSpec until its rendered HTML fits on 1 letter page.
 * Returns the spec at the first shrink level that fits, or the most-shrunk version.
 */
export async function shrinkSpecToFit(spec: ResumeSpec): Promise<ShrinkResult> {
  for (let level = 0; level < SHRINK_LEVELS.length; level++) {
    const shrunkSpec = SHRINK_LEVELS[level](spec);
    let html = renderResumeHtml(shrunkSpec);

    // Apply font scaling for this level
    if (FONT_SCALES[level] < 1) {
      html = injectFontScale(html, FONT_SCALES[level]);
    }

    try {
      const fit = await measureHtmlPageFit(html);
      if (fit.fits) {
        return { spec: shrunkSpec, fit, level };
      }
    } catch {
      // measurement failed; try next level
    }
  }

  // Nothing fits — return last level with measurement
  const lastSpec = SHRINK_LEVELS[SHRINK_LEVELS.length - 1](spec);
  let html = renderResumeHtml(lastSpec);
  html = injectFontScale(html, FONT_SCALES[FONT_SCALES.length - 1]);
  let fit: PageFitResult;
  try {
    fit = await measureHtmlPageFit(html);
  } catch {
    fit = {
      fits: false,
      scrollHeight: 0,
      pageHeight: 970,
      overflowPx: 0,
      estPages: 1,
    };
  }

  return { spec: lastSpec, fit, level: SHRINK_LEVELS.length - 1 };
}
