'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useListField, createNestedStringHelpers, createTagHelpers } from '@/hooks/useListField';
import type { MasterResume, Experience, Education, Project, OpenSource, OtherWork } from '@/types';

const OTHER_WORK_TYPES = [
  'publication',
  'speaking',
  'patent',
  'award',
  'volunteering',
  'language',
  'other',
] as const;

interface ResumeEditorProps {
  initial: MasterResume;
  onSave: (resume: MasterResume) => void;
  onReExtract: () => void;
}

function emptyExperience(): Experience {
  return { company: '', role: '', duration: '', highlights: [''] };
}

function emptyEducation(): Education {
  return { institution: '', degree: '', field: '', year: '' };
}

function emptyProject(): Project {
  return { name: '', description: '' };
}

function emptyOpenSource(): OpenSource {
  return { name: '', description: '' };
}

function emptyOtherWork(): OtherWork {
  return { title: '', type: 'other', description: '' };
}

function migrateProjects(projects: unknown | undefined): Project[] | undefined {
  if (!Array.isArray(projects)) return undefined;
  if (projects.length === 0) return undefined;
  if (typeof projects[0] === 'string') {
    return (projects as string[]).map((s) => ({ name: s, description: '' }));
  }
  return projects as Project[];
}

export function ResumeEditor({ initial, onSave, onReExtract }: ResumeEditorProps) {
  const [resume, setResume] = useState<MasterResume>({
    ...initial,
    projects: migrateProjects(initial.projects),
  });
  const [skillInput, setSkillInput] = useState('');

  const update = (field: keyof MasterResume, value: unknown) => {
    setResume((prev) => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !resume.skills.includes(skill)) {
      update('skills', [...resume.skills, skill]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    update(
      'skills',
      resume.skills.filter((s) => s !== skill)
    );
  };

  // ─── Generic list field CRUD ───

  const exp = useListField(resume, 'experience', update, emptyExperience, true);
  const edu = useListField(resume, 'education', update, emptyEducation, true);
  const proj = useListField(resume, 'projects', update, emptyProject, false);
  const oss = useListField(resume, 'openSource', update, emptyOpenSource, false);
  const other = useListField(resume, 'otherWorks', update, emptyOtherWork, false);

  const expHL = createNestedStringHelpers(
    () => resume.experience,
    'highlights',
    'experience',
    update
  );
  const projHL = createNestedStringHelpers(
    () => resume.projects ?? [],
    'highlights',
    'projects',
    update
  );
  const ossHL = createNestedStringHelpers(
    () => resume.openSource ?? [],
    'highlights',
    'openSource',
    update
  );

  const projTags = createTagHelpers(() => resume.projects ?? [], 'projects', update);
  const ossTags = createTagHelpers(() => resume.openSource ?? [], 'openSource', update);

  return (
    <div className="flex flex-col gap-6">
      {/* Basic Info */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={resume.name ?? ''} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={resume.email ?? ''}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone</Label>
            <Input
              value={resume.phone ?? ''}
              onChange={(e) => update('phone', e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>LinkedIn</Label>
            <Input
              value={resume.linkedin ?? ''}
              onChange={(e) => update('linkedin', e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Portfolio</Label>
            <Input
              value={resume.portfolio ?? ''}
              onChange={(e) => update('portfolio', e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Summary</Label>
            <Textarea
              className="min-h-[80px] resize-y"
              value={resume.summary ?? ''}
              onChange={(e) => update('summary', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4">
          <Label>Skills</Label>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, i) => (
              <Badge key={`${skill}-${i}`} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
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
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
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
            <Button variant="outline" size="sm" onClick={exp.addItem}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {exp.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={item.company ?? ''}
                    onChange={(e) => exp.updateItem(i, { ...item, company: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={item.role ?? ''}
                    onChange={(e) => exp.updateItem(i, { ...item, role: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    value={item.duration ?? ''}
                    onChange={(e) => exp.updateItem(i, { ...item, duration: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {item.highlights.map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ''}
                      placeholder="Achievement or responsibility..."
                      onChange={(e) => expHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => expHL.removeAt(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="text-muted-foreground size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => expHL.addAt(i)} className="w-fit">
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exp.removeItem(i)}
                className="text-destructive mt-2"
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
            <Button variant="outline" size="sm" onClick={edu.addItem}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {edu.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Institution</Label>
                  <Input
                    value={item.institution ?? ''}
                    onChange={(e) => edu.updateItem(i, { ...item, institution: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Degree</Label>
                  <Input
                    value={item.degree ?? ''}
                    onChange={(e) => edu.updateItem(i, { ...item, degree: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Field</Label>
                  <Input
                    value={item.field ?? ''}
                    onChange={(e) => edu.updateItem(i, { ...item, field: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Year</Label>
                  <Input
                    value={item.year ?? ''}
                    onChange={(e) => edu.updateItem(i, { ...item, year: e.target.value })}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => edu.removeItem(i)}
                className="text-destructive mt-2"
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
              value={resume.certifications?.join('\n') ?? ''}
              onChange={(e) =>
                update(
                  'certifications',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
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
            <Button variant="outline" size="sm" onClick={proj.addItem}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {proj.items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No projects yet. Add personal projects, hackathons, freelance work, or side projects.
            </p>
          )}
          {proj.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Project Name</Label>
                  <Input
                    value={item.name ?? ''}
                    onChange={(e) => proj.updateItem(i, { ...item, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={item.url ?? ''}
                    placeholder="https://..."
                    onChange={(e) =>
                      proj.updateItem(i, {
                        ...item,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) => proj.updateItem(i, { ...item, description: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    value={item.duration ?? ''}
                    placeholder="e.g. Jan 2023 - Mar 2023"
                    onChange={(e) =>
                      proj.updateItem(i, {
                        ...item,
                        duration: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Technologies</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(item.technologies ?? []).map((tech, tIdx) => (
                    <Badge key={`${tech}-${tIdx}`} variant="secondary" className="gap-1 pr-1">
                      {tech}
                      <button
                        onClick={() => projTags.remove(i, tech)}
                        className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <AddTagInput
                  placeholder="Add technology..."
                  onAdd={(val) => projTags.add(i, val)}
                />
              </div>

              <Separator className="my-3" />

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Highlights</Label>
                {(item.highlights ?? []).map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ''}
                      placeholder="Key achievement or contribution..."
                      onChange={(e) => projHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => projHL.removeAt(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="text-muted-foreground size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => projHL.addAt(i)} className="w-fit">
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => proj.removeItem(i)}
                className="text-destructive mt-2"
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
            <Button variant="outline" size="sm" onClick={oss.addItem}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {oss.items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No open source contributions yet. Add repositories you maintain, contribute to, or
              significant PRs.
            </p>
          )}
          {oss.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={item.name ?? ''}
                    onChange={(e) => oss.updateItem(i, { ...item, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={item.url ?? ''}
                    placeholder="https://..."
                    onChange={(e) =>
                      oss.updateItem(i, {
                        ...item,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={item.role ?? ''}
                    placeholder="e.g. maintainer, contributor"
                    onChange={(e) =>
                      oss.updateItem(i, {
                        ...item,
                        role: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) =>
                      oss.updateItem(i, {
                        ...item,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Technologies</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(item.technologies ?? []).map((tech, tIdx) => (
                    <Badge key={`${tech}-${tIdx}`} variant="secondary" className="gap-1 pr-1">
                      {tech}
                      <button
                        onClick={() => ossTags.remove(i, tech)}
                        className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <AddTagInput placeholder="Add technology..." onAdd={(val) => ossTags.add(i, val)} />
              </div>

              <Separator className="my-3" />

              <div className="flex flex-col gap-2">
                <Label className="text-xs">Highlights</Label>
                {(item.highlights ?? []).map((hl, j) => (
                  <div key={j} className="flex gap-2">
                    <Input
                      value={hl ?? ''}
                      placeholder="Key contribution or impact..."
                      onChange={(e) => ossHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => ossHL.removeAt(i, j)}
                      className="shrink-0"
                    >
                      <Trash2 className="text-muted-foreground size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => ossHL.addAt(i)} className="w-fit">
                  <Plus className="mr-1 size-3.5" /> Add highlight
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => oss.removeItem(i)}
                className="text-destructive mt-2"
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
            <Button variant="outline" size="sm" onClick={other.addItem}>
              <Plus className="mr-1 size-3.5" /> Add
            </Button>
          </div>
          {other.items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No other works yet. Add publications, speaking engagements, patents, awards,
              volunteering, or languages.
            </p>
          )}
          {other.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={item.title ?? ''}
                    onChange={(e) => other.updateItem(i, { ...item, title: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={item.type ?? 'other'}
                    onValueChange={(value) =>
                      other.updateItem(i, { ...item, type: value ?? 'other' })
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
                    value={item.url ?? ''}
                    placeholder="https://..."
                    onChange={(e) =>
                      other.updateItem(i, {
                        ...item,
                        url: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={item.date ?? ''}
                    placeholder="e.g. 2024 or Mar 2024"
                    onChange={(e) =>
                      other.updateItem(i, {
                        ...item,
                        date: e.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[50px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) =>
                      other.updateItem(i, {
                        ...item,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => other.removeItem(i)}
                className="text-destructive mt-2"
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
  const [val, setVal] = useState('');

  const handleAdd = () => {
    const trimmed = val.trim();
    if (trimmed) {
      onAdd(trimmed);
      setVal('');
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
