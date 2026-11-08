import type { GitHubProject, Project } from '@/types';
import { safeHttpUrl } from './normalize';

export type MergeResult =
  | { ok: true; json: Record<string, unknown>; added: Project[] }
  | {
      ok: false;
      reason: 'no-resume' | 'invalid-extraction' | 'invalid-projects' | 'quota';
    };

function keyFor(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function urlKey(value: string | null | undefined): string {
  const safe = safeHttpUrl(value);
  return safe ? safe.replace(/\/+$/g, '').toLowerCase() : '';
}

function yearOf(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

export function githubProjectToResumeProject(project: GitHubProject): Project {
  const created = yearOf(project.repo.createdAt);
  const pushed = yearOf(project.repo.pushedAt);
  const duration =
    created && pushed && created !== pushed
      ? `${created} - ${pushed}`
      : (created ?? pushed ?? undefined);
  const highlights: string[] = [];
  if (project.repo.stars > 0) highlights.push(`${project.repo.stars} GitHub stars`);
  if (project.repo.forks > 0) highlights.push(`${project.repo.forks} forks`);
  if (project.commitCountSampled > 0) {
    highlights.push(`${project.commitCountSampled} sampled commits`);
  }
  if (project.readmeExcerpt) highlights.push('Includes project documentation');

  return {
    name: project.repo.name,
    description: project.repo.description ?? `Public GitHub repository ${project.repo.fullName}.`,
    url: project.repo.htmlUrl,
    technologies:
      project.languages.length > 0
        ? project.languages.map((language) => language.name)
        : project.repo.primaryLanguage
          ? [project.repo.primaryLanguage]
          : undefined,
    duration,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
}

export function mergeGitHubProjectsIntoExtraction(
  extraction: unknown,
  projects: GitHubProject[],
  max = 4
): MergeResult {
  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return { ok: false, reason: 'no-resume' };
  }
  if (max <= 0) return { ok: false, reason: 'invalid-extraction' };

  const json = extraction as Record<string, unknown>;
  const rawProjects = json.projects;
  if (rawProjects != null && !Array.isArray(rawProjects)) {
    return { ok: false, reason: 'invalid-projects' };
  }

  const existing = Array.isArray(rawProjects) ? rawProjects : [];
  const existingNames = new Set<string>();
  const existingUrls = new Set<string>();
  for (const entry of existing) {
    if (typeof entry === 'string') {
      existingNames.add(keyFor(entry));
      continue;
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      existingNames.add(keyFor(typeof record.name === 'string' ? record.name : ''));
      existingUrls.add(urlKey(typeof record.url === 'string' ? record.url : ''));
    }
  }

  const added: Project[] = [];
  for (const project of projects) {
    if (project.repo.isProfileReadme) continue;
    const converted = githubProjectToResumeProject(project);
    const nameKey = keyFor(converted.name);
    const projectUrlKey = urlKey(converted.url);
    if (
      (nameKey && existingNames.has(nameKey)) ||
      (projectUrlKey && existingUrls.has(projectUrlKey))
    ) {
      continue;
    }
    existingNames.add(nameKey);
    if (projectUrlKey) existingUrls.add(projectUrlKey);
    added.push(converted);
    if (added.length >= max) break;
  }

  return {
    ok: true,
    json: { ...json, projects: [...existing, ...added] },
    added,
  };
}
