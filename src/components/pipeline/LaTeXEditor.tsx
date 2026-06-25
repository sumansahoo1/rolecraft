"use client";

import { useState, useEffect } from "react";
import {
  Download,
  FileCode,
  Printer,
  SplitSquareVertical,
  PanelLeft,
  PanelRight,
  Copy,
  Check,
} from "lucide-react";
import LaTeXPreview from "./LaTeXPreview";
import { downloadTex, copyToClipboard } from "@/lib/export";
import { renderResumeHtml } from "@/lib/latex/render";

interface LaTeXEditorProps {
  initialSource: string;
  initialHtmlBlob?: Blob | null;
  resumeSpec?: import("@/types").ResumeSpec | null;
}

export default function LaTeXEditor({
  initialSource,
  initialHtmlBlob,
  resumeSpec,
}: LaTeXEditorProps) {
  const [source, setSource] = useState(initialSource);
  const [htmlBlob, setHtmlBlob] = useState<Blob | null>(
    initialHtmlBlob ?? null
  );
  const [viewMode, setViewMode] = useState<"split" | "source" | "preview">(
    "split"
  );
  const [copied, setCopied] = useState(false);

  // Regenerate HTML when spec changes
  useEffect(() => {
    if (resumeSpec) {
      try {
        const html = renderResumeHtml(resumeSpec);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHtmlBlob(new Blob([html], { type: "text/html" }));
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
      downloadTex(source);
    }
  };

  const handlePrintPdf = () => {
    // Use the SAME HTML as the preview — guarantees identical output
    if (htmlBlob) {
      const url = URL.createObjectURL(htmlBlob);
      const w = window.open(url, "_blank");
      if (w) {
        w.onload = () => {
          // Set empty title to minimize browser header text
          try { w.document.title = ""; } catch { /* cross-origin */ }
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
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Resume Preview</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggles */}
          <div className="flex items-center border rounded bg-background mr-2">
            <button
              onClick={() => setViewMode("split")}
              className={`p-1.5 ${
                viewMode === "split"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Split view"
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("source")}
              className={`p-1.5 ${
                viewMode === "source"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="LaTeX source only"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`p-1.5 ${
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Preview only"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Print button — same HTML as preview, pixel-identical output.
               In the browser print dialog: uncheck "Headers and footers",
               set Margins to "None", and select "Save as PDF". */}
          <button
            onClick={handlePrintPdf}
            disabled={!htmlBlob}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save as PDF — uncheck 'Headers and footers', set Margins to 'None'"
          >
            <Printer className="h-3.5 w-3.5" />
            Save PDF
          </button>

          {/* Download .tex */}
          <button
            onClick={handleDownloadTex}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            .tex
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="flex-1 min-h-0 flex">
        {/* Source panel */}
        {(viewMode === "split" || viewMode === "source") && (
          <div
            className={`${
              viewMode === "split" ? "w-1/2" : "w-full"
            } border-r flex flex-col`}
          >
            <div className="px-3 py-1.5 border-b bg-muted/20 text-xs text-muted-foreground shrink-0 flex items-center justify-between">
              <span>LaTeX Source</span>
              <button
                onClick={handleCopySource}
                className="inline-flex items-center gap-1 text-xs hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              value={source}
              onChange={handleSourceChange}
              className="flex-1 w-full resize-none p-4 font-mono text-sm bg-background text-foreground focus:outline-none border-0"
              placeholder="% LaTeX source will appear here..."
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview panel */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`${
              viewMode === "split" ? "w-1/2" : "w-full"
            } flex flex-col bg-white`}
          >
            <div className="px-3 py-1.5 border-b bg-muted/20 text-xs text-muted-foreground shrink-0">
              Resume Preview
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <LaTeXPreview
                htmlBlob={htmlBlob}
                isCompiling={false}
                compilationError={null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
