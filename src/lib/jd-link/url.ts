import type { ParsedJobUrl } from '@/types';
import { MAX_URL_LENGTH } from './constants';

const MARKDOWN_LINK_RE = /^\[[^\]]*\]\(([^)]+)\)$/;
const WRAPPING_LEAD_RE = /^[<"'“”‘’([{]+/;
const TRAILING_QUOTE_RE = /[>"'”’]+$/;
const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;
const EMBEDDED_CREDENTIALS_RE = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?[^/?#\s]*@/;
const HOST_PORT_RE = /^[^/?#\s]+:\d+(?:[/?#]|$)/;
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Strip chat/markdown punctuation around a URL. Documented limitation: a
 * markdown target containing `)` is not treated as a markdown link.
 */
function stripUrlPunctuation(input: string): string {
  let url = input.trim();

  const markdownLink = MARKDOWN_LINK_RE.exec(url);
  if (markdownLink) url = markdownLink[1];

  url = url.replace(WRAPPING_LEAD_RE, '');
  url = url.replace(TRAILING_QUOTE_RE, '');
  // Keep a bare scheme's colon (`mailto:`, `tel:`) so it classifies as an
  // unsupported scheme rather than a dotless invalid host.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:$/.test(url)) {
    url = url.replace(TRAILING_PUNCTUATION_RE, '');
  }

  // Strip only unbalanced trailing closers so `.../job_(remote)` survives.
  const pairs: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];
  for (;;) {
    const last = url.slice(-1);
    const pair = pairs.find(([, closer]) => closer === last);
    if (!pair) break;
    const [opener, closer] = pair;
    const openers = url.split(opener).length - 1;
    const closers = url.split(closer).length - 1;
    if (closers <= openers) break;
    url = url.slice(0, -1);
  }

  if (/\s/.test(url)) {
    url = url.trim().split(/\s+/)[0] ?? '';
  }

  return url;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number.parseInt(part, 10));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function leadingHextet(host: string): number | null {
  const match = /^([0-9a-f]{1,4})(?::|$)/.exec(host);
  if (!match) return null;
  return Number.parseInt(match[1], 16);
}

function isPrivateIpv6(host: string): boolean {
  if (host === '::' || host === '::1') return true;

  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    const dotted = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
    return isPrivateIpv4(dotted);
  }

  const mappedDotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  if (mappedDotted) return isPrivateIpv4(mappedDotted[1]);

  const first = leadingHextet(host);
  if (first === null) return false;
  // fc00::/7 (unique local) and fe80::/10 (link local).
  if (first >= 0xfc00 && first <= 0xfdff) return true;
  if (first >= 0xfe80 && first <= 0xfebf) return true;
  return false;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  let host = hostname.toLowerCase();
  const hadBrackets = host.startsWith('[') && host.endsWith(']');
  if (hadBrackets) host = host.slice(1, -1);
  host = host.replace(/\.$/, '');

  if (!host) return true;
  const isIpv6Literal = hadBrackets || host.includes(':');

  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (!isIpv6Literal && !host.includes('.')) return true;
  const suffixes = ['.corp', '.lan', '.home', '.intranet', '.local', '.internal', '.home.arpa'];
  if (suffixes.some((suffix) => host.endsWith(suffix))) return true;
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return true;

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return isPrivateIpv4(host);
  if (isIpv6Literal) return isPrivateIpv6(host);

  return false;
}

export function parseJobUrl(input: string): ParsedJobUrl {
  let raw = stripUrlPunctuation(input);
  if (!raw) return { ok: false, code: 'invalid_url' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, code: 'invalid_url' };

  // Protocol-relative → absolute so the credential check sees a normal URL.
  if (raw.startsWith('//')) raw = `https:${raw}`;

  // B12: embedded credentials are rejected before any scheme inference.
  if (EMBEDDED_CREDENTIALS_RE.test(raw)) return { ok: false, code: 'invalid_url' };

  let href = raw;

  if (href.includes('://')) {
    const colon = href.indexOf('://');
    const scheme = href.slice(0, colon).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, code: 'unsupported_scheme' };
    }
  } else if (HOST_PORT_RE.test(href)) {
    // host:port comes before scheme detection so `localhost:3000/job` is a host.
    href = `https://${href}`;
  } else if (SCHEME_RE.test(href)) {
    const colon = href.indexOf(':');
    const scheme = href.slice(0, colon).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, code: 'unsupported_scheme' };
    }
    href = `${href.slice(0, colon + 1)}//${href.slice(colon + 1)}`;
  } else {
    const hostPart = href.split('/')[0] ?? '';
    if (!hostPart.includes('.')) return { ok: false, code: 'invalid_url' };
    href = `https://${href}`;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, code: 'invalid_url' };
  }
  if (!url.hostname) return { ok: false, code: 'invalid_url' };
  if (isPrivateOrLocalHost(url.hostname)) return { ok: false, code: 'invalid_url' };

  url.hash = '';
  return { ok: true, url, normalized: url.href, host: url.hostname.toLowerCase() };
}

export function isStaleFetchedLink(input: string, sourceUrl: string | null): boolean {
  if (sourceUrl === null) return false;
  const parsed = parseJobUrl(input);
  return !parsed.ok || parsed.normalized !== sourceUrl;
}
