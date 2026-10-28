import type { FetchedJobDescription } from '@/types';
import { MAX_ATS_RESPONSE_CHARS } from './constants';
import { JdLinkError } from './errors';
import { decodeHtmlEntities, htmlToText } from './html';
import { fetchText } from './http';
import { buildJobDescription, normalizeJobText } from './text';

interface AtsMatch {
  ats: 'greenhouse' | 'lever' | 'smartrecruiters';
  company: string;
  jobId: string;
  apiUrl: string;
}

interface ParsedAtsJob {
  title: string;
  company: string | null;
  location: string | null;
  body: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// ─── Detection ──────────────────────────────────────────────

const GREENHOUSE_BOARD_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const GREENHOUSE_JOB_ID_RE = /^\d{3,20}$/;
const LEVER_COMPANY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const LEVER_JOB_ID_RE = /^[a-z0-9][a-z0-9-]{5,63}$/i;
const SMARTRECRUITERS_COMPANY_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SMARTRECRUITERS_JOB_ID_RE = /^(\d{3,25})(?:-|$)/;

function greenhouseMatch(board: string | null, jobId: string | null): AtsMatch | null {
  if (!board || !jobId) return null;
  if (!GREENHOUSE_BOARD_RE.test(board) || !GREENHOUSE_JOB_ID_RE.test(jobId)) return null;
  const normalizedBoard = board.toLowerCase();
  return {
    ats: 'greenhouse',
    company: normalizedBoard,
    jobId,
    apiUrl: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(normalizedBoard)}/jobs/${jobId}?questions=false`,
  };
}

function detectGreenhouse(url: URL, segments: string[]): AtsMatch | null {
  if (segments.length === 3 && segments[1] === 'jobs') {
    return greenhouseMatch(segments[0], segments[2]);
  }
  if (segments.length === 4 && segments[1] === 'jobs' && segments[3] === 'apply') {
    return greenhouseMatch(segments[0], segments[2]);
  }
  if (segments.length === 2 && segments[0] === 'embed' && segments[1] === 'job_app') {
    return greenhouseMatch(url.searchParams.get('for'), url.searchParams.get('token'));
  }
  if (segments.length === 1) {
    return greenhouseMatch(segments[0], url.searchParams.get('gh_jid'));
  }
  return null;
}

function detectLever(host: string, segments: string[]): AtsMatch | null {
  let company: string | null = null;
  let jobId: string | null = null;

  if (segments.length === 2) {
    company = segments[0];
    jobId = segments[1];
  } else if (segments.length === 3 && segments[2] === 'apply') {
    company = segments[0];
    jobId = segments[1];
  }

  if (!company || !jobId) return null;
  if (!LEVER_COMPANY_RE.test(company) || !LEVER_JOB_ID_RE.test(jobId)) return null;

  const apiHost = host === 'jobs.eu.lever.co' ? 'api.eu.lever.co' : 'api.lever.co';
  const normalizedCompany = company.toLowerCase();
  return {
    ats: 'lever',
    company: normalizedCompany,
    jobId,
    apiUrl: `https://${apiHost}/v0/postings/${normalizedCompany}/${jobId}?mode=json`,
  };
}

function detectSmartRecruiters(segments: string[]): AtsMatch | null {
  if (segments.length !== 2) return null;
  const [company, idSegment] = segments;
  if (!SMARTRECRUITERS_COMPANY_RE.test(company)) return null;
  const jobIdMatch = SMARTRECRUITERS_JOB_ID_RE.exec(idSegment);
  if (!jobIdMatch) return null;
  return {
    ats: 'smartrecruiters',
    company,
    jobId: jobIdMatch[1],
    apiUrl: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${jobIdMatch[1]}`,
  };
}

export function detectAtsJob(url: URL): AtsMatch | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  let segments: string[];
  try {
    segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }

  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
    return detectGreenhouse(url, segments);
  }
  if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') {
    return detectLever(host, segments);
  }
  if (host === 'jobs.smartrecruiters.com') {
    return detectSmartRecruiters(segments);
  }
  return null;
}

// ─── Parsing ────────────────────────────────────────────────

function parseGreenhouse(data: unknown): ParsedAtsJob | null {
  const root = asRecord(data);
  if (!root) return null;

  const title = nonEmpty(asString(root.title));
  const content = asString(root.content);
  if (!title || !content || !content.trim()) return null;

  const body = htmlToText(decodeHtmlEntities(content));
  if (!body) return null;

  const location = asRecord(root.location);
  return {
    title,
    company: nonEmpty(asString(root.company_name)),
    location: location ? nonEmpty(asString(location.name)) : null,
    body,
  };
}

function parseLever(data: unknown): ParsedAtsJob | null {
  const root = asRecord(data);
  if (!root) return null;

  const title = nonEmpty(asString(root.text));
  if (!title) return null;

  const parts: string[] = [];

  const descriptionPlain =
    nonEmpty(asString(root.descriptionPlain)) ?? nonEmpty(asString(root.descriptionBodyPlain));
  if (descriptionPlain) {
    parts.push(descriptionPlain);
  } else {
    const description = asString(root.description);
    if (description) parts.push(htmlToText(description));
  }

  for (const item of asArray(root.lists)) {
    const list = asRecord(item);
    if (!list) continue;
    const heading = nonEmpty(asString(list.text));
    const content = asString(list.content);
    const contentText = content ? htmlToText(content) : '';
    if (heading && contentText) parts.push(`${heading}\n${contentText}`);
    else if (heading) parts.push(heading);
    else if (contentText) parts.push(contentText);
  }

  const additionalPlain = nonEmpty(asString(root.additionalPlain));
  if (additionalPlain) {
    parts.push(additionalPlain);
  } else {
    const additional = asString(root.additional);
    if (additional) parts.push(htmlToText(additional));
  }

  const body = normalizeJobText(parts.join('\n\n'));
  if (!body) return null;

  const categories = asRecord(root.categories);
  return {
    title,
    // R3-17: the URL slug is not a company name.
    company: null,
    location: categories ? nonEmpty(asString(categories.location)) : null,
    body,
  };
}

const SMARTRECRUITERS_SECTIONS: Array<[string, string]> = [
  ['jobDescription', 'Job Description'],
  ['qualifications', 'Qualifications'],
  ['additionalInformation', 'Additional Information'],
  ['companyDescription', 'Company Description'],
];

function parseSmartRecruiters(data: unknown): ParsedAtsJob | null {
  const root = asRecord(data);
  if (!root) return null;

  const title = nonEmpty(asString(root.name));
  if (!title) return null;

  const jobAd = asRecord(root.jobAd);
  const sections = jobAd ? asRecord(jobAd.sections) : null;
  if (!sections) return null;

  const parts: string[] = [];
  for (const [key, fallbackLabel] of SMARTRECRUITERS_SECTIONS) {
    const section = asRecord(sections[key]);
    if (!section) continue;
    const text = asString(section.text);
    if (!text || !text.trim()) continue;
    const heading = nonEmpty(asString(section.title)) ?? fallbackLabel;
    parts.push(`${heading}\n${htmlToText(text)}`);
  }

  const body = normalizeJobText(parts.join('\n\n'));
  if (!body) return null;

  const company = asRecord(root.company);
  const location = asRecord(root.location);

  let locationText = location ? nonEmpty(asString(location.fullLocation)) : null;
  if (!locationText && location) {
    const pieces = [asString(location.city), asString(location.region), asString(location.country)]
      .map((piece) => nonEmpty(piece))
      .filter((piece): piece is string => piece !== null);
    locationText = nonEmpty(pieces.join(', '));
  }

  const remote = root.remote === true || location?.remote === true;
  if (remote) {
    locationText = locationText ? `Remote · ${locationText}` : 'Remote';
  }

  return {
    title,
    company: company ? nonEmpty(asString(company.name)) : null,
    location: locationText,
    body,
  };
}

function parseAtsJob(match: AtsMatch, data: unknown): ParsedAtsJob | null {
  switch (match.ats) {
    case 'greenhouse':
      return parseGreenhouse(data);
    case 'lever':
      return parseLever(data);
    case 'smartrecruiters':
      return parseSmartRecruiters(data);
    default:
      return null;
  }
}

// ─── Fetch ──────────────────────────────────────────────────

function badResponse(status: number): JdLinkError {
  return new JdLinkError('bad_response', { status, retryable: status >= 500 });
}

export async function fetchAtsJob(
  match: AtsMatch,
  options: {
    sourceUrl: string;
    signal: AbortSignal;
    fetchImpl?: typeof fetch;
    timeoutMs: number;
    maxChars: number;
  }
): Promise<FetchedJobDescription> {
  const response = await fetchText(match.apiUrl, {
    signal: options.signal,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    maxChars: MAX_ATS_RESPONSE_CHARS,
    accept: 'application/json',
  });

  const { status } = response;
  if (status === 404 || status === 410) throw new JdLinkError('not_found', { status });
  if (status === 401 || status === 403 || status === 451) {
    throw new JdLinkError('blocked', { status });
  }
  if (status === 429) throw new JdLinkError('blocked', { status, retryable: true });
  if (status === 408 || status === 504) throw new JdLinkError('timeout', { status });
  if (!response.ok) throw badResponse(status);

  const baseType = response.contentType?.split(';')[0]?.trim().toLowerCase() ?? null;
  if (baseType !== null && baseType !== 'application/json' && !baseType.endsWith('+json')) {
    throw badResponse(status);
  }

  let data: unknown;
  try {
    data = JSON.parse(response.text) as unknown;
  } catch {
    throw badResponse(status);
  }

  const parsed = parseAtsJob(match, data);
  if (!parsed) throw new JdLinkError('empty_content', { status });

  return buildJobDescription({
    title: parsed.title,
    company: parsed.company,
    location: parsed.location,
    body: parsed.body,
    source: match.ats,
    sourceUrl: options.sourceUrl,
    maxChars: options.maxChars,
  });
}
