"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, Lightbulb, ChevronDown, ChevronRight, Trophy, TrendingUp } from "lucide-react";
import type { ResumeCritique, ConvergenceResult } from "@/types";

interface CritiquePanelProps {
  data: ResumeCritique;
  iteration: number;
  converged: boolean;
  history: Array<{
    iteration: number;
    resume: string;
    critique: ResumeCritique;
  }>;
  bestScore: number;
  convergenceResult: ConvergenceResult | null;
}

function convergenceReasonLabel(reason: string): string {
  switch (reason) {
    case "score_ceiling":
      return "Score & ATS ceiling reached (95+/90+)";
    case "score_delta":
      return "Score improvement stalled";
    case "no_new_weaknesses":
      return "No new weaknesses found";
    case "max_iterations":
      return "Maximum iterations reached (50)";
    case "llm_judgment":
      return "LLM judged converged";
    default:
      return reason;
  }
}

export function CritiquePanel({
  data,
  iteration,
  converged,
  history,
  bestScore,
  convergenceResult,
}: CritiquePanelProps) {
  const [expandedIterations, setExpandedIterations] = useState<Set<number>>(
    new Set()
  );

  const toggleExpanded = (iter: number) => {
    setExpandedIterations((prev) => {
      const next = new Set(prev);
      if (next.has(iter)) {
        next.delete(iter);
      } else {
        next.add(iter);
      }
      return next;
    });
  };

  const scoreColor =
    data.score >= 85
      ? "text-green-600 dark:text-green-400"
      : data.score >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col gap-4">
      {/* Current Score Card */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Overall Score
              </p>
              <div className="flex items-center gap-3">
                <Progress value={data.score} className="w-32" />
                <span
                  className={`text-2xl font-bold tabular-nums ${scoreColor}`}
                >
                  {data.score}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">
                ATS Score
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {data.atsScore}/100
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              className={
                converged
                  ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                  : "border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-400"
              }
            >
              {converged ? "Converged" : `Iterating... (${iteration})`}
            </Badge>
            {bestScore === data.score && history.length > 1 && (
              <Badge className="border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400">
                <Trophy className="mr-1 size-3" />
                Best
              </Badge>
            )}
            {convergenceResult && converged && (
              <Badge
                variant="secondary"
                className="text-xs"
              >
                {convergenceReasonLabel(convergenceResult.reason)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Trend (only show after 2+ iterations) */}
      {history.length >= 2 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Score Trend
            </p>
            <div className="flex items-center gap-2">
              {history.map((entry, i) => {
                const isBest = entry.critique.score === bestScore;
                const entryColor =
                  entry.critique.score >= 85
                    ? "text-green-600 dark:text-green-400"
                    : entry.critique.score >= 60
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400";
                return (
                  <div key={entry.iteration} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground">→</span>
                    )}
                    <span
                      className={`text-sm font-semibold tabular-nums ${entryColor} ${isBest ? "underline decoration-amber-500 decoration-2 underline-offset-2" : ""}`}
                      title={`Iteration ${entry.iteration}${isBest ? " (Best)" : ""}`}
                    >
                      {entry.critique.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ThumbsUp className="size-3.5 text-green-600" />
            Strengths
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {data.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Weaknesses */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ThumbsDown className="size-3.5 text-red-600" />
            Weaknesses
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {data.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {data.recurringWeaknesses && data.recurringWeaknesses.length > 0 && (
            <div className="mt-1 rounded-md border border-red-600/20 bg-red-600/5 px-3 py-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Recurring (not fixed in {data.recurringWeaknesses.length > 1 ? "multiple iterations" : "previous iteration"})
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                {data.recurringWeaknesses.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggestions (hidden when converged) */}
      {!converged && data.suggestions.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lightbulb className="size-3.5 text-yellow-600" />
              Suggestions for Next Iteration
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Iteration History (expandable) */}
      {history.length > 1 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Iteration History
            </p>
            <div className="flex flex-col gap-1">
              {history
                .slice()
                .reverse()
                .map((entry) => {
                  const isBest = entry.critique.score === bestScore;
                  const isExpanded = expandedIterations.has(entry.iteration);
                  const entryColor =
                    entry.critique.score >= 85
                      ? "text-green-600 dark:text-green-400"
                      : entry.critique.score >= 60
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400";
                  return (
                    <div key={entry.iteration}>
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                        onClick={() => toggleExpanded(entry.iteration)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          Iteration {entry.iteration}
                        </span>
                        <span className={`font-semibold tabular-nums ${entryColor}`}>
                          {entry.critique.score}/100
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ATS: {entry.critique.atsScore}
                        </span>
                        {isBest && (
                          <Trophy className="ml-auto size-3.5 shrink-0 text-amber-500" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="ml-7 mt-1 space-y-1.5 pb-2 text-xs">
                          <div>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              Strengths:
                            </span>
                            <ul className="ml-3 list-disc text-muted-foreground">
                              {entry.critique.strengths.slice(0, 3).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                              {entry.critique.strengths.length > 3 && (
                                <li className="text-muted-foreground/60">
                                  +{entry.critique.strengths.length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium text-red-600 dark:text-red-400">
                              Weaknesses:
                            </span>
                            <ul className="ml-3 list-disc text-muted-foreground">
                              {entry.critique.weaknesses.slice(0, 3).map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                              {entry.critique.weaknesses.length > 3 && (
                                <li className="text-muted-foreground/60">
                                  +{entry.critique.weaknesses.length - 3} more
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
