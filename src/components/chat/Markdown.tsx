'use client';

import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={key++} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={key++} className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs">
          <code>{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-lg font-bold'
          : level === 2
            ? 'text-base font-semibold'
            : level === 3
              ? 'text-sm font-semibold'
              : 'text-sm font-medium';
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(heading[2])}
        </p>
      );
      i++;
      continue;
    }

    // Bullet list
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*\d+[.)]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1 list-decimal space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (accumulate until blank or a block starter)
    const para: string[] = [line];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === '' || /^```/.test(l.trimStart()) || /^(#{1,4})\s/.test(l)) break;
      if (/^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) break;
      para.push(l);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1">
        {para.map((seg, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(seg)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}
