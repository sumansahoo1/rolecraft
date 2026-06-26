'use client';

import { useState, useEffect } from 'react';
import {
  Download,
  FileCode,
  Printer,
  SplitSquareVertical,
  PanelLeft,
  PanelRight,
  Copy,
  Check,
} from 'lucide-react';
import LaTeXPreview from './LaTeXPreview';
import { downloadTex, copyToClipboard, buildResumeFilename } from '@/lib/export';
import { renderResumeHtml } from '@/lib/latex/render';

interface LaTeXEditorProps {
  initialSource: string;
  initialHtmlBlob?: Blob | null;
  resumeSpec?: import('@/types').ResumeSpec | null;
  roleTitle?: string | null;
  companyName?: string | null;
}

export default function LaTeXEditor({
  initialSource,
  initialHtmlBlob,
  resumeSpec,
  roleTitle,
  companyName,
}: LaTeXEditorProps) {
  const [source, setSource] = useState(initialSource);
  const [htmlBlob, setHtmlBlob] = useState<Blob | null>(initialHtmlBlob ?? null);
  const [viewMode, setViewMode] = useState<'split' | 'source' | 'preview'>('split');
  const [copied, setCopied] = useState(false);

  // Regenerate HTML when spec changes
  useEffect(() => {
    if (resumeSpec) {
      try {
        const html = renderResumeHtml(resumeSpec);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHtmlBlob(new Blob([html], { type: 'text/html' }));
      } catch {
        // spec may be invalid; keep old blob
      }
    }
  }, [resumeSpec]);

  // Update source when initialSource changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(initialSource);
  }, [initialSource]);

  // Update html blob when initial blob comes from pipeline
  useEffect(() => {
    if (initialHtmlBlob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHtmlBlob(initialHtmlBlob);
    }
  }, [initialHtmlBlob]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSource(e.target.value);
  };

  const handleDownloadTex = () => {
    if (source) {
      const name = resumeSpec?.meta?.name ?? undefined;
      const role = roleTitle ?? resumeSpec?.meta?.targetRole ?? undefined;
      const filename = buildResumeFilename('tex', { name, company: companyName, role });
      downloadTex(source, filename);
    }
  };

  const handlePrintPdf = () => {
    // Use the SAME HTML as the preview — guarantees identical output
    if (htmlBlob) {
      const url = URL.createObjectURL(htmlBlob);
      const w = window.open(url, '_blank');
      if (w) {
        w.onload = () => {
          // Build filename: {name}_{company}_{role}_{DDMMYYYY}_Resume
          const name = resumeSpec?.meta?.name ?? undefined;
          const role = roleTitle ?? resumeSpec?.meta?.targetRole ?? undefined;
          const title = buildResumeFilename('pdf', { name, company: companyName, role }).replace(
            /\.pdf$/,
            ''
          ); // strip extension for document.title
          try {
            w.document.title = title;
          } catch {
            /* cross-origin */
          }
          w.print();
        };
        // Clean up after print dialog closes (typical: 2 min max)
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      }
    }
  };

  const handleCopySource = async () => {
    await copyToClipboard(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden rounded-lg border">
      {/* Toolbar */}
      <div className="bg-muted/30 flex shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <FileCode className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Resume Preview</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggles */}
          <div className="bg-background mr-2 flex items-center rounded border">
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 ${
                viewMode === 'split'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Split view"
            >
              <SplitSquareVertical className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`p-1.5 ${
                viewMode === 'source'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="LaTeX source only"
            >
              <PanelLeft className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`p-1.5 ${
                viewMode === 'preview'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Preview only"
            >
              <PanelRight className="size-3.5" />
            </button>
          </div>

          {/* Print button — same HTML as preview, pixel-identical output.
               In the browser print dialog: uncheck "Headers and footers",
               set Margins to "None", and select "Save as PDF". */}
          <button
            onClick={handlePrintPdf}
            disabled={!htmlBlob}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            title="Save as PDF — uncheck 'Headers and footers', set Margins to 'None'"
          >
            <Printer className="size-3.5" />
            Save PDF
          </button>

          {/* Download .tex */}
          <button
            onClick={handleDownloadTex}
            className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
          >
            <Download className="size-3.5" />
            .tex
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex min-h-0 flex-1">
        {/* Source panel */}
        {(viewMode === 'split' || viewMode === 'source') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col border-r`}>
            <div className="bg-muted/20 text-muted-foreground flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-xs">
              <span>LaTeX Source</span>
              <button
                onClick={handleCopySource}
                className="hover:text-foreground inline-flex items-center gap-1 text-xs"
              >
                {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              value={source}
              onChange={handleSourceChange}
              className="bg-background text-foreground w-full flex-1 resize-none border-0 p-4 font-mono text-sm focus:outline-none"
              placeholder="% LaTeX source will appear here..."
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview panel */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col bg-white`}>
            <div className="bg-muted/20 text-muted-foreground shrink-0 border-b px-3 py-1.5 text-xs">
              Resume Preview
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <LaTeXPreview htmlBlob={htmlBlob} isCompiling={false} compilationError={null} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
