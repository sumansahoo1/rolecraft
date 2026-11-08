import type { FetchedJobDescription, JobDescriptionQuality, JobDescriptionSource } from '@/types';
import { MAX_JD_CHARS, MIN_JD_CHARS } from './constants';
import { SIGN_IN_WALL_WARNING, truncationMarker } from './messages';

interface BuildJobDescriptionInput {
  title: string | null;
  company: string | null;
  location: string | null;
  body: string;
  source: JobDescriptionSource;
  sourceUrl: string;
  maxChars?: number; // default MAX_JD_CHARS
  warnings?: string[];
}

const LISTING_TITLE_PATTERNS = [
  /jobs? in /i,
  /open roles/i,
  /search results/i,
  /job search/i,
  /sign in/i,
  /log in/i,
];

const STRONG_SIGNAL_PATTERNS = [
  /\bresponsibilit(?:y|ies)\b/i,
  /\brequirements?\b/i,
  /\bqualifications?\b/i,
  /\bwhat you(?:'|’)ll do\b/i,
  /\bwho you are\b/i,
  /\babout (?:the )?(?:role|team|position)\b/i,
  /\b(?:salary|compensation|pay range|base pay)\b/i,
  /\bbenefits?\b/i,
];

const AUTH_WALL_PATTERNS = [
  /\bsign in to (?:view|see|continue)\b/i,
  /\blog in to (?:view|see|continue)\b/i,
  /\bjoin now to (?:view|see)\b/i,
  /\bauthwall\b/i,
  /\bverify you are human\b/i,
  /\benable javascript and cookies\b/i,
  /\baccess denied\b/i,
  /\byou (?:must|need to) sign in\b/i,
];

export function normalizeJobText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripMarkdownNoise(input: string): string {
  return input.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

export function looksLikeAuthWall(input: string): boolean {
  const head = input.slice(0, 2000);
  return AUTH_WALL_PATTERNS.some((pattern) => pattern.test(head));
}

function assessJobText(text: string, title: string | null): JobDescriptionQuality {
  if (text.length < MIN_JD_CHARS) return 'low_confidence';
  if (title && LISTING_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return 'low_confidence';
  }
  // A wall is decisive for auto-run, even when strong signals are present.
  if (looksLikeAuthWall(text)) return 'low_confidence';
  const signals = STRONG_SIGNAL_PATTERNS.filter((pattern) => pattern.test(text)).length;
  return signals >= 2 ? 'ok' : 'low_confidence';
}

function composeJobText(header: Array<string | null>, body: string): string {
  const lines = header.filter((value): value is string => Boolean(value));
  if (lines.length === 0) return body;
  return `${lines.join('\n')}\n\n${body}`;
}

function capJobText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };

  const marker = truncationMarker(maxChars);
  const budget = Math.max(0, maxChars - marker.length);
  let clipped = text.slice(0, budget);
  const boundary = clipped.lastIndexOf('\n\n');
  if (boundary >= 0 && boundary >= budget * 0.6) {
    clipped = clipped.slice(0, boundary);
  }
  return { text: `${clipped.trimEnd()}${marker}`, truncated: true };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function buildJobDescription(input: BuildJobDescriptionInput): FetchedJobDescription {
  const maxChars = input.maxChars ?? MAX_JD_CHARS;
  const body = normalizeJobText(input.body);
  const wall = looksLikeAuthWall(body);
  // Body only: the company header is never assessed (R3-23).
  const quality = assessJobText(body, input.title);

  const composed = composeJobText([input.title, input.company, input.location], body);
  const capped = capJobText(composed, maxChars);

  const warnings = dedupe([...(input.warnings ?? []), ...(wall ? [SIGN_IN_WALL_WARNING] : [])]);

  return {
    text: capped.text,
    title: input.title,
    company: input.company,
    location: input.location,
    source: input.source,
    sourceUrl: input.sourceUrl,
    fetchedAt: new Date().toISOString(),
    truncated: capped.truncated,
    quality,
    warnings,
  };
}
