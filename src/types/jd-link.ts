// ─── Job Link Import ────────────────────────────────────────

export type JdLinkErrorCode =
  | 'invalid_url'
  | 'unsupported_scheme'
  | 'blocked'
  | 'not_found'
  | 'empty_content'
  | 'too_large'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'reader_disabled'
  | 'reader_failed'
  | 'bad_response';

export type JobDescriptionSource = 'greenhouse' | 'lever' | 'smartrecruiters' | 'reader';

export type JobDescriptionQuality = 'ok' | 'low_confidence';
export type JdInputMode = 'paste' | 'link';
export type JobFetchStatus = 'idle' | 'fetching' | 'success' | 'error';

/** R3-3/R3-11: why auto-run paused without navigating. */
export type StartBlockedReason = 'no_resume' | 'no_api_key';

export interface JdLinkErrorInfo {
  code: JdLinkErrorCode;
  message: string; // always messageForCode(code); never authored at the call site
  status?: number;
  retryable: boolean;
}

export interface FetchedJobDescription {
  text: string;
  title: string | null;
  company: string | null;
  location: string | null;
  source: JobDescriptionSource;
  sourceUrl: string;
  fetchedAt: string; // ISO
  truncated: boolean;
  quality: JobDescriptionQuality;
  warnings: string[]; // material warnings only; truncation is `truncated`
}

export type FetchJobDescriptionResult =
  | { ok: true; data: FetchedJobDescription }
  | { ok: false; error: JdLinkErrorInfo };

export interface FetchJobDescriptionOptions {
  signal: AbortSignal;
  allowReader: boolean;
  fetchImpl?: typeof fetch;
  atsTimeoutMs?: number; // default ATS_TIMEOUT_MS
  readerTimeoutMs?: number; // default READER_TIMEOUT_MS
  maxChars?: number; // default MAX_JD_CHARS; JD text cap, not response cap
}

export type ParsedJobUrl =
  | { ok: true; url: URL; normalized: string; host: string }
  | { ok: false; code: 'invalid_url' | 'unsupported_scheme' };
