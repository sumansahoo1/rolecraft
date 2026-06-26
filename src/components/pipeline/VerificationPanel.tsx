'use client';

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
} from 'lucide-react';
import type { LatexVerificationResult } from '@/types';

interface VerificationPanelProps {
  verification: LatexVerificationResult | null;
  onRecompile?: () => void;
  isCompiling?: boolean;
}

const CHECK_ICONS: Record<string, React.ElementType> = {
  'Compilation Success': AlertCircle,
  'Page Count': Layout,
  'Text Overflow': Type,
  'Text Spacing': Type,
  'Font Availability': Type,
  'Section Completeness': ListChecks,
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
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-12">
        <Info className="size-8 opacity-30" />
        <p className="text-sm">No verification results yet</p>
        <p className="text-muted-foreground text-xs">
          Verification runs automatically after LaTeX compilation
        </p>
      </div>
    );
  }

  const { passes, checks, issues, pageCount, fixAttempts } = verification;
  const criticalIssues = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div className="space-y-5">
      {/* Overall Status Banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          passes
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
        }`}
      >
        {passes ? (
          <FileCheck className="size-6 shrink-0 text-green-600 dark:text-green-400" />
        ) : (
          <AlertTriangle className="size-6 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <div>
          <p
            className={`font-medium ${
              passes ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
            }`}
          >
            {passes ? 'All Checks Passed' : 'Issues Found'}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {pageCount !== null ? `${pageCount} page(s)` : 'Page count unknown'}
            {fixAttempts > 0 && ` · ${fixAttempts} fix attempt(s)`}
          </p>
        </div>

        {!passes && onRecompile && (
          <button
            onClick={onRecompile}
            disabled={isCompiling}
            className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
            {isCompiling ? 'Fixing...' : 'Auto-Fix'}
          </button>
        )}
      </div>

      {/* Page Count Display */}
      {pageCount !== null && (
        <div className="bg-muted/30 flex items-center gap-2 rounded-md px-4 py-2">
          <Layout className="text-muted-foreground size-4" />
          <span className="text-sm">
            Page Count: <strong>{pageCount}</strong>
            {pageCount > 1 && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                (target: 1 page)
              </span>
            )}
            {pageCount === 1 && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ On target</span>
            )}
          </span>
        </div>
      )}

      {/* Per-Check Results */}
      <div className="space-y-2">
        <h4 className="text-muted-foreground text-sm font-medium">Verification Checks</h4>
        {checks.map((check) => {
          const Icon = CHECK_ICONS[check.name] || Info;
          return (
            <div
              key={check.name}
              className={`flex items-start gap-3 rounded-md border p-3 ${
                check.passed
                  ? 'border-border bg-background'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
              }`}
            >
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="text-muted-foreground size-3.5" />
                  <span className="text-sm font-medium">{check.name}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{check.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">
            Issues ({criticalIssues.length} errors, {warnings.length} warnings)
          </h4>
          <div className="space-y-1.5">
            {issues.map((issue, i) => {
              const SevIcon = SEVERITY_ICONS[issue.severity] || AlertCircle;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded p-2.5 text-xs ${
                    issue.severity === 'error'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300'
                  }`}
                >
                  <SevIcon className="mt-0.5 size-3.5 shrink-0" />
                  <div>
                    <span className="font-medium capitalize">
                      {issue.category.replace(/_/g, ' ')}:
                    </span>{' '}
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
