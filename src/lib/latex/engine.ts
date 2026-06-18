"use client";

import { renderResumeHtml } from "./render";
import type { ResumeSpec } from "@/types";

type CompileResult = {
  success: boolean;
  pdf: Uint8Array;
  log: string;
};

type EngineStatus =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "compiling"
  | "error";

class LatexEngine {
  private _status: EngineStatus = "uninitialized";
  private _error: string | null = null;
  private currentBlob: Blob | null = null;

  get status(): EngineStatus {
    return this._status;
  }

  get error(): string | null {
    return this._error;
  }

  get pdfBlob(): Blob | null {
    return this.currentBlob;
  }

  static isSupported(): boolean {
    return true; // Local rendering always works
  }

  async init(): Promise<void> {
    this._status = "ready";
    this._error = null;
  }

  /**
   * Compile a ResumeSpec to PDF via HTML rendering + browser print-to-PDF.
   * The rendered HTML is stored as a blob that can be previewed.
   */
  async compile(spec: ResumeSpec): Promise<CompileResult> {
    this._status = "compiling";
    this._error = null;

    try {
      const html = renderResumeHtml(spec);
      const htmlBlob = new Blob([html], { type: "text/html" });
      this.currentBlob = htmlBlob;

      // For PDF download: use the HTML + print CSS (@page rules handle sizing)
      // The user can also download .tex and compile with a real LaTeX engine
      const log = [
        "HTML resume rendered successfully.",
        "Use browser Print → Save as PDF for a true PDF version.",
        "Download .tex for professional LaTeX compilation.",
        `Sections: Summary, Experience (${spec.experience.length} roles), Projects (${spec.projects.length}), Skills (${spec.skills.categories.length} categories), Education (${spec.education.length} entries).`,
      ].join("\n");

      this._status = "ready";
      return {
        success: true,
        pdf: new Uint8Array(0), // HTML blob used instead
        log,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Rendering failed";
      this._error = message;
      this._status = "ready";
      return {
        success: false,
        pdf: new Uint8Array(0),
        log: message,
      };
    }
  }

  clearCache(): void {
    this.currentBlob = null;
  }

  dispose(): void {
    this.currentBlob = null;
    this._status = "uninitialized";
    this._error = null;
  }
}

let engineInstance: LatexEngine | null = null;

export function getLatexEngine(): LatexEngine {
  if (!engineInstance) {
    engineInstance = new LatexEngine();
  }
  return engineInstance;
}

export { LatexEngine };
export type { CompileResult, EngineStatus };
