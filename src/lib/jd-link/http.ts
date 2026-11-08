import { abortError, isJdLinkError, networkError, timeoutError, tooLargeError } from './errors';

interface TextResponse {
  status: number;
  ok: boolean;
  text: string;
  contentType: string | null;
}

interface FetchTextOptions {
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  maxChars: number;
  accept: string;
}

/**
 * Abortable, timed, streaming-size-capped text fetch. HTTP status is returned,
 * not thrown; callers map statuses to canonical errors.
 */
export async function fetchText(url: string, options: FetchTextOptions): Promise<TextResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (options.signal.aborted) throw abortError();

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort(options.signal.reason);
  options.signal.addEventListener('abort', onOuterAbort, { once: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: options.accept },
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      cache: 'no-store',
      mode: 'cors',
    });

    const contentType = response.headers.get('content-type');
    let text = '';

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          if (text.length > options.maxChars) {
            await reader.cancel().catch(() => {});
            throw tooLargeError();
          }
        }
        text += decoder.decode();
        if (text.length > options.maxChars) {
          await reader.cancel().catch(() => {});
          throw tooLargeError();
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      text = await response.text();
      if (text.length > options.maxChars) throw tooLargeError();
    }

    return { status: response.status, ok: response.ok, text, contentType };
  } catch (err) {
    if (options.signal.aborted) throw abortError();
    if (timedOut) throw timeoutError();
    if (err instanceof Error && err.name === 'AbortError') throw timeoutError();
    if (isJdLinkError(err)) throw err;
    throw networkError();
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', onOuterAbort);
  }
}
