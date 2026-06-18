"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, Lightbulb } from "lucide-react";
import type { ResumeCritique } from "@/types";

interface CritiquePanelProps {
  data: ResumeCritique;
  iteration: number;
  converged: boolean;
}

export function CritiquePanel({
  data,
  iteration,
  converged,
}: CritiquePanelProps) {
  const scoreColor =
    data.score >= 85
      ? "text-green-600 dark:text-green-400"
      : data.score >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col gap-4">
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
          <div className="flex gap-2">
            <Badge
              className={
                converged
                  ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                  : "border-yellow-600/30 bg-yellow-600/10 text-yellow-700 dark:text-yellow-400"
              }
            >
              {converged ? "Converged" : `Iterating... (${iteration})`}
            </Badge>
          </div>
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>

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
    </div>
  );
}
