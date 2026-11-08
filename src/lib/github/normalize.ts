import type {
  GitHubCommit,
  GitHubIssue,
  GitHubProfile,
  GitHubPullRequest,
  GitHubRepo,
} from '@/types';

// ─── URL safety ──────────────────────────────────────────────

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeGitHubUrl(value: unknown): string | null {
  const normalized = safeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.hostname.toLowerCase() !== 'github.com') return null;
  return normalized;
}

export function safeAvatarUrl(value: unknown): string | null {
  const normalized = safeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  if (url.hostname.toLowerCase() !== 'avatars.githubusercontent.com') return null;
  return normalized;
}

// ─── Text cleanup ────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function stripMarkdownToText(value: string): string {
  let text = value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1');

  for (const [entity, replacement] of Object.entries(ENTITIES)) {
    text = text.split(entity).join(replacement);
  }

  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanReadmeText(value: unknown, maxChars = 1200): string | null {
  if (typeof value !== 'string') return null;
  const text = stripMarkdownToText(value);
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}

// ─── Profile & repos ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asString(value: any): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asNumber(value: any): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProfile(raw: any): GitHubProfile | null {
  const login = asString(raw?.login);
  if (!login) return null;
  const type = asString(raw?.type) ?? '';
  const htmlUrl = safeGitHubUrl(raw?.html_url) ?? `https://github.com/${login}`;

  return {
    login,
    name: asString(raw?.name),
    type,
    avatarUrl: safeAvatarUrl(raw?.avatar_url) ?? '',
    htmlUrl,
    bio: asString(raw?.bio),
    company: asString(raw?.company),
    blog: safeHttpUrl(raw?.blog),
    location: asString(raw?.location),
    publicRepos: asNumber(raw?.public_repos),
    followers: asNumber(raw?.followers),
    following: asNumber(raw?.following),
    createdAt: asString(raw?.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRepo(raw: any, profileLogin: string): GitHubRepo | null {
  if (raw?.private === true) return null;
  if (raw?.visibility != null && raw.visibility !== 'public') return null;
  const name = asString(raw?.name);
  const owner = asString(raw?.owner?.login);
  if (!name || !owner) return null;
  const fullName = `${owner}/${name}`;
  const htmlUrl = safeGitHubUrl(raw?.html_url) ?? safeGitHubUrl(`https://github.com/${fullName}`);
  if (!htmlUrl) return null;

  const topics = Array.isArray(raw?.topics)
    ? raw.topics.filter((topic: unknown): topic is string => typeof topic === 'string').slice(0, 20)
    : [];

  return {
    id: asNumber(raw?.id),
    name,
    fullName,
    htmlUrl,
    description: asString(raw?.description),
    homepage: safeHttpUrl(raw?.homepage),
    primaryLanguage: asString(raw?.language),
    topics,
    stars: asNumber(raw?.stargazers_count),
    forks: asNumber(raw?.forks_count),
    isFork: raw?.fork === true,
    isArchived: raw?.archived === true,
    isProfileReadme:
      owner.toLowerCase() === profileLogin.toLowerCase() &&
      name.toLowerCase() === profileLogin.toLowerCase(),
    createdAt: asString(raw?.created_at),
    pushedAt: asString(raw?.pushed_at),
  };
}

export function normalizeRepos(raw: unknown, profileLogin: string): GitHubRepo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeRepo(item, profileLogin))
    .filter((repo): repo is GitHubRepo => repo !== null);
}

export function normalizeLanguages(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const languages: Record<string, number> = {};
  for (const [name, bytes] of Object.entries(raw)) {
    const value = Number(bytes);
    if (name && Number.isFinite(value) && value > 0) languages[name] = value;
  }
  return languages;
}

// ─── Commits ─────────────────────────────────────────────────

export function normalizeCommit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  repoFullName: string,
  source: 'detail' | 'search'
): GitHubCommit | null {
  const sha = asString(raw?.sha);
  if (!sha) return null;
  const message = asString(raw?.commit?.message);
  const authoredAt = asString(raw?.commit?.author?.date) ?? asString(raw?.commit?.committer?.date);
  if (!message || !authoredAt) return null;
  const url =
    safeGitHubUrl(raw?.html_url) ??
    safeGitHubUrl(`https://github.com/${repoFullName}/commit/${sha}`);
  if (!url) return null;
  return {
    sha,
    repoFullName,
    message: message.split('\n')[0].slice(0, 200).trim(),
    authoredAt,
    url,
    source,
  };
}

export function normalizeCommits(
  raw: unknown,
  repoFullName: string,
  source: 'detail' | 'search'
): GitHubCommit[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeCommit(item, repoFullName, source))
    .filter((commit): commit is GitHubCommit => commit !== null);
}

// ─── Search item repo names ──────────────────────────────────

const REPO_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function validFullName(owner: string | undefined, repo: string | undefined): string | null {
  if (!owner || !repo || !REPO_SEGMENT.test(owner) || !REPO_SEGMENT.test(repo)) return null;
  return `${owner}/${repo}`;
}

function repoFullNameFromApiUrl(value: unknown): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase() !== 'api.github.com') return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'repos') return null;
  return validFullName(parts[1], parts[2]);
}

function repoFullNameFromHtmlUrl(value: unknown): string | null {
  const url = safeGitHubUrl(value);
  if (!url) return null;
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  if (parts.length < 3) return null;
  return validFullName(parts[0], parts[1]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function repoFullNameFromSearchItem(raw: any): string | null {
  return (
    repoFullNameFromApiUrl(raw?.repository_url) ??
    repoFullNameFromHtmlUrl(raw?.html_url) ??
    (typeof raw?.repository?.full_name === 'string' && raw.repository.private !== true
      ? raw.repository.full_name
      : null)
  );
}

// ─── Pull requests & issues ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePullRequest(raw: any, profileLogin: string): GitHubPullRequest | null {
  if (raw?.repository?.private === true) return null;
  if (raw?.repository?.visibility != null && raw.repository.visibility !== 'public') return null;
  const repoFullName = repoFullNameFromSearchItem(raw);
  const url = safeGitHubUrl(raw?.html_url);
  if (!repoFullName || !url) return null;
  const owner = repoFullName.split('/')[0];
  const id = asNumber(raw?.id);
  if (!id) return null;

  return {
    id,
    number: asNumber(raw?.number),
    title: asString(raw?.title) ?? '',
    repoFullName,
    url,
    state: raw?.state === 'open' ? 'open' : 'closed',
    merged: Boolean(raw?.pull_request?.merged_at),
    isExternal: owner.toLowerCase() !== profileLogin.toLowerCase(),
    createdAt: asString(raw?.created_at) ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeIssue(raw: any, profileLogin: string): GitHubIssue | null {
  if (raw?.repository?.private === true) return null;
  if (raw?.repository?.visibility != null && raw.repository.visibility !== 'public') return null;
  const repoFullName = repoFullNameFromSearchItem(raw);
  const url = safeGitHubUrl(raw?.html_url);
  if (!repoFullName || !url) return null;
  const owner = repoFullName.split('/')[0];
  const id = asNumber(raw?.id);
  if (!id) return null;

  return {
    id,
    number: asNumber(raw?.number),
    title: asString(raw?.title) ?? '',
    repoFullName,
    url,
    state: raw?.state === 'open' ? 'open' : 'closed',
    isExternal: owner.toLowerCase() !== profileLogin.toLowerCase(),
    createdAt: asString(raw?.created_at) ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSearchCommit(raw: any): GitHubCommit | null {
  if (raw?.repository?.private === true) return null;
  if (raw?.repository?.visibility != null && raw.repository.visibility !== 'public') {
    return null;
  }
  const repoFullName =
    (typeof raw?.repository?.full_name === 'string' ? raw.repository.full_name : null) ??
    repoFullNameFromSearchItem(raw);
  if (!repoFullName) return null;
  const normalized = normalizeCommit(raw, repoFullName, 'search');
  return normalized;
}
