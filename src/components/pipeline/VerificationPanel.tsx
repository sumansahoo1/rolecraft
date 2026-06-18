"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  FileCheck,
  Layout,
  Type,
  ListChecks,
  AlertCircle,
} from "lucide-react";
import type { LatexVerificationResult } from "@/types";

interface VerificationPanelProps {
  verification: LatexVerificationResult | null;
  onRecompile?: () => void;
  isCompiling?: boolean;
}

const CHECK_ICONS: Record<string, React.ElementType> = {
  "Compilation Success": AlertCircle,
  "Page Count": Layout,
  "Text Overflow": Type,
  "Text Spacing": Type,
  "Font Availability": Type,
  "Section Completeness": ListChecks,
};

const SEVERITY_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
};

export default function VerificationPanel({
  verification,
  onRecompile,
  isCompiling,
}: VerificationPanelProps) {
  if (!verification) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <Info className="h-8 w-8 opacity-30" />
        <p className="text-sm">No verification results yet</p>
        <p className="text-xs text-muted-foreground">
          Verification runs automatically after LaTeX compilation
        </p>
      </div>
    );
  }

  const { passes, checks, issues, pageCount, fixAttempts } = verification;
  const criticalIssues = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-5">
      {/* Overall Status Banner */}
      <div
        className={`flex items-center gap-3 p-4 rounded-lg border ${
          passes
            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
            : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
        }`}
      >
        {passes ? (
          <FileCheck className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <div>
          <p
            className={`font-medium ${
              passes
                ? "text-green-800 dark:text-green-200"
                : "text-amber-800 dark:text-amber-200"
            }`}
          >
            {passes ? "All Checks Passed" : "Issues Found"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pageCount !== null ? `${pageCount} page(s)` : "Page count unknown"}
            {fixAttempts > 0 && ` · ${fixAttempts} fix attempt(s)`}
          </p>
        </div>

        {!passes && onRecompile && (
          <button
            onClick={onRecompile}
            disabled={isCompiling}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                isCompiling ? "animate-spin" : ""
              }`}
            />
            {isCompiling ? "Fixing..." : "Auto-Fix"}
          </button>
        )}
      </div>

      {/* Page Count Display */}
      {pageCount !== null && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-md">
          <Layout className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            Page Count: <strong>{pageCount}</strong>
            {pageCount > 1 && (
              <span className="text-amber-600 dark:text-amber-400 ml-2 text-xs">
                (target: 1 page)
              </span>
            )}
            {pageCount === 1 && (
              <span className="text-green-600 dark:text-green-400 ml-2 text-xs">
                ✓ On target
              </span>
            )}
          </span>
        </div>
      )}

      {/* Per-Check Results */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          Verification Checks
        </h4>
        {checks.map((check) => {
          const Icon = CHECK_ICONS[check.name] || Info;
          return (
            <div
              key={check.name}
              className={`flex items-start gap-3 p-3 rounded-md border ${
                check.passed
                  ? "bg-background border-border"
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }`}
            >
              {check.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{check.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {check.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Issues ({criticalIssues.length} errors, {warnings.length} warnings)
          </h4>
          <div className="space-y-1.5">
            {issues.map((issue, i) => {
              const SevIcon =
                SEVERITY_ICONS[issue.severity] || AlertCircle;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded text-xs ${
                    issue.severity === "error"
                      ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <SevIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium capitalize">
                      {issue.category.replace(/_/g, " ")}:
                    </span>{" "}
                    {issue.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
