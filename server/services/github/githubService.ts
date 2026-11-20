import { env } from '../../config/env.ts';
import { extractZipSafely } from '../repository/zipService.ts';

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  language: string;
  stargazersCount: number;
  updatedAt: string;
}

export interface RawRepoFile {
  path: string;
  content: string;
  size: number;
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'RepoMind-Platform',
  };
  const auth = token || env.githubFallbackToken;
  if (auth) {
    headers.Authorization = `Bearer ${auth}`;
  }
  return headers;
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(env.githubClientId && env.githubClientSecret);
}

export function buildGitHubOAuthUrl(state: string): string {
  const callbackUri = env.githubCallbackUrl || `${env.appUrl}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: callbackUri,
    scope: 'read:user repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(code: string): Promise<{
  accessToken: string;
  username: string;
  avatarUrl?: string;
}> {
  const callbackUri = env.githubCallbackUrl || `${env.appUrl}/auth/github/callback`;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: callbackUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error('Failed to exchange GitHub authorization code.');
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || 'GitHub did not return an access token.');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: githubHeaders(tokenData.access_token),
  });
  if (!userRes.ok) {
    throw new Error('Failed to fetch GitHub user profile.');
  }
  const profile = (await userRes.json()) as { login: string; avatar_url?: string };
  return {
    accessToken: tokenData.access_token,
    username: profile.login,
    avatarUrl: profile.avatar_url,
  };
}

export async function listUserGitHubRepos(token: string): Promise<GitHubRepoSummary[]> {
  const res = await fetch(
    'https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member',
    { headers: githubHeaders(token) }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText.slice(0, 150)}`);
  }
  const items = (await res.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    updated_at: string;
  }>;

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    fullName: item.full_name,
    description: item.description || '',
    private: item.private,
    htmlUrl: item.html_url,
    defaultBranch: item.default_branch || 'main',
    language: item.language || 'Unknown',
    stargazersCount: item.stargazers_count,
    updatedAt: item.updated_at,
  }));
}

export function parseGitHubRepoInput(input: string): { owner: string; repo: string } {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const slugMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (slugMatch) {
    return { owner: slugMatch[1], repo: slugMatch[2] };
  }
  throw new Error('Enter a valid GitHub repository URL or owner/repo slug (e.g. honojs/hono).');
}

async function downloadZipBuffer(url: string, headers: Record<string, string>): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    if (arr.byteLength > 28 * 1024 * 1024) {
      throw new Error('Repository archive exceeds the 28 MB ingestion cap.');
    }
    return Buffer.from(arr);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGitHubRepositoryFiles(params: {
  owner: string;
  repo: string;
  token?: string;
}): Promise<{
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  htmlUrl: string;
  files: RawRepoFile[];
}> {
  const { owner, repo, token } = params;
  const headers = githubHeaders(token);

  let name = repo;
  let fullName = `${owner}/${repo}`;
  let description = '';
  let branch = 'main';
  let htmlUrl = `https://github.com/${owner}/${repo}`;

  // 1. Try metadata endpoint (single API call)
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (metaRes.ok) {
    const meta = (await metaRes.json()) as {
      name: string;
      full_name: string;
      description: string | null;
      default_branch: string;
      html_url: string;
    };
    name = meta.name;
    fullName = meta.full_name;
    description = meta.description || '';
    branch = meta.default_branch || 'main';
    htmlUrl = meta.html_url;
  } else if (metaRes.status === 404) {
    throw new Error(
      `Repository ${owner}/${repo} was not found or is private (connect GitHub OAuth for private repos).`
    );
  }

  // 2. Download entire archive in 1 HTTP call (avoids N-file GitHub API rate limits)
  let zipBuffer: Buffer | null = null;
  if (token || env.githubFallbackToken) {
    zipBuffer = await downloadZipBuffer(
      `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`,
      headers
    );
  } else {
    // Public codeload endpoints do not consume GitHub REST API rate limits
    const branchesToTry = metaRes.ok ? [branch] : ['main', 'master'];
    for (const candidate of branchesToTry) {
      try {
        zipBuffer = await downloadZipBuffer(
          `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(candidate)}`,
          { 'User-Agent': 'RepoMind-Platform' }
        );
        branch = candidate;
        break;
      } catch {
        // try next branch
      }
    }
    if (!zipBuffer) {
      zipBuffer = await downloadZipBuffer(
        `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`,
        headers
      );
    }
  }

  const files = extractZipSafely(zipBuffer);
  return {
    name,
    fullName,
    description,
    defaultBranch: branch,
    htmlUrl,
    files,
  };
}
