import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, htmlToText } from './html';

describe('decodeHtmlEntities', () => {
  it('decodes common named entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&apos;')).toBe("'");
    expect(decodeHtmlEntities('&nbsp;')).toBe('\u00a0');
    expect(decodeHtmlEntities('&mdash;')).toBe('—');
    expect(decodeHtmlEntities('&rsquo;')).toBe('’');
    expect(decodeHtmlEntities('&hellip;')).toBe('…');
  });

  it('decodes numeric entities with case-insensitive prefixes', () => {
    expect(decodeHtmlEntities('&#39;')).toBe("'");
    expect(decodeHtmlEntities('&#x27;')).toBe("'");
    expect(decodeHtmlEntities('&#X27;')).toBe("'");
    expect(decodeHtmlEntities('&#XAF;')).toBe('¯');
  });

  it('matches named entities case-insensitively', () => {
    expect(decodeHtmlEntities('&AMP;')).toBe('&');
  });

  it('leaves unknown and invalid entities untouched', () => {
    expect(decodeHtmlEntities('&notarealentity;')).toBe('&notarealentity;');
    expect(decodeHtmlEntities('&#0;')).toBe('&#0;');
    expect(decodeHtmlEntities('&#x110000;')).toBe('&#x110000;');
    expect(decodeHtmlEntities('&#xD800;')).toBe('&#xD800;');
  });

  it('decodes in a single pass', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('htmlToText', () => {
  it('decodes a Greenhouse double-escaped body end-to-end', () => {
    const once = decodeHtmlEntities('&lt;p&gt;A &amp;amp; B&lt;/p&gt;');
    expect(once).toBe('<p>A &amp; B</p>');
    expect(htmlToText(once)).toBe('A & B');
  });

  it('drops script, style, noscript, svg, template, and iframe content', () => {
    const html = [
      '<p>Visible</p>',
      '<script>alert(1)</script>',
      '<style>.x{}</style>',
      '<noscript>no</noscript>',
      '<svg><text>svg</text></svg>',
      '<template>tpl</template>',
      '<iframe src="x">frame</iframe>',
    ].join('');
    expect(htmlToText(html)).toBe('Visible');
  });

  it('renders unordered and ordered list items without blank gaps', () => {
    expect(htmlToText('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two');
    expect(htmlToText('<ol><li>one</li><li>two</li></ol>')).toBe('- one\n- two');
  });

  it('flattens nested lists without blank gaps', () => {
    expect(htmlToText('<ul><li>one<ul><li>a</li><li>b</li></ul></li><li>two</li></ul>')).toBe(
      '- one\n- a\n- b\n- two'
    );
  });

  it('keeps paragraph-wrapped list items tight', () => {
    expect(htmlToText('<ul><li><p>one</p></li><li><p>two</p></li></ul>')).toBe('- one\n- two');
  });

  it('renders table cells and rows', () => {
    expect(htmlToText('<table><tr><td>Cell A</td><td>Cell B</td></tr></table>')).toBe(
      'Cell A | Cell B'
    );
    expect(htmlToText('<table><tr><th>H1</th><th>H2</th></tr></table>')).toBe('H1 | H2');
    expect(
      htmlToText(
        '<table><tr><td>Cell A</td><td>Cell B</td></tr><tr><th>H1</th><th>H2</th></tr></table>'
      )
    ).toBe('Cell A | Cell B\nH1 | H2');
  });

  it('preserves prose comparisons that look like tags', () => {
    expect(htmlToText('<p>Use x<y and z>5 in the filter.</p>')).toBe(
      'Use x<y and z>5 in the filter.'
    );
    expect(htmlToText('<p>Use x&lt;y and z&gt;5 in the filter.</p>')).toBe(
      'Use x<y and z>5 in the filter.'
    );
  });

  it('strips trailing unterminated known tags without leaking attributes', () => {
    expect(htmlToText('<p>Intro <a href="x"')).toBe('Intro');
    expect(htmlToText('<p>Intro <b class="x"')).toBe('Intro');
    expect(htmlToText('<p>a <b>bold')).toBe('a bold');
  });

  it('keeps unknown tags as literal text', () => {
    expect(htmlToText('<p>a <custom attr="x">b')).toBe('a <custom attr="x">b');
  });

  it('converts br and hr', () => {
    expect(htmlToText('one<br>two')).toBe('one\ntwo');
    expect(htmlToText('one<hr>two')).toBe('one\n\ntwo');
  });

  it('composes paragraphs and lists', () => {
    expect(htmlToText('<p>Intro</p><ul><li>one</li><li>two</li></ul><p>Outro</p>')).toBe(
      'Intro\n\n- one\n- two\n\nOutro'
    );
  });

  it('removes comments', () => {
    expect(htmlToText('<p>one<!-- hidden -->two</p>')).toBe('onetwo');
  });

  it('does not hang on unclosed known tags', () => {
    expect(htmlToText('<div><p>unclosed')).toBe('unclosed');
  });
});
