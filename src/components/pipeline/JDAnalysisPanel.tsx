"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { JDAnalysis } from "@/types";

interface JDAnalysisPanelProps {
  data: JDAnalysis;
}

export function JDAnalysisPanel({ data }: JDAnalysisPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Role Title
            </p>
            <p className="text-lg font-semibold">{data.roleTitle}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Experience Level
            </p>
            <Badge className="mt-0.5 capitalize">{data.experienceLevel}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Industry Context
            </p>
            <p className="text-sm">{data.industryContext}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Required Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.requiredSkills.map((s) => (
                <Badge key={s} variant="default">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Nice to Have
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.niceToHaveSkills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Key Responsibilities
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.keyResponsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.keywords.map((k) => (
                <Badge key={k} variant="outline">
                  {k}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
