'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Check, Download, ChevronDown, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  parseResumeSections,
  copyToClipboard,
  downloadTxt,
  downloadDocx,
  downloadPdf,
  buildResumeFilename,
} from '@/lib/export';
import LaTeXEditor from './LaTeXEditor';

interface ResumeDisplayProps {
  resume: string;
  iteration: number;
  bestScore?: number;
  totalIterations?: number;
  // For dynamic download filenames
  roleTitle?: string | null;
  companyName?: string | null;
  // LaTeX mode props
  showLatex?: boolean;
  latexSource?: string | null;
  latexHtmlBlob?: Blob | null;
  resumeSpec?: import('@/types').ResumeSpec | null;
}

export function ResumeDisplay({
  resume,
  iteration,
  bestScore,
  totalIterations,
  roleTitle,
  companyName,
  showLatex,
  latexSource,
  latexHtmlBlob,
  resumeSpec,
}: ResumeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sections = parseResumeSections(resume);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [resume]);

  const handleExport = useCallback(
    async (type: 'txt' | 'docx' | 'pdf') => {
      setExporting(type);
      setDropdownOpen(false);
      const name = resumeSpec?.meta?.name ?? undefined;
      const role = roleTitle ?? resumeSpec?.meta?.targetRole ?? undefined;
      const filename = buildResumeFilename(type, { name, company: companyName, role });
      try {
        if (type === 'txt') {
          downloadTxt(resume, filename);
        } else if (type === 'docx') {
          await downloadDocx(resume, filename);
        } else {
          await downloadPdf(resume, filename);
        }
      } finally {
        setExporting(null);
      }
    },
    [resume, resumeSpec, roleTitle, companyName]
  );

  // LaTeX Mode: show editor instead of plain text
  if (showLatex && latexSource) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-[650px]">
          <LaTeXEditor
            initialSource={latexSource}
            initialHtmlBlob={latexHtmlBlob}
            resumeSpec={resumeSpec}
            roleTitle={roleTitle}
            companyName={companyName}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">
            {iteration > 0 ? `Iteration ${iteration}` : 'Generated Resume'}
          </p>
          {bestScore !== undefined && totalIterations && totalIterations > 1 && (
            <Badge className="border-amber-600/30 bg-amber-600/10 text-xs text-amber-700 dark:text-amber-400">
              <Trophy className="mr-1 size-3" />
              Best ({bestScore}/100)
            </Badge>
          )}
          {bestScore !== undefined && totalIterations && totalIterations > 1 && iteration > 0 && (
            <span className="text-muted-foreground text-xs">
              Iteration {iteration} of {totalIterations}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1.5 size-3.5 text-green-600" />
            ) : (
              <Copy className="mr-1.5 size-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>

          <div className="relative" ref={dropdownRef}>
            <Button variant="outline" size="sm" onClick={() => setDropdownOpen((o) => !o)}>
              <Download className="mr-1.5 size-3.5" />
              Download
              <ChevronDown className="ml-1 size-3 opacity-50" />
            </Button>
            {dropdownOpen && (
              <div className="bg-popover absolute top-full right-0 z-50 mt-1 w-36 rounded-md border p-1 shadow-md">
                <button
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => handleExport('txt')}
                  disabled={exporting !== null}
                >
                  {exporting === 'txt' ? 'Saving...' : 'Download .txt'}
                </button>
                <button
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => handleExport('docx')}
                  disabled={exporting !== null}
                >
                  {exporting === 'docx' ? 'Saving...' : 'Download .docx'}
                </button>
                <button
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting !== null}
                >
                  {exporting === 'pdf' ? 'Saving...' : 'Download .pdf'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume content with styled sections */}
      <div className="dark:bg-card max-h-[500px] overflow-auto rounded-lg border bg-white p-6">
        <div className="mx-auto max-w-[700px]">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="mb-4 last:mb-0">
              {section.heading && (
                <h3 className="mb-2 border-b border-slate-200 pb-1 text-[13px] font-semibold tracking-wider text-slate-700 uppercase dark:border-slate-700 dark:text-slate-200">
                  {section.heading}
                </h3>
              )}
              {section.content.map((line, lIdx) => (
                <p
                  key={lIdx}
                  className="mb-1 text-[13px] leading-relaxed text-slate-600 last:mb-0 dark:text-slate-300"
                >
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
