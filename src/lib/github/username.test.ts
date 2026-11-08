import { describe, expect, it } from 'vitest';
import { isValidGitHubUsername, parseGitHubUsername } from './username';

describe('parseGitHubUsername', () => {
  it('accepts bare usernames and @handles', () => {
    expect(parseGitHubUsername('octocat')).toEqual({ ok: true, username: 'octocat' });
    expect(parseGitHubUsername('  @OctoCat ')).toEqual({ ok: true, username: 'octocat' });
  });

  it('accepts profile URLs with www, trailing slash, query, and hash', () => {
    expect(parseGitHubUsername('https://github.com/octocat/')).toEqual({
      ok: true,
      username: 'octocat',
    });
    expect(parseGitHubUsername('www.github.com/octocat?tab=repositories')).toEqual({
      ok: true,
      username: 'octocat',
    });
    expect(parseGitHubUsername('github.com/octocat#readme')).toEqual({
      ok: true,
      username: 'octocat',
    });
  });

  it('rejects repository, org, and gist URLs', () => {
    expect(parseGitHubUsername('https://github.com/octocat/alpha').ok).toBe(false);
    expect(parseGitHubUsername('https://github.com/orgs/github').ok).toBe(false);
    expect(parseGitHubUsername('https://gist.github.com/octocat/123').ok).toBe(false);
  });

  it('rejects non-GitHub URLs and malformed input', () => {
    expect(parseGitHubUsername('https://gitlab.com/octocat').ok).toBe(false);
    expect(parseGitHubUsername('not a username').ok).toBe(false);
    expect(parseGitHubUsername('').ok).toBe(false);
  });

  it('rejects reserved paths', () => {
    expect(parseGitHubUsername('settings').ok).toBe(false);
    expect(parseGitHubUsername('https://github.com/topics').ok).toBe(false);
  });

  it('validates username syntax and length', () => {
    expect(isValidGitHubUsername('octocat')).toBe(true);
    expect(isValidGitHubUsername('-octocat')).toBe(false);
    expect(isValidGitHubUsername('octo--cat')).toBe(false);
    expect(isValidGitHubUsername('octocat-')).toBe(false);
    expect(isValidGitHubUsername('a'.repeat(40))).toBe(false);
    expect(isValidGitHubUsername('octo_cat')).toBe(false);
  });
});
