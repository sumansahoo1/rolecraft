"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Copy, Check, Download, ChevronDown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  parseResumeSections,
  copyToClipboard,
  downloadTxt,
  downloadDocx,
  downloadPdf,
} from "@/lib/export";
import LaTeXEditor from "./LaTeXEditor";

interface ResumeDisplayProps {
  resume: string;
  iteration: number;
  bestScore?: number;
  totalIterations?: number;
  // LaTeX mode props
  showLatex?: boolean;
  latexSource?: string | null;
  latexHtmlBlob?: Blob | null;
  resumeSpec?: import("@/types").ResumeSpec | null;
}

export function ResumeDisplay({
  resume,
  iteration,
  bestScore,
  totalIterations,
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [resume]);

  const handleExport = useCallback(
    async (type: "txt" | "docx" | "pdf") => {
      setExporting(type);
      setDropdownOpen(false);
      try {
        if (type === "txt") {
          downloadTxt(resume);
        } else if (type === "docx") {
          await downloadDocx(resume);
        } else {
          await downloadPdf(resume);
        }
      } finally {
        setExporting(null);
      }
    },
    [resume]
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
          <p className="text-xs text-muted-foreground">
            {iteration > 0 ? `Iteration ${iteration}` : "Generated Resume"}
          </p>
          {bestScore !== undefined && totalIterations && totalIterations > 1 && (
            <Badge className="border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400 text-xs">
              <Trophy className="mr-1 size-3" />
              Best ({bestScore}/100)
            </Badge>
          )}
          {bestScore !== undefined && totalIterations && totalIterations > 1 && iteration > 0 && (
            <span className="text-xs text-muted-foreground">
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
            {copied ? "Copied" : "Copy"}
          </Button>

          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <Download className="mr-1.5 size-3.5" />
              Download
              <ChevronDown className="ml-1 size-3 opacity-50" />
            </Button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border bg-popover p-1 shadow-md">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  onClick={() => handleExport("txt")}
                  disabled={exporting !== null}
                >
                  {exporting === "txt" ? "Saving..." : "Download .txt"}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  onClick={() => handleExport("docx")}
                  disabled={exporting !== null}
                >
                  {exporting === "docx" ? "Saving..." : "Download .docx"}
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  onClick={() => handleExport("pdf")}
                  disabled={exporting !== null}
                >
                  {exporting === "pdf" ? "Saving..." : "Download .pdf"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume content with styled sections */}
      <div className="rounded-lg border bg-white dark:bg-card p-6 max-h-[500px] overflow-auto">
        <div className="max-w-[700px] mx-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="mb-4 last:mb-0">
              {section.heading && (
                <h3 className="mb-2 text-[13px] font-semibold tracking-wider uppercase text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">
                  {section.heading}
                </h3>
              )}
              {section.content.map((line, lIdx) => (
                <p
                  key={lIdx}
                  className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 mb-1 last:mb-0"
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
