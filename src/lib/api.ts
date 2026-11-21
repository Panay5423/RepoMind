import type {
  AnalysisDTO,
  ArchitectureIntelligenceDTO,
  BugFindingDTO,
  ChatMode,
  ConversationDTO,
  DashboardOverviewDTO,
  DocType,
  DocumentationDTO,
  FileSearchMatch,
  ImpactReportDTO,
  LevelGraphDTO,
  MessageDTO,
  PublicUser,
  RepositoryDTO,
  RepositoryFileDTO,
} from '../../shared/types.ts';

// Hold Bearer token strictly in JS memory (never localStorage/sessionStorage);
// HttpOnly Secure SameSite=None Partitioned session cookie handles reload persistence.
let inMemoryToken: string | null = null;

export function getStoredToken(): string | null {
  return inMemoryToken;
}

export function setStoredToken(token: string | null): void {
  inMemoryToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'RepoMind');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response.' };
  }

  if (!res.ok) {
    const errMsg =
      (data as { error?: string })?.error || `Request failed with status ${res.status}`;
    if (res.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/register') {
      setStoredToken(null);
    }
    throw new Error(errMsg);
  }

  return data as T;
}

export interface GitHubRepoItem {
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

export const api = {
  auth: {
    providers: () =>
      request<{ githubOAuthConfigured: boolean; callbackUrl: string }>('/api/auth/providers'),
    githubUrl: () => request<{ url: string }>('/api/auth/github/url'),
    register: (body: { name: string; email: string; password: string; roleTitle?: string }) =>
      request<{ token: string; user: PublicUser }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ token: string; user: PublicUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    demo: () =>
      request<{ token: string; user: PublicUser }>('/api/auth/demo', {
        method: 'POST',
      }),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    me: () => request<{ user: PublicUser }>('/api/auth/me'),
    updateProfile: (body: {
      name?: string;
      roleTitle?: string;
      currentPassword?: string;
      newPassword?: string;
    }) =>
      request<{ user: PublicUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  github: {
    status: () =>
      request<{
        oauthConfigured: boolean;
        connected: boolean;
        githubUsername: string | null;
        githubAvatarUrl: string | null;
        callbackUrl: string;
      }>('/api/github/status'),
    authUrl: () => request<{ url: string }>('/api/github/auth-url'),
    repos: () => request<{ repos: GitHubRepoItem[] }>('/api/github/repos'),
    disconnect: () => request<{ ok: boolean }>('/api/github/disconnect', { method: 'POST' }),
  },

  dashboard: {
    overview: () => request<DashboardOverviewDTO>('/api/dashboard'),
  },

  repositories: {
    list: (params?: { q?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.status) qs.set('status', params.status);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return request<{ repositories: RepositoryDTO[] }>(`/api/repositories${suffix}`);
    },
    importGitHub: (repoInput: string) =>
      request<{ repository: RepositoryDTO }>('/api/repositories/github', {
        method: 'POST',
        body: JSON.stringify({ repoInput }),
      }),
    uploadZip: (formData: FormData) =>
      request<{ repository: RepositoryDTO }>('/api/repositories/upload', {
        method: 'POST',
        body: formData,
      }),
    detail: (id: string) =>
      request<{
        repository: RepositoryDTO;
        analysis: AnalysisDTO | null;
        files: RepositoryFileDTO[];
        bugs: BugFindingDTO[];
        docs: DocumentationDTO[];
      }>(`/api/repositories/${id}`),
    fileContent: (id: string, filePath: string) =>
      request<{
        path: string;
        language: string;
        lines: number;
        complexityScore: number;
        content: string;
      }>(`/api/repositories/${id}/file?path=${encodeURIComponent(filePath)}`),
    searchCode: (id: string, q: string) =>
      request<{ matches: FileSearchMatch[] }>(
        `/api/repositories/${id}/search?q=${encodeURIComponent(q)}`
      ),
    explainFile: (id: string, filePath: string) =>
      request<{ filePath: string; explanationMarkdown: string }>(
        `/api/repositories/${id}/explain-file`,
        {
          method: 'POST',
          body: JSON.stringify({ filePath }),
        }
      ),
    reanalyze: (id: string) =>
      request<{ repository: RepositoryDTO }>(`/api/repositories/${id}/reanalyze`, {
        method: 'POST',
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/repositories/${id}`, {
        method: 'DELETE',
      }),
  },

  architecture: {
    get: (repoId: string, refresh = false) =>
      request<{ intelligence: ArchitectureIntelligenceDTO }>(
        `/api/repositories/${repoId}/architecture${refresh ? '?refresh=1' : ''}`
      ),
    codeSlice: (
      repoId: string,
      params: { filePath?: string; moduleGroup?: string; limit?: number }
    ) => {
      const qs = new URLSearchParams();
      if (params.filePath) qs.set('filePath', params.filePath);
      if (params.moduleGroup) qs.set('moduleGroup', params.moduleGroup);
      if (params.limit) qs.set('limit', String(params.limit));
      return request<{ graph: LevelGraphDTO }>(
        `/api/repositories/${repoId}/architecture/code?${qs.toString()}`
      );
    },
    impact: (repoId: string, nodeId: string) =>
      request<{ impact: ImpactReportDTO }>(
        `/api/repositories/${repoId}/architecture/impact?nodeId=${encodeURIComponent(nodeId)}`
      ),
  },

  chat: {
    listConversations: (repoId: string) =>
      request<{ conversations: ConversationDTO[] }>(`/api/repositories/${repoId}/conversations`),
    createConversation: (repoId: string, title?: string) =>
      request<{ conversation: ConversationDTO }>(`/api/repositories/${repoId}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
    deleteConversation: (conversationId: string) =>
      request<{ ok: boolean }>(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      }),
    listMessages: (conversationId: string) =>
      request<{ messages: MessageDTO[] }>(`/api/conversations/${conversationId}/messages`),
    sendMessage: (conversationId: string, content: string, mode: ChatMode = 'qa') =>
      request<{ userMessage: MessageDTO; assistantMessage: MessageDTO }>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content, mode }),
        }
      ),
  },

  bugs: {
    list: (repoId: string) =>
      request<{ findings: BugFindingDTO[] }>(`/api/repositories/${repoId}/bugs`),
    scan: (repoId: string) =>
      request<{ findings: BugFindingDTO[] }>(`/api/repositories/${repoId}/bugs/scan`, {
        method: 'POST',
      }),
  },

  docs: {
    list: (repoId: string) =>
      request<{ docs: DocumentationDTO[] }>(`/api/repositories/${repoId}/docs`),
    generate: (repoId: string, type: DocType) =>
      request<{ doc: DocumentationDTO }>(`/api/repositories/${repoId}/docs/generate`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    update: (repoId: string, type: DocType, body: { title: string; content: string }) =>
      request<{ doc: DocumentationDTO }>(`/api/repositories/${repoId}/docs/${type}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },
};
