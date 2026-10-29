import type { FetchedJobDescription, JdLinkErrorCode } from '@/types';
import { MAX_READER_RESPONSE_CHARS, MIN_JD_CHARS, READER_BASE_URL } from './constants';
import { JdLinkError } from './errors';
import { htmlToText } from './html';
import { fetchText } from './http';
import { READER_WARNING_PREFIX, messageForCode } from './messages';
import {
  buildJobDescription,
  looksLikeAuthWall,
  normalizeJobText,
  stripMarkdownNoise,
} from './text';

interface ParsedReaderResponse {
  title: string | null;
  warnings: string[];
  text: string;
}

interface ReaderTargetError {
  code: JdLinkErrorCode;
  status: number | null;
  message: string;
  retryable: boolean;
  warning: string;
}

const MARKER_RE = /^[ \t]*Markdown Content:[ \t]*$/m;
const HEADER_LINE_RE = /^(Title|URL Source|Published Time|Warning):[ \t]*(.*)$/i;
const TARGET_ERROR_RE = /Target URL returned error (\d{3})\s*:?\s*(.*)$/i;

function buildReaderUrl(target: URL): string {
  const copy = new URL(target.href);
  copy.hash = '';
  // Raw append (not encodeURIComponent): URL.href is already percent-encoded.
  return `${READER_BASE_URL}${copy.href}`;
}

function parseReaderResponse(input: string): ParsedReaderResponse {
  const text = input.replace(/\r\n?/g, '\n');
  const marker = MARKER_RE.exec(text);

  let header: string;
  let body: string;

  if (marker) {
    header = text.slice(0, marker.index);
    body = text.slice(marker.index + marker[0].length).replace(/^\n+/, '');
  } else {
    // Format drift: strip leading metadata lines and blank lines instead.
    const lines = text.split('\n');
    const headerLines: string[] = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === '' || HEADER_LINE_RE.test(line)) {
        headerLines.push(line);
        index += 1;
        continue;
      }
      break;
    }
    header = headerLines.join('\n');
    body = lines.slice(index).join('\n');
  }

  let title: string | null = null;
  const warnings: string[] = [];
  for (const line of header.split('\n')) {
    const match = HEADER_LINE_RE.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'title') title = value || null;
    else if (key === 'warning') warnings.push(value);
  }

  return { title, warnings, text: body.trim() };
}

function mapTargetStatus(status: number, warning: string): ReaderTargetError {
  if (status === 404 || status === 410) {
    return {
      code: 'not_found',
      status,
      message: messageForCode('not_found'),
      retryable: false,
      warning,
    };
  }
  if (status === 401 || status === 451) {
    return {
      code: 'blocked',
      status,
      message: messageForCode('blocked'),
      retryable: false,
      warning,
    };
  }
  if (status === 403 || status === 429) {
    return {
      code: 'blocked',
      status,
      message: messageForCode('blocked'),
      retryable: true,
      warning,
    };
  }
  if (status === 408 || status === 504) {
    return {
      code: 'timeout',
      status,
      message: messageForCode('timeout'),
      retryable: true,
      warning,
    };
  }
  return {
    code: 'reader_failed',
    status,
    message: messageForCode('reader_failed'),
    retryable: false,
    warning,
  };
}

function parseReaderWarnings(warnings: string[]): ReaderTargetError | null {
  for (const warning of warnings) {
    const match = TARGET_ERROR_RE.exec(warning);
    // Benign warnings (cached snapshot, not yet loaded) never short-circuit.
    if (!match) continue;
    return mapTargetStatus(Number(match[1]), warning);
  }
  return null;
}

export async function fetchViaReader(
  target: URL,
  options: {
    signal: AbortSignal;
    fetchImpl?: typeof fetch;
    timeoutMs: number;
    maxChars: number;
  }
): Promise<FetchedJobDescription> {
  const response = await fetchText(buildReaderUrl(target), {
    signal: options.signal,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    maxChars: MAX_READER_RESPONSE_CHARS,
    accept: 'text/plain',
  });

  const { status } = response;
  if (status === 403 || status === 429) {
    throw new JdLinkError('reader_failed', { status, retryable: true });
  }
  if (!response.ok) {
    throw new JdLinkError('reader_failed', { status, retryable: status >= 500 });
  }

  const baseType = response.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
  if (baseType !== 'text/plain' && baseType !== 'text/markdown' && baseType !== 'text/html') {
    throw new JdLinkError('reader_failed', { status });
  }

  const raw = baseType === 'text/html' ? htmlToText(response.text) : response.text;
  const parsed = parseReaderResponse(raw);
  const targetError = parseReaderWarnings(parsed.warnings);
  const body = normalizeJobText(stripMarkdownNoise(parsed.text));

  const data = buildJobDescription({
    title: parsed.title,
    company: null,
    location: null,
    body,
    source: 'reader',
    sourceUrl: target.href,
    maxChars: options.maxChars,
  });

  const wall = looksLikeAuthWall(body);
  const usable = body.length >= MIN_JD_CHARS && data.quality === 'ok';

  if (targetError && !usable && !wall) {
    throw new JdLinkError(targetError.code, {
      status: targetError.status ?? undefined,
      retryable: targetError.retryable,
    });
  }

  // B3: only a short non-wall body with no target error is empty_content.
  if (targetError === null && body.length < MIN_JD_CHARS && !wall) {
    throw new JdLinkError('empty_content', { status });
  }

  if (targetError && (usable || wall)) {
    return {
      ...data,
      warnings: [...data.warnings, `${READER_WARNING_PREFIX}${targetError.warning}`],
    };
  }

  return data;
}
