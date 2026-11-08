const AUTH_ERROR_RE =
  /\b(?:401|403)\b|invalid[\s_-]*(?:api[\s_-]*)?key|api[\s_-]*key[\s_-]*(?:not[\s_-]*valid|invalid)|authentication|unauthorized|forbidden/i;
const RATE_LIMIT_RE = /\b429\b|rate[\s_-]?limit|too many requests/i;
const QUOTA_RE =
  /\b402\b|quota|insufficient[\s_-]*(?:credits?|funds|balance)|billing|payment required/i;
const NETWORK_RE = /failed to fetch|network|load failed|fetch failed/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function describePipelineError(error: unknown): string {
  const message = errorMessage(error);

  if (QUOTA_RE.test(message)) {
    return 'The AI provider reports insufficient credits or quota. Check your provider account.';
  }
  if (AUTH_ERROR_RE.test(message)) {
    return 'The AI provider rejected the request. Check your API key and model in Settings.';
  }
  if (RATE_LIMIT_RE.test(message)) {
    return 'The AI provider is rate-limiting requests. Wait a moment and try again.';
  }
  if (NETWORK_RE.test(message)) {
    return "Couldn't reach the AI provider. Check your connection and try again.";
  }
  return 'Pipeline failed. Check the browser console for details.';
}
