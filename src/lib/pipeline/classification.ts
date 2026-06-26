import type { CategorizedSuggestions, CritiqueCategory } from '@/types';

export const CATEGORY_PRIORITY: CritiqueCategory[] = [
  'fabrication',
  'impact',
  'ats',
  'content',
  'clarity',
];

/** Keyword-based fallback classifier for when the LLM doesn't provide categorized suggestions. */
export function categorizeSuggestions(suggestions: string[]): CategorizedSuggestions {
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
      lower.includes('fabricat') ||
      lower.includes('invent') ||
      lower.includes('not in master resume') ||
      lower.includes('made up') ||
      lower.includes('hallucinat') ||
      lower.includes('false') ||
      lower.includes('does not appear in')
    ) {
      result.fabrication.push(s);
    } else if (
      lower.includes('impact') ||
      lower.includes('outcome') ||
      lower.includes('metric') ||
      lower.includes('quantif') ||
      lower.includes('bullet') ||
      lower.includes('demonstrat') ||
      lower.includes('result')
    ) {
      result.impact.push(s);
    } else if (
      lower.includes('ats') ||
      lower.includes('applicant tracking') ||
      lower.includes('keyword') ||
      lower.includes('screen')
    ) {
      result.ats.push(s);
    } else if (
      lower.includes('clear') ||
      lower.includes('concis') ||
      lower.includes('wordy') ||
      lower.includes('verbos') ||
      lower.includes('tighten') ||
      lower.includes('redundan') ||
      lower.includes('readab')
    ) {
      result.clarity.push(s);
    } else {
      result.content.push(s);
    }
  }

  return result;
}

export function getCategoryLabel(cat: CritiqueCategory): string {
  const labels: Record<CritiqueCategory, string> = {
    fabrication: 'CRITICAL',
    impact: 'HIGH',
    ats: 'MEDIUM',
    clarity: 'LOW',
    content: 'MEDIUM',
  };
  return labels[cat];
}
