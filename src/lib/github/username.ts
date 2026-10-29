const RESERVED_PATHS = new Set([
  'about',
  'account',
  'apps',
  'codespaces',
  'collections',
  'contact',
  'copilot',
  'customer-stories',
  'dashboard',
  'enterprise',
  'events',
  'explore',
  'features',
  'git-guides',
  'home',
  'issues',
  'join',
  'login',
  'marketplace',
  'new',
  'notifications',
  'organizations',
  'orgs',
  'pricing',
  'pulls',
  'readme',
  'search',
  'security',
  'settings',
  'site',
  'sponsors',
  'team',
  'topics',
  'trending',
  'users',
]);

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export type ParseGitHubUsernameResult =
  | { ok: true; username: string }
  | { ok: false; message: string };

export function isValidGitHubUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value) && !RESERVED_PATHS.has(value.toLowerCase());
}

function error(message: string): ParseGitHubUsernameResult {
  return { ok: false, message };
}

/**
 * Accepts a GitHub profile URL, an @handle, or a bare username.
 * Repository/org/gist URLs are rejected so the app never analyzes the wrong thing.
 */
export function parseGitHubUsername(input: string): ParseGitHubUsernameResult {
  const raw = input.trim();
  if (!raw) return error('Enter a GitHub profile URL or username.');

  if (raw.startsWith('@')) {
    const username = raw.slice(1).trim().toLowerCase();
    if (!isValidGitHubUsername(username)) {
      return error('Enter a valid GitHub username (1–39 letters, numbers, or hyphens).');
    }
    return { ok: true, username };
  }

  const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
  const looksLikeHost = /^(?:www\.)?github\.com(?:\/|$)/i.test(raw);

  if (!hasProtocol && !looksLikeHost && !raw.includes('/')) {
    const username = raw.toLowerCase();
    if (!isValidGitHubUsername(username)) {
      return error('Enter a valid GitHub username (1–39 letters, numbers, or hyphens).');
    }
    return { ok: true, username };
  }

  let url: URL;
  try {
    url = new URL(hasProtocol ? raw : `https://${raw}`);
  } catch {
    return error('Enter a valid GitHub profile URL or username.');
  }

  const host = url.hostname.toLowerCase();
  if (host === 'gist.github.com') {
    return error('Gist links are not supported. Enter a GitHub profile URL instead.');
  }
  if (host !== 'github.com' && host !== 'www.github.com') {
    return error('Enter a github.com profile URL.');
  }
  if (url.username || url.password) {
    return error('GitHub profile URLs cannot contain credentials.');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return error('Enter a GitHub profile URL or username.');
  if (segments[0].toLowerCase() === 'orgs') {
    return error('Organization pages are not supported. Enter a personal GitHub profile.');
  }
  if (segments.length > 1) {
    return error('Enter a profile URL, not a repository or other GitHub page.');
  }

  let username: string;
  try {
    username = decodeURIComponent(segments[0]).toLowerCase();
  } catch {
    return error('Enter a valid GitHub profile URL or username.');
  }
  if (!isValidGitHubUsername(username)) {
    return error('Enter a valid GitHub username (1–39 letters, numbers, or hyphens).');
  }

  return { ok: true, username };
}
