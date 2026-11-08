'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  value: MasterResume;
  onChange: (resume: MasterResume) => void;
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

interface SkillGroup {
  name: string;
  items: string[];
}

function toSkillGroups(skills: MasterResume['skills']): SkillGroup[] {
  if (Array.isArray(skills)) {
    return skills.length > 0 ? [{ name: 'Skills', items: skills }] : [];
  }
  return Object.entries(skills ?? {}).map(([name, items]) => ({ name, items }));
}

function nextAvailableName(prefix: string, used: Iterable<string>): string {
  const taken = new Set(used);
  let index = taken.size + 1;
  while (taken.has(`${prefix} ${index}`)) index++;
  return `${prefix} ${index}`;
}

function fromSkillGroups(groups: SkillGroup[]): MasterResume['skills'] {
  const merged: Record<string, string[]> = {};
  for (const group of groups) {
    const name = group.name.trim().length === 0 ? 'Skills' : group.name;
    const items = group.items.map((item) => item.trim()).filter((item) => item.length > 0);
    merged[name] = [...new Set([...(merged[name] ?? []), ...items])];
  }
  return merged;
}

export function ResumeEditor({ value, onChange }: ResumeEditorProps) {
  const resume: MasterResume = {
    ...value,
    projects: migrateProjects(value.projects),
  };

  const update = (field: keyof MasterResume, nextValue: unknown) => {
    onChange({ ...resume, [field]: nextValue });
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
        <CardHeader>
          <CardTitle>Contact &amp; summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
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
            <Input value={resume.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>LinkedIn</Label>
            <Input
              value={resume.linkedin ?? ''}
              onChange={(e) => update('linkedin', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>GitHub</Label>
            <Input value={resume.github ?? ''} onChange={(e) => update('github', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Twitter / X</Label>
            <Input
              value={resume.twitter ?? ''}
              onChange={(e) => update('twitter', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Portfolio</Label>
            <Input
              value={resume.portfolio ?? ''}
              onChange={(e) => update('portfolio', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Summary</Label>
            <Textarea
              className="min-h-[90px] resize-y"
              value={resume.summary ?? ''}
              placeholder="2–3 sentence professional summary..."
              onChange={(e) => update('summary', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SkillsEditor
            groups={toSkillGroups(resume.skills)}
            onChange={(groups) => update('skills', fromSkillGroups(groups))}
          />
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Experience</CardTitle>
          <Button variant="outline" size="sm" onClick={exp.addItem}>
            <Plus className="mr-1 size-3.5" /> Add role
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          {exp.items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No experience entries yet. Add a role to start building your history.
            </p>
          )}
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
                    placeholder="e.g. Jan 2022 - Present"
                    value={item.duration ?? ''}
                    onChange={(e) => exp.updateItem(i, { ...item, duration: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Highlights</Label>
                {item.highlights.map((hl, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <Textarea
                      className="min-h-[52px] resize-y"
                      value={hl ?? ''}
                      placeholder="Achievement or responsibility..."
                      onChange={(e) => expHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => expHL.removeAt(i, j)}
                      className="shrink-0"
                      title="Remove highlight"
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
                <Trash2 className="mr-1 size-3.5" /> Remove role
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Education</CardTitle>
          <Button variant="outline" size="sm" onClick={edu.addItem}>
            <Plus className="mr-1 size-3.5" /> Add education
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          {edu.items.length === 0 && (
            <p className="text-muted-foreground text-sm">No education entries yet.</p>
          )}
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
                <Trash2 className="mr-1 size-3.5" /> Remove education
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <CardTitle>Certifications</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs">One per line</Label>
            <Textarea
              className="min-h-[70px] resize-y"
              value={resume.certifications?.join('\n') ?? ''}
              onChange={(e) => update('certifications', e.target.value.split('\n'))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Projects</CardTitle>
          <Button variant="outline" size="sm" onClick={proj.addItem}>
            <Plus className="mr-1 size-3.5" /> Add project
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          {proj.items.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No projects yet. Add personal projects, hackathons, freelance work, or side projects.
            </p>
          )}
          {proj.items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Project name</Label>
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
                    onChange={(e) => proj.updateItem(i, { ...item, url: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[60px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) => proj.updateItem(i, { ...item, description: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Duration</Label>
                  <Input
                    value={item.duration ?? ''}
                    placeholder="e.g. Jan 2023 - Mar 2023"
                    onChange={(e) => proj.updateItem(i, { ...item, duration: e.target.value })}
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
                        title={`Remove ${tech}`}
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
                  <div key={j} className="flex items-start gap-2">
                    <Textarea
                      className="min-h-[52px] resize-y"
                      value={hl ?? ''}
                      placeholder="Key achievement or contribution..."
                      onChange={(e) => projHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => projHL.removeAt(i, j)}
                      className="shrink-0"
                      title="Remove highlight"
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
                <Trash2 className="mr-1 size-3.5" /> Remove project
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Open Source */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Open source</CardTitle>
          <Button variant="outline" size="sm" onClick={oss.addItem}>
            <Plus className="mr-1 size-3.5" /> Add contribution
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
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
                    onChange={(e) => oss.updateItem(i, { ...item, url: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={item.role ?? ''}
                    placeholder="e.g. maintainer, contributor"
                    onChange={(e) => oss.updateItem(i, { ...item, role: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[60px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) => oss.updateItem(i, { ...item, description: e.target.value })}
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
                        title={`Remove ${tech}`}
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
                  <div key={j} className="flex items-start gap-2">
                    <Textarea
                      className="min-h-[52px] resize-y"
                      value={hl ?? ''}
                      placeholder="Key contribution or impact..."
                      onChange={(e) => ossHL.updateAt(i, j, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => ossHL.removeAt(i, j)}
                      className="shrink-0"
                      title="Remove highlight"
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
                <Trash2 className="mr-1 size-3.5" /> Remove contribution
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Other Works */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Other works</CardTitle>
          <Button variant="outline" size="sm" onClick={other.addItem}>
            <Plus className="mr-1 size-3.5" /> Add item
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
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
                    onValueChange={(nextValue) =>
                      other.updateItem(i, { ...item, type: nextValue ?? 'other' })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OTHER_WORK_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
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
                    onChange={(e) => other.updateItem(i, { ...item, url: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={item.date ?? ''}
                    placeholder="e.g. 2024 or Mar 2024"
                    onChange={(e) => other.updateItem(i, { ...item, date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="min-h-[60px] resize-y"
                    value={item.description ?? ''}
                    onChange={(e) => other.updateItem(i, { ...item, description: e.target.value })}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => other.removeItem(i)}
                className="text-destructive mt-2"
              >
                <Trash2 className="mr-1 size-3.5" /> Remove item
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom sections */}
      <CustomSectionsEditor
        sections={resume.customSections ?? {}}
        onChange={(sections) => update('customSections', sections)}
      />
    </div>
  );
}

function SkillsEditor({
  groups,
  onChange,
}: {
  groups: SkillGroup[];
  onChange: (groups: SkillGroup[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No skills yet. Add a category and list your skills.
        </p>
      )}
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Input
              className="h-7 max-w-[220px] text-xs font-medium"
              value={group.name}
              placeholder="Category (e.g. Frontend)"
              onChange={(e) => {
                const next = groups.map((g, i) =>
                  i === groupIndex ? { ...g, name: e.target.value } : g
                );
                onChange(next);
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive ml-auto"
              title="Remove category"
              onClick={() => onChange(groups.filter((_, i) => i !== groupIndex))}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {group.items.map((skill, skillIndex) => (
              <Badge key={`${skill}-${skillIndex}`} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  onClick={() =>
                    onChange(
                      groups.map((g, i) =>
                        i === groupIndex
                          ? { ...g, items: g.items.filter((_, j) => j !== skillIndex) }
                          : g
                      )
                    )
                  }
                  className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                  title={`Remove ${skill}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </div>

          <AddSkillInput
            onAdd={(skill) =>
              onChange(
                groups.map((g, i) =>
                  i === groupIndex && !g.items.includes(skill)
                    ? { ...g, items: [...g.items, skill] }
                    : g
                )
              )
            }
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange([
            ...groups,
            {
              name: nextAvailableName(
                'Category',
                groups.map((group) => group.name)
              ),
              items: [],
            },
          ])
        }
      >
        <Plus className="mr-1 size-3.5" /> Add skill category
      </Button>
    </div>
  );
}

function AddSkillInput({ onAdd }: { onAdd: (skill: string) => void }) {
  const [skill, setSkill] = useState('');

  const handleAdd = () => {
    const trimmed = skill.trim();
    if (trimmed) {
      onAdd(trimmed);
      setSkill('');
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <Input
        className="h-7 text-xs"
        placeholder="Add a skill..."
        value={skill}
        onChange={(e) => setSkill(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function entriesToSections(
  entries: ReadonlyArray<readonly [string, string[]]>
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const [name, items] of entries) {
    merged[name] = [...(merged[name] ?? []), ...items];
  }
  return merged;
}

function CustomSectionsEditor({
  sections,
  onChange,
}: {
  sections: Record<string, string[]>;
  onChange: (sections: Record<string, string[]>) => void;
}) {
  const entries = Object.entries(sections);

  const updateEntry = (index: number, name: string, items: string[]) => {
    const next = entries.map(([entryName, entryItems], i) =>
      i === index ? ([name, items] as [string, string[]]) : ([entryName, entryItems] as const)
    );
    onChange(entriesToSections(next));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Custom sections</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Optional extra sections, such as languages or publications.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...sections,
              [nextAvailableName('New section', Object.keys(sections))]: [],
            })
          }
        >
          <Plus className="mr-1 size-3.5" /> Add section
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        {entries.length === 0 && (
          <p className="text-muted-foreground text-sm">No custom sections.</p>
        )}
        {entries.map(([name, items], index) => (
          <div key={index} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                className="h-7 max-w-[240px] text-xs font-medium"
                value={name}
                placeholder="Section heading"
                onChange={(e) => updateEntry(index, e.target.value, items)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive ml-auto"
                title="Remove section"
                onClick={() => {
                  const next = entries.filter((_, i) => i !== index);
                  onChange(entriesToSections(next));
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Textarea
              className="min-h-[60px] resize-y text-xs"
              placeholder="One item per line..."
              value={items.join('\n')}
              onChange={(e) => updateEntry(index, name, e.target.value.split('\n'))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <Button variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
