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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MasterResume,
  Experience,
  Education,
  Project,
  OpenSource,
  OtherWork,
} from "@/types";

const OTHER_WORK_TYPES = [
  "publication",
  "speaking",
  "patent",
  "award",
  "volunteering",
  "language",
  "other",
] as const;

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

function emptyProject(): Project {
  return { name: "", description: "" };
}

function emptyOpenSource(): OpenSource {
  return { name: "", description: "" };
}

function emptyOtherWork(): OtherWork {
  return { title: "", type: "other", description: "" };
}

function migrateProjects(
  projects: unknown | undefined,
): Project[] | undefined {
  if (!Array.isArray(projects)) return undefined;
  if (projects.length === 0) return undefined;
  if (typeof projects[0] === "string") {
    return (projects as string[]).map((s) => ({ name: s, description: "" }));
  }
  return projects as Project[];
}

export function ResumeEditor({
  initial,
  onSave,
  onReExtract,
}: ResumeEditorProps) {
  const [resume, setResume] = useState<MasterResume>({
    ...initial,
    projects: migrateProjects(initial.projects),
  });
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

  // ─── Projects ──────────────────────────────────────────────

  const updateProject = (idx: number, proj: Project) => {
    const updated = [...(resume.projects ?? [])];
    updated[idx] = proj;
    update("projects", updated);
  };

  const addProject = () => {
    update("projects", [...(resume.projects ?? []), emptyProject()]);
  };

  const removeProject = (idx: number) => {
    update("projects", (resume.projects ?? []).filter((_, i) => i !== idx));
  };

  const updateProjectHighlight = (
    projIdx: number,
    hlIdx: number,
    value: string,
  ) => {
    const updated = [...(resume.projects ?? [])];
    const highlights = [...(updated[projIdx].highlights ?? [])];
    highlights[hlIdx] = value;
    updated[projIdx] = { ...updated[projIdx], highlights };
    update("projects", updated);
  };

  const addProjectHighlight = (projIdx: number) => {
    const updated = [...(resume.projects ?? [])];
    updated[projIdx] = {
      ...updated[projIdx],
      highlights: [...(updated[projIdx].highlights ?? []), ""],
    };
    update("projects", updated);
  };

  const removeProjectHighlight = (projIdx: number, hlIdx: number) => {
    const updated = [...(resume.projects ?? [])];
    updated[projIdx] = {
      ...updated[projIdx],
      highlights: (updated[projIdx].highlights ?? []).filter(
        (_, i) => i !== hlIdx,
      ),
    };
    update("projects", updated);
  };

  const addProjectTech = (projIdx: number, tech: string) => {
    const updated = [...(resume.projects ?? [])];
    const current = updated[projIdx].technologies ?? [];
    if (tech && !current.includes(tech)) {
      updated[projIdx] = {
        ...updated[projIdx],
        technologies: [...current, tech],
      };
      update("projects", updated);
    }
  };

  const removeProjectTech = (projIdx: number, tech: string) => {
    const updated = [...(resume.projects ?? [])];
    updated[projIdx] = {
      ...updated[projIdx],
      technologies: (updated[projIdx].technologies ?? []).filter(
        (t) => t !== tech,
      ),
    };
    update("projects", updated);
  };

  // ─── Open Source ───────────────────────────────────────────

  const updateOpenSource = (idx: number, os: OpenSource) => {
    const updated = [...(resume.openSource ?? [])];
    updated[idx] = os;
    update("openSource", updated);
  };

  const addOpenSource = () => {
    update("openSource", [...(resume.openSource ?? []), emptyOpenSource()]);
  };

  const removeOpenSource = (idx: number) => {
    update("openSource",
      (resume.openSource ?? []).filter((_, i) => i !== idx),
    );
  };

  const updateOpenSourceHighlight = (
    osIdx: number,
    hlIdx: number,
    value: string,
  ) => {
    const updated = [...(resume.openSource ?? [])];
    const highlights = [...(updated[osIdx].highlights ?? [])];
    highlights[hlIdx] = value;
    updated[osIdx] = { ...updated[osIdx], highlights };
    update("openSource", updated);
  };

  const addOpenSourceHighlight = (osIdx: number) => {
    const updated = [...(resume.openSource ?? [])];
    updated[osIdx] = {
      ...updated[osIdx],
      highlights: [...(updated[osIdx].highlights ?? []), ""],
    };
    update("openSource", updated);
  };

  const removeOpenSourceHighlight = (osIdx: number, hlIdx: number) => {
    const updated = [...(resume.openSource ?? [])];
    updated[osIdx] = {
      ...updated[osIdx],
      highlights: (updated[osIdx].highlights ?? []).filter(
        (_, i) => i !== hlIdx,
      ),
    };
    update("openSource", updated);
  };

  const addOpenSourceTech = (osIdx: number, tech: string) => {
    const updated = [...(resume.openSource ?? [])];
    const current = updated[osIdx].technologies ?? [];
    if (tech && !current.includes(tech)) {
      updated[osIdx] = {
        ...updated[osIdx],
        technologies: [...current, tech],
      };
      update("openSource", updated);
    }
  };

  const removeOpenSourceTech = (osIdx: number, tech: string) => {
    const updated = [...(resume.openSource ?? [])];
    updated[osIdx] = {
      ...updated[osIdx],
      technologies: (updated[osIdx].technologies ?? []).filter(
        (t) => t !== tech,
      ),
    };
    update("openSource", updated);
  };

  // ─── Other Works ───────────────────────────────────────────

  const updateOtherWork = (idx: number, ow: OtherWork) => {
    const updated = [...(resume.otherWorks ?? [])];
    updated[idx] = ow;
    update("otherWorks", updated);
  };

  const addOtherWork = () => {
    update("otherWorks", [...(resume.otherWorks ?? []), emptyOtherWork()]);
  };

  const removeOtherWork = (idx: number) => {
    update("otherWorks",
      (resume.otherWorks ?? []).filter((_, i) => i !== idx),
    );
  };

  const projects = resume.projects ?? [];
  const openSource = resume.openSource ?? [];
  const otherWorks = resume.otherWorks ?? [];

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

      {/* Certifications */}
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
                    .filter(Boolean),
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <Label>Projects</Label>
            <Button variant="outline" size="sm" onClick={addProject}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No projects yet. Add personal projects, hackathons, freelance work, or side projects.
            </p>
          )}
          {projects.map((proj, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Project Name</Label>
                  <Input
                    value={proj.name ?? ""}
                    onChange={(e) =>
                      updateProject(i, { ...proj, name: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={proj.url ?? ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateProject(i, {
                        ...proj,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={proj.description ?? ""}
                    onChange={(e) =>
                      updateProject(i, { ...proj, description: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    value={proj.duration ?? ""}
                    placeholder="e.g. Jan 2023 - Mar 2023"
                    onChange={(e) =>
                      updateProject(i, {
                        ...proj,
                        duration: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Technologies</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(proj.technologies ?? []).map((tech) => (
                    <Badge
                      key={tech}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {tech}
                      <button
                        onClick={() => removeProjectTech(i, tech)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <AddTagInput
                  placeholder="Add technology..."
                  onAdd={(val) => addProjectTech(i, val)}
                />
              </div>

              <Separator className="my-3" />

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Highlights</Label>
                {(proj.highlights ?? []).map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ""}
                      placeholder="Key achievement or contribution..."
                      onChange={(e) =>
                        updateProjectHighlight(i, j, e.target.value)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProjectHighlight(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addProjectHighlight(i)}
                  className="w-fit"
                >
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeProject(i)}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Open Source */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <Label>Open Source</Label>
            <Button variant="outline" size="sm" onClick={addOpenSource}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {openSource.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No open source contributions yet. Add repositories you maintain, contribute to, or significant PRs.
            </p>
          )}
          {openSource.map((os, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={os.name ?? ""}
                    onChange={(e) =>
                      updateOpenSource(i, { ...os, name: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={os.url ?? ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateOpenSource(i, {
                        ...os,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={os.role ?? ""}
                    placeholder="e.g. maintainer, contributor"
                    onChange={(e) =>
                      updateOpenSource(i, {
                        ...os,
                        role: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={os.description ?? ""}
                    onChange={(e) =>
                      updateOpenSource(i, {
                        ...os,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Technologies</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(os.technologies ?? []).map((tech) => (
                    <Badge
                      key={tech}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {tech}
                      <button
                        onClick={() => removeOpenSourceTech(i, tech)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <AddTagInput
                  placeholder="Add technology..."
                  onAdd={(val) => addOpenSourceTech(i, val)}
                />
              </div>

              <Separator className="my-3" />

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Highlights</Label>
                {(os.highlights ?? []).map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ""}
                      placeholder="Key contribution or impact..."
                      onChange={(e) =>
                        updateOpenSourceHighlight(i, j, e.target.value)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOpenSourceHighlight(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addOpenSourceHighlight(i)}
                  className="w-fit"
                >
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOpenSource(i)}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Other Works */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <Label>Other Works</Label>
            <Button variant="outline" size="sm" onClick={addOtherWork}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {otherWorks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No other works yet. Add publications, speaking engagements, patents, awards, volunteering, or languages.
            </p>
          )}
          {otherWorks.map((ow, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={ow.title ?? ""}
                    onChange={(e) =>
                      updateOtherWork(i, { ...ow, title: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={ow.type ?? "other"}
                    onValueChange={(value) =>
                      updateOtherWork(i, { ...ow, type: value ?? "other" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OTHER_WORK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={ow.url ?? ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateOtherWork(i, {
                        ...ow,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={ow.date ?? ""}
                    placeholder="e.g. 2024 or Mar 2024"
                    onChange={(e) =>
                      updateOtherWork(i, {
                        ...ow,
                        date: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={ow.description ?? ""}
                    onChange={(e) =>
                      updateOtherWork(i, {
                        ...ow,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOtherWork(i)}
                className="mt-2 text-destructive"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </div>
          ))}
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

function AddTagInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [val, setVal] = useState("");

  const handleAdd = () => {
    const trimmed = val.trim();
    if (trimmed) {
      onAdd(trimmed);
      setVal("");
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
