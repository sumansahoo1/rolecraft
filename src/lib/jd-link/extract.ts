import type { FetchJobDescriptionOptions, FetchJobDescriptionResult } from '@/types';
import { ATS_TIMEOUT_MS, MAX_JD_CHARS, READER_TIMEOUT_MS } from './constants';
import { detectAtsJob, fetchAtsJob } from './ats';
import { JdLinkError, abortError, isAbortError, isJdLinkError, toJdLinkErrorInfo } from './errors';
import { parseJobUrl } from './url';
import { fetchViaReader } from './reader';

/**
 * Resolve a job description from a URL. Never throws: URL validation, ATS
 * failures, reader failures, and aborts all return a canonical error info.
 */
export async function fetchJobDescription(
  input: string,
  options: FetchJobDescriptionOptions
): Promise<FetchJobDescriptionResult> {
  const parsed = parseJobUrl(input);
  if (!parsed.ok) {
    return { ok: false, error: toJdLinkErrorInfo(new JdLinkError(parsed.code)) };
  }

  const { url } = parsed;
  const maxChars = options.maxChars ?? MAX_JD_CHARS;
  const deps = { signal: options.signal, fetchImpl: options.fetchImpl };
  let upstream: JdLinkError | null = null;

  try {
    if (options.signal.aborted) throw abortError();

    const match = detectAtsJob(url);
    if (match) {
      try {
        const data = await fetchAtsJob(match, {
          sourceUrl: url.href,
          ...deps,
          timeoutMs: options.atsTimeoutMs ?? ATS_TIMEOUT_MS,
          maxChars,
        });
        return { ok: true, data };
      } catch (err) {
        if (isAbortError(err)) throw err;
        upstream = isJdLinkError(err) ? err : null;
        // R3-9: an ATS 404/410 is not authoritative here. Fall through to the reader.
      }
    }

    if (!options.allowReader) {
      // R3-9: with the reader off, only an upstream 404/410 is surfaced as not_found.
      if (upstream?.code === 'not_found') throw upstream;
      throw new JdLinkError('reader_disabled');
    }

    const data = await fetchViaReader(url, {
      ...deps,
      timeoutMs: options.readerTimeoutMs ?? READER_TIMEOUT_MS,
      maxChars,
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: toJdLinkErrorInfo(err) };
  }
}
