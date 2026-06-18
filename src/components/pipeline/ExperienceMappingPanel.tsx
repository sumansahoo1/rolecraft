"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  FolderKanban,
  MinusCircle,
} from "lucide-react";
import type { ExperienceMapping } from "@/types";

interface ExperienceMappingPanelProps {
  data: ExperienceMapping;
}

export function ExperienceMappingPanel({ data }: ExperienceMappingPanelProps) {
  const scoreColor =
    data.relevanceScore >= 75
      ? "text-green-600 dark:text-green-400"
      : data.relevanceScore >= 50
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Relevance Score
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={data.relevanceScore} className="flex-1" />
              <span className={`text-lg font-bold tabular-nums ${scoreColor}`}>
                {data.relevanceScore}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-green-600" />
              Matched Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.matchedSkills.map((s) => (
                <Badge
                  key={s}
                  className="border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <XCircle className="size-3.5 text-red-600" />
              Missing Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.missingSkills.map((s) => (
                <Badge
                  key={s}
                  className="border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {data.experienceGap && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="size-4 shrink-0 text-yellow-600" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Experience Gap
              </p>
              <p className="text-sm">{data.experienceGap}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Experience */}
      {data.recommendedExperience.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-600" />
              <p className="text-xs font-medium text-muted-foreground">
                Featured Experience
              </p>
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-sm">
              {data.recommendedExperience.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommended Projects */}
      {data.recommendedProjects.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="size-3.5 text-blue-600" />
              <p className="text-xs font-medium text-muted-foreground">
                Featured Projects
              </p>
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-sm">
              {data.recommendedProjects.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sections to Downplay */}
      {data.sectionsToDownplay.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <div className="flex items-center gap-1.5">
              <MinusCircle className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">
                Downplayed / Removed
              </p>
            </div>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
              {data.sectionsToDownplay.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.notes.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-4">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {data.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
