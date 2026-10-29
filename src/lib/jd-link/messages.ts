import type { JdLinkErrorCode, JobDescriptionSource } from '@/types';

interface MessageContext {
  /** Reserved for call-site detail. Canonical copy must never fork by context. */
  status?: number;
}

const ERROR_MESSAGES = {
  invalid_url: "That doesn't look like a valid job link. Paste the full URL, including https://.",
  unsupported_scheme: 'Only http and https links are supported.',
  blocked:
    'The site refused the request (sign-in, bot protection, or rate limit). Open the link and paste the description manually.',
  not_found: 'This job posting could not be found. It may have been removed or expired.',
  empty_content:
    'No job description text was found on that page. It may require JavaScript or sign-in.',
  too_large: 'That page is too large to process. Paste the relevant job description manually.',
  timeout: 'Fetching the job description timed out. Try again or paste it manually.',
  aborted: 'Cancelled.',
  network: "Couldn't reach the site. Check your connection and try again.",
  reader_disabled:
    "This link couldn't be read from a supported job board, and the reader fallback is off. Turn it on to try r.jina.ai, or paste the description manually.",
  reader_failed:
    "The reader couldn't extract this page. It may be rate-limiting or unable to read the site. Try again, or paste the description manually.",
  bad_response:
    'The job board returned an unexpected response. Try again, or paste the description manually.',
} as const satisfies Record<JdLinkErrorCode, string>;

export function messageForCode(code: JdLinkErrorCode, context?: MessageContext): string {
  void context; // R3-7: context is accepted but must not change canonical copy
  return ERROR_MESSAGES[code];
}

export const SIGN_IN_WALL_WARNING =
  'This page may require sign-in. Review the text before generating.';
export const READER_WARNING_PREFIX = 'Reader reported: ';

export const SOURCE_LABELS = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  smartrecruiters: 'SmartRecruiters',
  reader: 'r.jina.ai reader',
} as const satisfies Record<JobDescriptionSource, string>;

export function truncationMarker(maxChars: number): string {
  // Plain locale-independent digits in the marker and the UI note (R3-21).
  return `\n\n[Job description truncated at ${maxChars} characters.]`;
}

export function truncatedNote(maxChars: number): string {
  return `Truncated at ${maxChars} characters.`;
}

export const UI_COPY = {
  pasteJdFirst: 'Paste a job description first',
  pasteLinkFirst: 'Paste a job link first',
  fetchLinkFirst: 'Fetch a job description from a link first',
  jdTooLong: 'Job description is too long (30000-character limit). Trim it before generating.',
  noResume: 'No master resume found. Add one first.',
  missingApiKey: 'Set your API key in Settings first',
  waitForRun: 'Wait for the current run to finish or cancel it.',
  pipelineFailed: 'Pipeline failed',
  lowConfidence:
    'Fetched, but this may not be a full job description. Review it before generating.',
  fetchedWithWarnings: 'Fetched with warnings. Review the text before generating.',
  preferenceSaveFailed: 'Could not save this preference. It applies for this session.',
  staleLinkTitle: 'Link changed — fetch again.',
  staleLinkDetail:
    'The text below is from the previously fetched link. Generate uses this text as-is.',
  startBlockedNoResume:
    'Starting is paused because no master resume is set. Your fetched text is still here. Add a master resume, then click Generate Resume.',
  startBlockedNoApiKey:
    'Starting is paused because no API key is set. Your fetched text is still here. Add a key in Settings, then click Generate Resume.',
  openSettings: 'Open Settings',
  addResume: 'Add master resume',
  opensInNewTab: 'Opens in a new tab so this description stays here.',
  dismiss: 'Dismiss',
  fetchDescription: 'Fetch description',
  cancel: 'Cancel',
  generate: 'Generate Resume',
  loadExample: 'Load example JD',
  pasteTab: 'Paste JD',
  linkTab: 'Job link',
  readerOn: 'Reader fallback on',
  readerOff: 'Reader fallback off',
  autoRunOn: 'Auto-run on',
  autoRunOff: 'Auto-run off',
  fetching: 'Fetching job description…',
  firstUseReaderNote:
    "Known job boards (Greenhouse, Lever, SmartRecruiters) are read through their public APIs directly from your browser. Other links — and job-board API requests that don't return the posting (missing, rate-limited, or failed) — are sent to r.jina.ai when the reader fallback is on. Turning the reader off stops r.jina.ai requests only.",
  readerDisclosure:
    "Reader fallback: used for links that aren't a supported job board, or when a job-board API request does not return the posting (for example, missing, rate-limited, or failed). The request goes to r.jina.ai (third-party) and contains the posting URL plus standard HTTP metadata (IP address, browser user agent). It never includes your resume, API keys, or generated text. When the fallback is off, RoleCraft makes no requests to r.jina.ai; job-board API requests still go directly to Greenhouse, Lever, or SmartRecruiters.",
  readerResultLine: 'Fetched via r.jina.ai (third-party)',
  lowConfidenceNote: 'This may not be a full job description. Review the text before generating.',
  reviewBadge: 'Review',
  truncatedBadge: 'Truncated',
  gotIt: 'Got it',
  pasteManually: 'Paste manually',
  tryAgain: 'Try again',
  turnOnReader: 'Turn on reader & retry',
  openOriginal: 'Open original',
  noDescriptionYet: 'Paste a job description or job link and click Generate Resume',
} as const;
