/**
 * GitHub tool registry for the chat agent.
 *
 * Each tool exposes a name, a short description, a JSON args schema (inlined
 * into the agent system prompt), and a `run` executor that hits the GitHub
 * REST API. Executors return trimmed payloads so the LLM context stays small.
 */

import { request, trimPayload } from './client';
import type { ToolDefinition, ToolResult } from '@/types';

function pick(
  args: Record<string, unknown>,
  keys: string[],
  defaults: Record<string, string | number> = {}
): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = { ...defaults };
  for (const key of keys) {
    const v = args[key];
    if (typeof v === 'string' || typeof v === 'number') out[key] = v;
  }
  return out;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`Missing required argument "${key}"`);
  }
  return v.trim();
}

function result(data: unknown, truncated = false): ToolResult {
  return { data: trimPayload(data), truncated };
}

export const GITHUB_TOOLS: ToolDefinition[] = [
  {
    name: 'get_authenticated_user',
    description:
      'Get the authenticated GitHub user (login, name, bio, company). Use this to identify whose account you are summarizing.',
    argsSchema: {},
    run: async (_args, ctx) => result((await request(ctx, '/user')).data),
  },
  {
    name: 'list_my_repos',
    description:
      'List repositories for the authenticated user. Use for questions about "my" repos.',
    argsSchema: {
      sort: 'string, optional: created|updated|pushed|full_name',
      per_page: 'number, optional (default 30, max 100)',
    },
    run: async (args, ctx) =>
      result(
        (
          await request(ctx, '/user/repos', {
            query: pick(args, ['sort', 'per_page'], { per_page: 30 }),
          })
        ).data
      ),
  },
  {
    name: 'list_user_repos',
    description: 'List public repositories for a given GitHub username.',
    argsSchema: {
      username: 'string, required',
      sort: 'string, optional: created|updated|pushed|full_name',
      per_page: 'number, optional (default 30)',
    },
    run: async (args, ctx) => {
      const username = requireString(args, 'username');
      return result(
        (
          await request(ctx, `/users/${username}/repos`, {
            query: pick(args, ['sort', 'per_page'], { per_page: 30 }),
          })
        ).data
      );
    },
  },
  {
    name: 'list_org_repos',
    description: 'List repositories for a GitHub organization.',
    argsSchema: {
      org: 'string, required',
      per_page: 'number, optional (default 30)',
    },
    run: async (args, ctx) => {
      const org = requireString(args, 'org');
      return result(
        (
          await request(ctx, `/orgs/${org}/repos`, {
            query: pick(args, ['per_page'], { per_page: 30 }),
          })
        ).data
      );
    },
  },
  {
    name: 'search_repos',
    description: 'Search repositories by keyword/query using GitHub search syntax.',
    argsSchema: {
      q: 'string, required (e.g. "user:octocat language:typescript")',
      sort: 'string, optional: stars|forks|updated',
      per_page: 'number, optional (default 20)',
    },
    run: async (args, ctx) => {
      const q = requireString(args, 'q');
      return result(
        (
          await request<{ items: unknown[] }>(ctx, '/search/repositories', {
            query: { q, per_page: 20 },
          })
        ).data.items ?? []
      );
    },
  },
  {
    name: 'search_issues',
    description:
      'Search issues AND pull requests by query (GitHub search syntax). Returns items with number, title, state, labels, and a truncated body.',
    argsSchema: {
      q: 'string, required (e.g. "repo:owner/repo is:pr author:octocat")',
      per_page: 'number, optional (default 20)',
    },
    run: async (args, ctx) => {
      const q = requireString(args, 'q');
      return result(
        (
          await request<{ items: unknown[] }>(ctx, '/search/issues', {
            query: { q, per_page: 20 },
          })
        ).data.items ?? []
      );
    },
  },
  {
    name: 'list_issues',
    description: 'List issues in a repository (does not include pull requests by default).',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      state: 'string, optional: open|closed|all (default open)',
      assignee: 'string, optional: username',
      per_page: 'number, optional (default 30)',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      return result(
        (
          await request(ctx, `/repos/${owner}/${repo}/issues`, {
            query: pick(args, ['state', 'assignee', 'per_page'], { state: 'open', per_page: 30 }),
          })
        ).data
      );
    },
  },
  {
    name: 'get_issue',
    description: 'Get a single issue with its comments (title, body, labels, state).',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      number: 'number, required',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      const number = requireString(args, 'number');
      const issue = (await request(ctx, `/repos/${owner}/${repo}/issues/${number}`)).data;
      const comments = (
        await request(ctx, `/repos/${owner}/${repo}/issues/${number}/comments`, {
          query: { per_page: 50 },
        })
      ).data;
      return result({ issue, comments });
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository.',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      state: 'string, optional: open|closed|all (default open)',
      per_page: 'number, optional (default 30)',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      return result(
        (
          await request(ctx, `/repos/${owner}/${repo}/pulls`, {
            query: pick(args, ['state', 'per_page'], { state: 'open', per_page: 30 }),
          })
        ).data
      );
    },
  },
  {
    name: 'get_pull_request',
    description:
      'Get a single pull request with its reviews, review comments, issue comments, and changed files. Use for detailed PR analysis.',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      number: 'number, required',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      const number = requireString(args, 'number');
      const base = `/repos/${owner}/${repo}/pulls/${number}`;
      const [pr, reviews, reviewComments, issueComments, files] = await Promise.all([
        (await request(ctx, base)).data,
        (await request(ctx, `${base}/reviews`, { query: { per_page: 50 } })).data,
        (await request(ctx, `${base}/comments`, { query: { per_page: 100 } })).data,
        (
          await request(ctx, `/repos/${owner}/${repo}/issues/${number}/comments`, {
            query: { per_page: 50 },
          })
        ).data,
        (await request(ctx, `${base}/files`, { query: { per_page: 100 } })).data,
      ]);
      return result({ pr, reviews, reviewComments, issueComments, files });
    },
  },
  {
    name: 'list_commits',
    description: 'List commits in a repository, optionally filtered by author or date range.',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      author: 'string, optional: GitHub username',
      since: 'string, optional: ISO 8601 timestamp',
      until: 'string, optional: ISO 8601 timestamp',
      per_page: 'number, optional (default 30)',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      return result(
        (
          await request(ctx, `/repos/${owner}/${repo}/commits`, {
            query: pick(args, ['author', 'since', 'until', 'per_page'], { per_page: 30 }),
          })
        ).data
      );
    },
  },
  {
    name: 'get_commit',
    description: 'Get a single commit by SHA (message, author, changed files).',
    argsSchema: {
      owner: 'string, required',
      repo: 'string, required',
      sha: 'string, required',
    },
    run: async (args, ctx) => {
      const owner = requireString(args, 'owner');
      const repo = requireString(args, 'repo');
      const sha = requireString(args, 'sha');
      return result((await request(ctx, `/repos/${owner}/${repo}/commits/${sha}`)).data);
    },
  },
];

const TOOL_MAP = new Map(GITHUB_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_MAP.get(name);
}
