/** Compute Jaccard similarity between two string arrays (0-1). Case-insensitive. */
export function computeJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const aSet = new Set(a.map((s) => s.toLowerCase().trim()));
  const bSet = new Set(b.map((s) => s.toLowerCase().trim()));
  const intersection = [...aSet].filter((s) => bSet.has(s)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Compute word-level Jaccard similarity between two resume texts (0-1).
 *  Normalizes case, strips punctuation, and ignores words ≤2 chars. */
export function computeResumeTextSimilarity(a: string, b: string): number {
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
