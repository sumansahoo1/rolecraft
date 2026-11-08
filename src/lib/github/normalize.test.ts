import { describe, expect, it } from 'vitest';
import {
  cleanReadmeText,
  normalizeCommit,
  normalizeIssue,
  normalizeLanguages,
  normalizeProfile,
  normalizePullRequest,
  normalizeRepo,
  normalizeSearchCommit,
  repoFullNameFromSearchItem,
  safeAvatarUrl,
  safeGitHubUrl,
  safeHttpUrl,
} from './normalize';

describe('GitHub normalization', () => {
  it('normalizes profile fields and rejects unsafe URLs', () => {
    const profile = normalizeProfile({
      login: 'octocat',
      name: null,
      type: 'User',
      avatar_url: 'javascript:alert(1)',
      html_url: 'https://github.com/octocat',
      blog: 'javascript:alert(1)',
      public_repos: '12',
      followers: 5,
      created_at: '2015-01-01T00:00:00Z',
    });
    expect(profile).toMatchObject({
      login: 'octocat',
      name: null,
      avatarUrl: '',
      blog: null,
      publicRepos: 12,
      followers: 5,
    });
  });

  it('drops private repositories from the repo list', () => {
    expect(
      normalizeRepo(
        {
          name: 'secret',
          owner: { login: 'octocat' },
          private: true,
          html_url: 'https://github.com/octocat/secret',
        },
        'octocat'
      )
    ).toBeNull();
    expect(
      normalizeRepo(
        {
          name: 'secret',
          owner: { login: 'octocat' },
          visibility: 'private',
          html_url: 'https://github.com/octocat/secret',
        },
        'octocat'
      )
    ).toBeNull();
  });

  it('normalizes real search/issues payloads without a repository object', () => {
    const raw = {
      id: 10,
      number: 7,
      title: 'Fix parser',
      state: 'closed',
      html_url: 'https://github.com/org/lib/pull/7',
      repository_url: 'https://api.github.com/repos/org/lib',
      pull_request: { merged_at: '2020-01-01T00:00:00Z' },
      created_at: '2019-12-01T00:00:00Z',
    };
    expect(repoFullNameFromSearchItem(raw)).toBe('org/lib');
    expect(normalizePullRequest(raw, 'octocat')).toMatchObject({
      repoFullName: 'org/lib',
      merged: true,
      isExternal: true,
      url: 'https://github.com/org/lib/pull/7',
    });

    const issue = normalizeIssue(
      {
        id: 11,
        number: 8,
        title: 'Docs',
        state: 'open',
        html_url: 'https://github.com/org/lib/issues/8',
        repository_url: 'https://api.github.com/repos/org/lib',
        created_at: '2020-02-01T00:00:00Z',
      },
      'octocat'
    );
    expect(issue).toMatchObject({ repoFullName: 'org/lib', isExternal: true });
  });

  it('drops private commit-search items before reading the repository name', () => {
    expect(
      normalizeSearchCommit({
        sha: 'abc',
        html_url: 'https://github.com/octocat/private/commit/abc',
        repository: { full_name: 'octocat/private', private: true },
        commit: {
          message: 'secret',
          author: { date: '2020-01-01T00:00:00Z' },
        },
      })
    ).toBeNull();
  });

  it('sanitizes languages and README text', () => {
    expect(normalizeLanguages({ TypeScript: 10, Go: 'bad', Rust: -1 })).toEqual({
      TypeScript: 10,
    });
    expect(
      cleanReadmeText('<h1>Hello</h1> [Docs](https://example.com) ![badge](x.png) &amp; more', 100)
    ).toBe('Hello Docs & more');
  });

  it('normalizes commits, pull requests, and issues with HTML links', () => {
    const commit = normalizeCommit(
      {
        sha: 'abc',
        html_url: 'https://github.com/octocat/alpha/commit/abc',
        commit: {
          message: 'Subject line\n\nBody',
          author: { date: '2020-01-01T00:00:00Z' },
        },
      },
      'octocat/alpha',
      'detail'
    );
    expect(commit).toMatchObject({
      sha: 'abc',
      message: 'Subject line',
      url: 'https://github.com/octocat/alpha/commit/abc',
    });
    expect(commit?.message).not.toContain('Body');

    expect(
      normalizePullRequest(
        {
          id: 1,
          number: 2,
          title: 'PR',
          html_url: 'https://github.com/octocat/alpha/pull/2',
          repository_url: 'https://api.github.com/repos/octocat/alpha',
          state: 'open',
          created_at: '2020-01-01T00:00:00Z',
        },
        'octocat'
      )
    ).toMatchObject({ merged: false, isExternal: false });
  });

  it('rejects unsafe URLs and non-GitHub links', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('https://user:pass@github.com/x')).toBeNull();
    expect(safeHttpUrl('https://example.com')).toBe('https://example.com/');
    expect(safeGitHubUrl('https://example.com/octocat')).toBeNull();
    expect(safeGitHubUrl('https://github.com.evil.com/octocat')).toBeNull();
    expect(safeGitHubUrl('https://github.com/octocat')).toBe('https://github.com/octocat');
    expect(safeAvatarUrl('https://evil.example/u/1')).toBeNull();
    expect(safeAvatarUrl('https://avatars.githubusercontent.com/u/1')).toBe(
      'https://avatars.githubusercontent.com/u/1'
    );
  });
});
