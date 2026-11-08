import type { Education, Experience, MasterResume, OpenSource, OtherWork, Project } from '@/types';

type RawResume = Record<string, unknown>;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseProjects(raw: unknown): Project[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    if (typeof item === 'string') {
      return { name: item, description: '' };
    }
    const project = item as Record<string, unknown>;
    return {
      name: asString(project.name),
      description: asString(project.description),
      url: asOptionalString(project.url),
      technologies: Array.isArray(project.technologies)
        ? project.technologies.map(String)
        : undefined,
      duration: asOptionalString(project.duration),
      highlights: Array.isArray(project.highlights) ? project.highlights.map(String) : undefined,
    };
  });
}

function parseOpenSource(raw: unknown): OpenSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    const entry = item as Record<string, unknown>;
    return {
      name: asString(entry.name),
      description: asString(entry.description),
      url: asOptionalString(entry.url),
      role: asOptionalString(entry.role),
      technologies: Array.isArray(entry.technologies) ? entry.technologies.map(String) : undefined,
      highlights: Array.isArray(entry.highlights) ? entry.highlights.map(String) : undefined,
    };
  });
}

function parseOtherWorks(raw: unknown): OtherWork[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    const work = item as Record<string, unknown>;
    return {
      title: asString(work.title),
      type: asString(work.type, 'other'),
      description: asString(work.description),
      url: asOptionalString(work.url),
      date: asOptionalString(work.date),
    };
  });
}

function parseSkills(raw: unknown): MasterResume['skills'] {
  if (Array.isArray(raw)) return asStringArray(raw);
  if (raw && typeof raw === 'object') {
    const categories: Record<string, string[]> = {};
    for (const [name, items] of Object.entries(raw)) {
      categories[name] = asStringArray(items);
    }
    return categories;
  }
  return [];
}

function parseExperience(raw: unknown): Experience[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    const entry = item as Record<string, unknown>;
    return {
      company: asString(entry.company),
      role: asString(entry.role),
      duration: asString(entry.duration),
      highlights: asStringArray(entry.highlights),
    };
  });
}

function parseEducation(raw: unknown): Education[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    const entry = item as Record<string, unknown>;
    return {
      institution: asString(entry.institution),
      degree: asString(entry.degree),
      field: asString(entry.field),
      year: asString(entry.year),
    };
  });
}

function parseCustomSections(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const sections: Record<string, string[]> = {};
  for (const [name, items] of Object.entries(raw)) {
    sections[name] = asStringArray(items);
  }
  return Object.keys(sections).length > 0 ? sections : undefined;
}

/** Convert stored raw extraction JSON into the typed master resume shape. */
export function parseMasterResume(raw: RawResume): MasterResume {
  const certifications = asStringArray(raw.certifications);
  return {
    name: asString(raw.name),
    email: asString(raw.email),
    phone: asOptionalString(raw.phone),
    linkedin: asOptionalString(raw.linkedin),
    github: asOptionalString(raw.github),
    twitter: asOptionalString(raw.twitter),
    portfolio: asOptionalString(raw.portfolio),
    summary: asString(raw.summary),
    skills: parseSkills(raw.skills),
    experience: parseExperience(raw.experience),
    education: parseEducation(raw.education),
    certifications: certifications.length > 0 ? certifications : undefined,
    projects: parseProjects(raw.projects),
    openSource: parseOpenSource(raw.openSource),
    otherWorks: parseOtherWorks(raw.otherWorks),
    customSections: parseCustomSections(raw.customSections),
  };
}

/**
 * Stable serialization for change detection. Object key order does not matter.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortJson((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge typed list items into their raw counterparts by a stable key, so
 * unknown nested fields (for example a hand-added `location` on an experience
 * entry) survive a form edit. Items that cannot be matched keep the typed shape.
 */
function mergeObjectList<T extends object>(
  raw: unknown,
  items: T[] | undefined,
  keyFields: string[]
): T[] | undefined {
  if (!items?.length) return undefined;

  const pool = Array.isArray(raw) ? raw.filter(isRecord) : [];
  const used = new Set<number>();

  return items.map((item) => {
    const record = item as Record<string, unknown>;
    const keyValues = keyFields.map((field) => String(record[field] ?? '').trim());
    if (keyValues.every((value) => value.length === 0)) return item;
    const key = keyValues.join('\u0000');

    const matchIndex = pool.findIndex((candidate, index) => {
      if (used.has(index)) return false;
      const candidateKey = keyFields
        .map((field) => String(candidate[field] ?? '').trim())
        .join('\u0000');
      return candidateKey === key;
    });

    if (matchIndex === -1) return item;
    used.add(matchIndex);
    return { ...pool[matchIndex], ...record } as T;
  });
}

/**
 * Clean saved values without dropping unknown fields. Used on explicit save so
 * the editor can keep blank lines while the user is typing.
 */
export function sanitizeMasterResumeRaw(raw: RawResume): RawResume {
  const next: RawResume = { ...raw };

  if (Array.isArray(next.skills)) {
    next.skills = [...new Set(asStringArray(next.skills).map((item) => item.trim()))].filter(
      Boolean
    );
  } else if (next.skills && typeof next.skills === 'object') {
    const skills: Record<string, string[]> = {};
    for (const [name, items] of Object.entries(next.skills as Record<string, unknown>)) {
      const heading = name.trim() || 'Skills';
      const values = asStringArray(items)
        .map((item) => item.trim())
        .filter(Boolean);
      if (values.length > 0) {
        skills[heading] = [...new Set([...(skills[heading] ?? []), ...values])];
      }
    }
    next.skills = skills;
  }

  if (Array.isArray(next.certifications)) {
    const certifications = asStringArray(next.certifications)
      .map((item) => item.trim())
      .filter(Boolean);
    if (certifications.length > 0) next.certifications = certifications;
    else delete next.certifications;
  }

  if (next.customSections && typeof next.customSections === 'object') {
    const sections: Record<string, string[]> = {};
    for (const [name, items] of Object.entries(next.customSections as Record<string, unknown>)) {
      const heading = name.trim();
      const values = asStringArray(items)
        .map((item) => item.trim())
        .filter(Boolean);
      if (heading && values.length > 0) sections[heading] = values;
    }
    if (Object.keys(sections).length > 0) next.customSections = sections;
    else delete next.customSections;
  }

  return next;
}

/**
 * Merge typed edits back into the stored raw extraction JSON.
 *
 * Unknown fields are preserved so hand-added JSON or future extractor fields
 * are never dropped by the form editor. Empty optional fields are removed
 * instead of being persisted as empty strings.
 */
export function mergeMasterResumeIntoRaw(raw: RawResume, resume: MasterResume): RawResume {
  const next: RawResume = { ...raw };

  next.name = resume.name ?? '';
  next.email = resume.email ?? '';
  next.summary = resume.summary ?? '';

  const optionalStrings = ['phone', 'linkedin', 'github', 'twitter', 'portfolio'] as const;
  for (const key of optionalStrings) {
    const value = resume[key];
    if (value && value.trim()) next[key] = value;
    else delete next[key];
  }

  next.skills = resume.skills ?? [];
  next.experience = mergeObjectList(raw.experience, resume.experience, ['company', 'role']) ?? [];
  next.education =
    mergeObjectList(raw.education, resume.education, ['institution', 'degree', 'field']) ?? [];

  if (resume.certifications?.length) next.certifications = resume.certifications;
  else delete next.certifications;

  const projects = mergeObjectList(raw.projects, resume.projects, ['name']);
  if (projects?.length) next.projects = projects;
  else delete next.projects;

  const openSource = mergeObjectList(raw.openSource, resume.openSource, ['name']);
  if (openSource?.length) next.openSource = openSource;
  else delete next.openSource;

  const otherWorks = mergeObjectList(raw.otherWorks, resume.otherWorks, ['title']);
  if (otherWorks?.length) next.otherWorks = otherWorks;
  else delete next.otherWorks;

  if (resume.customSections && Object.keys(resume.customSections).length > 0) {
    next.customSections = resume.customSections;
  } else {
    delete next.customSections;
  }

  return next;
}
