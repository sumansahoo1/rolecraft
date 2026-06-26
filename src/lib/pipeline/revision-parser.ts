import { extractJsonFromLLMResponse } from '@/lib/ai';

/** Parse the revision report marker from LLM output. Falls back gracefully. */
export function extractRevisionReport(rawText: string): {
  resume: string;
  report: {
    addressedSuggestions: string[];
    unaddressedSuggestions: string[];
    unchangedSections: string[];
  } | null;
} {
  const marker = '---REVISION REPORT---';
  const idx = rawText.indexOf(marker);
  if (idx === -1) {
    return { resume: rawText, report: null };
  }

  const resume = rawText.substring(0, idx).trim();
  const reportRaw = rawText.substring(idx + marker.length).trim();

  try {
    const report = extractJsonFromLLMResponse(reportRaw) as Record<string, unknown>;
    return {
      resume,
      report: {
        addressedSuggestions: (report.addressedSuggestions as string[]) ?? [],
        unaddressedSuggestions: (report.unaddressedSuggestions as string[]) ?? [],
        unchangedSections: (report.unchangedSections as string[]) ?? [],
      },
    };
  } catch {
    // Fall through to graceful fallback
  }

  return { resume, report: null };
}
