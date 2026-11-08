import { normalizeJobText } from './text';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  frac12: '½',
  laquo: '«',
  raquo: '»',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  para: '¶',
  permil: '‰',
  micro: 'µ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  pi: 'π',
  sigma: 'σ',
  omega: 'ω',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  szlig: 'ß',
};

const ENTITY_RE = /&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi;

/**
 * Single-pass entity decoding: replacements are never re-scanned, so
 * `&amp;lt;` becomes `&lt;`, not `<`.
 */
export function decodeHtmlEntities(input: string): string {
  return input.replace(ENTITY_RE, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const body = entity.slice(1);
      const isHex = body.startsWith('x') || body.startsWith('X');
      const digits = isHex ? body.slice(1) : body;
      const value = Number.parseInt(digits, isHex ? 16 : 10);
      if (!Number.isFinite(value) || value <= 0 || value > 0x10ffff) return match;
      if (value >= 0xd800 && value <= 0xdfff) return match;
      return String.fromCodePoint(value);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const REMOVED_ELEMENT_RE =
  /<(script|style|noscript|template|svg|iframe|object|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BR_RE = /<br\b[^>]*>/gi;
const HR_RE = /<hr\b[^>]*>/gi;
const LI_OPEN_RE = /<li\b[^>]*>/gi;
const LI_CLOSE_RE = /<\/li\s*>/gi;
const CELL_CLOSE_RE = /<\/(?:td|th)\s*>/gi;
const ROW_CLOSE_RE = /<\/tr\s*>/gi;
const BLOCK_CLOSE_TAGS =
  'p|div|ul|ol|h[1-6]|section|article|blockquote|pre|table|thead|tbody|tfoot|header|footer|aside|main|nav|dl|dt|dd';
const BLOCK_CLOSE_RE = new RegExp(`</(?:${BLOCK_CLOSE_TAGS})\\s*>`, 'gi');

const KNOWN_TAGS =
  'a|abbr|address|b|bdi|bdo|blockquote|br|caption|cite|code|col|colgroup|dd|del|details|dfn|div|dl|dt|em|figcaption|figure|h[1-6]|hr|i|img|ins|kbd|li|main|mark|nav|ol|p|pre|q|s|samp|section|small|span|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|time|tr|u|ul|var|wbr|article|aside|header|footer|picture|source';
const KNOWN_TAG_RE = new RegExp(`</?(?:${KNOWN_TAGS})\\b[^>]*>`, 'gi');
const TRAILING_KNOWN_TAG_RE = new RegExp(`</?(?:${KNOWN_TAGS})\\b[^>]*$`, 'i');

const TRAILING_CELL_SEPARATOR_RE = /[ \t]*\|[ \t]*(?=\n|$)/g;
const BULLET_GAP_RE = /(^|\n)(- [^\n]*)\n\n(?=- )/g;

function collapseBulletGaps(input: string): string {
  let text = input;
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(BULLET_GAP_RE, '$1$2\n');
  }
  return text;
}

/**
 * Conservative HTML→text extractor. Produces plain text only; unknown/custom
 * tags remain literal, and it is never used with `dangerouslySetInnerHTML`.
 */
export function htmlToText(html: string): string {
  let text = html.replace(COMMENT_RE, '');
  text = text.replace(REMOVED_ELEMENT_RE, '');

  text = text.replace(BR_RE, '\n');
  text = text.replace(HR_RE, '\n\n');

  text = text.replace(LI_OPEN_RE, '\n- ');
  text = text.replace(LI_CLOSE_RE, '');

  text = text.replace(CELL_CLOSE_RE, ' | ');
  text = text.replace(ROW_CLOSE_RE, '\n');

  text = text.replace(BLOCK_CLOSE_RE, '\n\n');

  text = text.replace(KNOWN_TAG_RE, '');
  text = text.replace(TRAILING_KNOWN_TAG_RE, '');

  text = decodeHtmlEntities(text);
  text = text.replace(TRAILING_CELL_SEPARATOR_RE, '');
  text = normalizeJobText(text);
  return collapseBulletGaps(text);
}
