/**
 * Extract JSON from an LLM response string.
 *
 * Handles:
 * - Code fences (```json ... ``` or ``` ... ```)
 * - Leading/trailing explanatory text
 * - Nested JSON objects via greedy {…} fallback
 * - Array responses via greedy […] fallback
 */
export function extractJsonFromLLMResponse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('extractJsonFromLLMResponse: received empty string');
  }

  // Strip ```json / ``` fences
  const cleaned = trimmed
    .replace(/```(?:json)?\s*\n?/gi, '')
    .replace(/```\s*$/gm, '')
    .trim();

  // Attempt direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }

  // Greedy object match — finds outermost {…}
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // fall through
    }
  }

  // Array fallback
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      // fall through
    }
  }

  throw new Error(
    `extractJsonFromLLMResponse: unable to parse JSON. ` +
      `Raw length: ${raw.length}. ` +
      `First 200 chars: ${raw.slice(0, 200)}. ` +
      `Last 200 chars: ${raw.slice(-200)}`
  );
}
