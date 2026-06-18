"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Target, Eye, ScanSearch } from "lucide-react";
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
        <CardContent className="flex flex-col gap-4 pt-4">
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
          {data.niceToHaveSkills.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      {/* Core Responsibilities */}
      {data.coreResponsibilities.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-1.5">
              <Target className="size-3.5 text-blue-600" />
              <p className="text-xs font-medium text-muted-foreground">
                Core Responsibilities
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.coreResponsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Hidden Requirements */}
      {data.hiddenRequirements.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-purple-600" />
              <p className="text-xs font-medium text-muted-foreground">
                Hidden Requirements
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.hiddenRequirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ATS Keywords */}
      {data.atsKeywords.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-1.5">
              <ScanSearch className="size-3.5 text-green-600" />
              <p className="text-xs font-medium text-muted-foreground">
                ATS Keywords
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.atsKeywords.map((k) => (
                <Badge key={k} variant="outline" className="border-green-600/30">
                  {k}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

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
