import { env } from '../../config/env.ts';
import { isBinaryOrIgnored, isImportantFilePath } from '../../utils/chunker.ts';
import { isSafeRepoPath } from '../../utils/security.ts';

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
  throw new Error('Enter a valid GitHub repository URL or owner/repo slug (e.g. expressjs/express).');
}

export async function fetchGitHubRepositoryFiles(params: {
  owner: string;
  repo: string;
  token?: string;
  maxFiles?: number;
}): Promise<{
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  htmlUrl: string;
  files: RawRepoFile[];
}> {
  const { owner, repo, token, maxFiles = 140 } = params;
  const headers = githubHeaders(token);

  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    if (metaRes.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found or is private (connect GitHub OAuth for private repos).`);
    }
    if (metaRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Connect GitHub OAuth or try again shortly.');
    }
    throw new Error(`GitHub returned status ${metaRes.status}`);
  }

  const meta = (await metaRes.json()) as {
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    html_url: string;
  };
  const branch = meta.default_branch || 'main';

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    throw new Error(`Unable to fetch repository file tree for ${owner}/${repo}@${branch}.`);
  }

  const treeData = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; size?: number }>;
  };

  const candidateBlobs = (treeData.tree || [])
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        isSafeRepoPath(entry.path) &&
        !isBinaryOrIgnored(entry.path) &&
        (entry.size ?? 0) <= 140_000
    )
    .sort((a, b) => {
      const impA = isImportantFilePath(a.path) ? 1 : 0;
      const impB = isImportantFilePath(b.path) ? 1 : 0;
      if (impA !== impB) return impB - impA;
      return a.path.split('/').length - b.path.split('/').length;
    })
    .slice(0, maxFiles);

  const files: RawRepoFile[] = [];
  const concurrency = 10;
  for (let i = 0; i < candidateBlobs.length; i += concurrency) {
    const batch = candidateBlobs.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (blob) => {
        try {
          const encodedPath = blob.path
            .split('/')
            .map((s) => encodeURIComponent(s))
            .join('/');
          const contentRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
            { headers }
          );
          if (!contentRes.ok) return null;
          const fileJson = (await contentRes.json()) as { content?: string; encoding?: string };
          if (!fileJson.content || fileJson.encoding !== 'base64') return null;
          const text = Buffer.from(fileJson.content, 'base64').toString('utf8');
          if (text.includes('\0')) return null;
          return {
            path: blob.path,
            content: text,
            size: Buffer.byteLength(text, 'utf8'),
          };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) files.push(r);
    }
  }

  if (files.length === 0) {
    throw new Error('No readable source code files were found in this repository.');
  }

  return {
    name: meta.name,
    fullName: meta.full_name,
    description: meta.description || '',
    defaultBranch: branch,
    htmlUrl: meta.html_url,
    files,
  };
}
