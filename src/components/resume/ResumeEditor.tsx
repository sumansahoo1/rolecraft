"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { MasterResume, Experience, Education } from "@/types";

interface ResumeEditorProps {
  initial: MasterResume;
  onSave: (resume: MasterResume) => void;
  onReExtract: () => void;
}

function emptyExperience(): Experience {
  return { company: "", role: "", duration: "", highlights: [""] };
}

function emptyEducation(): Education {
  return { institution: "", degree: "", field: "", year: "" };
}

export function ResumeEditor({
  initial,
  onSave,
  onReExtract,
}: ResumeEditorProps) {
  const [resume, setResume] = useState<MasterResume>(initial);
  const [skillInput, setSkillInput] = useState("");

  const update = (field: keyof MasterResume, value: unknown) => {
    setResume((prev) => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !resume.skills.includes(skill)) {
      update("skills", [...resume.skills, skill]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    update("skills", resume.skills.filter((s) => s !== skill));
  };

  const updateExperience = (idx: number, exp: Experience) => {
    const updated = [...resume.experience];
    updated[idx] = exp;
    update("experience", updated);
  };

  const addExperience = () => {
    update("experience", [...resume.experience, emptyExperience()]);
  };

  const removeExperience = (idx: number) => {
    update("experience", resume.experience.filter((_, i) => i !== idx));
  };

  const updateHighlight = (expIdx: number, hlIdx: number, value: string) => {
    const updated = [...resume.experience];
    const highlights = [...updated[expIdx].highlights];
    highlights[hlIdx] = value;
    updated[expIdx] = { ...updated[expIdx], highlights };
    update("experience", updated);
  };

  const addHighlight = (expIdx: number) => {
    const updated = [...resume.experience];
    updated[expIdx] = {
      ...updated[expIdx],
      highlights: [...updated[expIdx].highlights, ""],
    };
    update("experience", updated);
  };

  const removeHighlight = (expIdx: number, hlIdx: number) => {
    const updated = [...resume.experience];
    updated[expIdx] = {
      ...updated[expIdx],
      highlights: updated[expIdx].highlights.filter((_, i) => i !== hlIdx),
    };
    update("experience", updated);
  };

  const updateEducation = (idx: number, edu: Education) => {
    const updated = [...resume.education];
    updated[idx] = edu;
    update("education", updated);
  };

  const addEducation = () => {
    update("education", [...resume.education, emptyEducation()]);
  };

  const removeEducation = (idx: number) => {
    update("education", resume.education.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Basic Info */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input
              value={resume.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={resume.email ?? ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone</Label>
            <Input
              value={resume.phone ?? ""}
              onChange={(e) => update("phone", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>LinkedIn</Label>
            <Input
              value={resume.linkedin ?? ""}
              onChange={(e) => update("linkedin", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Portfolio</Label>
            <Input
              value={resume.portfolio ?? ""}
              onChange={(e) => update("portfolio", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Summary</Label>
            <Textarea
              className="min-h-[80px] resize-y"
              value={resume.summary ?? ""}
              onChange={(e) => update("summary", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Label>Skills</Label>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a skill..."
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
            />
            <Button variant="outline" size="sm" onClick={addSkill}>
              <Plus className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <Label>Experience</Label>
            <Button variant="outline" size="sm" onClick={addExperience}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {resume.experience.map((exp, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={exp.company ?? ""}
                    onChange={(e) =>
                      updateExperience(i, { ...exp, company: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={exp.role ?? ""}
                    onChange={(e) =>
                      updateExperience(i, { ...exp, role: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    value={exp.duration ?? ""}
                    onChange={(e) =>
                      updateExperience(i, { ...exp, duration: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {exp.highlights.map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ""}
                      placeholder="Achievement or responsibility..."
                      onChange={(e) => updateHighlight(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHighlight(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addHighlight(i)}
                  className="w-fit"
                >
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeExperience(i)}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <Label>Education</Label>
            <Button variant="outline" size="sm" onClick={addEducation}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {resume.education.map((edu, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Institution</Label>
                  <Input
                    value={edu.institution ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { ...edu, institution: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Degree</Label>
                  <Input
                    value={edu.degree ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { ...edu, degree: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Field</Label>
                  <Input
                    value={edu.field ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { ...edu, field: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Year</Label>
                  <Input
                    value={edu.year ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { ...edu, year: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEducation(i)}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certifications & Projects */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label>Certifications (one per line)</Label>
            <Textarea
              className="min-h-[60px] resize-y"
              value={resume.certifications?.join("\n") ?? ""}
              onChange={(e) =>
                update(
                  "certifications",
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label>Projects (one per line)</Label>
            <Textarea
              className="min-h-[60px] resize-y"
              value={resume.projects?.join("\n") ?? ""}
              onChange={(e) =>
                update(
                  "projects",
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => onSave(resume)} className="flex-1">
          <Save className="mr-2 size-4" />
          Save Resume
        </Button>
        <Button variant="outline" onClick={onReExtract}>
          <Undo2 className="mr-2 size-4" />
          Re-extract
        </Button>
      </div>
    </div>
  );
}
