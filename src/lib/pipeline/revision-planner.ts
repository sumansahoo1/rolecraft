import type { ResumeCritique, RevisionPlan } from '@/types';
import { categorizeSuggestions, getCategoryLabel, CATEGORY_PRIORITY } from './classification';
import { TOP_SUGGESTIONS_COUNT } from './constants';

/** Build a prioritized revision plan from a critique result. */
export function buildRevisionPlan(
  critique: ResumeCritique,
  previousPlan?: RevisionPlan
): RevisionPlan {
  const cats = critique.categorizedSuggestions ?? categorizeSuggestions(critique.suggestions);

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
      (critique.previousWeaknessesAddressed ?? []).map((w) => w.toLowerCase().trim())
    );
    for (const s of previousPlan.topSuggestions) {
      const stripped = s
        .replace(/^\[.*?\]\s*/, '')
        .toLowerCase()
        .trim();
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
