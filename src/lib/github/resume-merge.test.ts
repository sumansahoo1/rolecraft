import { describe, expect, it } from 'vitest';
import { githubProjectToResumeProject, mergeGitHubProjectsIntoExtraction } from './resume-merge';
import { makeRepo, profileReadmeRepo, projects } from './__tests__/fixtures';
import type { GitHubProject } from '@/types';

function project(name: string): GitHubProject {
  const repo = makeRepo({ name, fullName: `octocat/${name}` });
  return {
    repo,
    score: 1,
    reasons: [],
    languages: [{ name: 'TypeScript', percentage: 100 }],
    commitCountSampled: 1,
    readmeExcerpt: 'README',
  };
}

describe('GitHub resume merge', () => {
  it('appends projects while preserving unknown fields and existing entries', () => {
    const extraction = {
      name: 'The Octocat',
      custom: { keep: true },
      projects: [{ name: 'Existing', description: 'Kept' }],
    };
    const result = mergeGitHubProjectsIntoExtraction(extraction, projects);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.json.name).toBe('The Octocat');
    expect(result.json.custom).toEqual({ keep: true });
    expect((result.json.projects as unknown[])[0]).toEqual({
      name: 'Existing',
      description: 'Kept',
    });
    expect(result.added).toHaveLength(3);
    expect(extraction.projects).toHaveLength(1);
  });

  it('deduplicates by case-insensitive name and normalized URL', () => {
    const result = mergeGitHubProjectsIntoExtraction(
      {
        projects: [{ name: 'ALPHA' }, { name: 'Other', url: 'https://github.com/octocat/beta/' }],
      },
      projects
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added.map((item) => item.name)).toEqual(['delta']);
  });

  it('caps additions at the requested maximum', () => {
    const result = mergeGitHubProjectsIntoExtraction({ projects: [] }, projects, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added).toHaveLength(2);
    expect(result.json.projects).toHaveLength(2);
  });

  it('rejects a malformed projects field without touching it', () => {
    expect(mergeGitHubProjectsIntoExtraction({ projects: { bad: true } }, projects)).toEqual({
      ok: false,
      reason: 'invalid-projects',
    });
  });

  it('preserves string project entries', () => {
    const result = mergeGitHubProjectsIntoExtraction({ projects: ['Old Project'] }, projects);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.json.projects).toContain('Old Project');
    expect(result.added).toHaveLength(3);
  });

  it('never adds the profile README repository as a project', () => {
    const profileProject: GitHubProject = {
      repo: profileReadmeRepo,
      score: 99,
      reasons: [],
      languages: [],
      commitCountSampled: 0,
      readmeExcerpt: null,
    };
    const result = mergeGitHubProjectsIntoExtraction({ projects: [] }, [
      profileProject,
      ...projects,
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.added.some((item) => item.name === 'octocat')).toBe(false);
    expect(result.added).toHaveLength(3);
  });

  it('rejects missing or non-object resumes and converts factual highlights', () => {
    expect(mergeGitHubProjectsIntoExtraction(null, projects)).toEqual({
      ok: false,
      reason: 'no-resume',
    });
    expect(mergeGitHubProjectsIntoExtraction([], projects)).toEqual({
      ok: false,
      reason: 'no-resume',
    });
    const converted = githubProjectToResumeProject(project('sample'));
    expect(converted).toMatchObject({
      name: 'sample',
      url: 'https://github.com/octocat/sample',
      technologies: ['TypeScript'],
    });
    expect(converted.highlights?.join(' ')).toContain('GitHub stars');
  });
});
