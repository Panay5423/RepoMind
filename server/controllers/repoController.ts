import type { Response } from 'express';
import { db } from '../models/store.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { DashboardOverviewDTO } from '../../shared/types.ts';
import {
  fetchGitHubRepositoryFiles,
  parseGitHubRepoInput,
  type RawRepoFile,
} from '../services/github/githubService.ts';
import { extractZipSafely } from '../services/repository/zipService.ts';
import { runRepositoryAnalysisPipeline } from '../services/ai/analyzerService.ts';

export async function getDashboardOverview(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const [repos, recentConvs] = await Promise.all([
      db.listRepositoriesByUser(userId),
      db.listRecentConversationsByUser(userId, 6),
    ]);

    const totalRepositories = repos.length;
    const totalFilesIndexed = repos.reduce((sum, r) => sum + (r.fileCount || 0), 0);
    const totalLinesIndexed = repos.reduce((sum, r) => sum + (r.totalLines || 0), 0);

    const langMap = new Map<string, number>();
    for (const r of repos) {
      for (const l of r.languages || []) {
        if (['JSON', 'Markdown', 'Config', 'Text'].includes(l.language)) continue;
        langMap.set(l.language, (langMap.get(l.language) || 0) + l.files);
      }
    }
    const languagesDetected = Array.from(langMap.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const repoMap = new Map(repos.map((r) => [r.id, r]));
    const recentConversations = recentConvs.map((c) => ({
      ...c,
      repositoryName: repoMap.get(c.repositoryId)?.fullName || 'Repository',
    }));

    const scoredRepos = repos.filter((r) => typeof r.healthScore === 'number');
    const averageHealthScore =
      scoredRepos.length > 0
        ? Math.round(
            scoredRepos.reduce((sum, r) => sum + (r.healthScore || 0), 0) / scoredRepos.length
          )
        : null;

    const overview: DashboardOverviewDTO = {
      totalRepositories,
      totalFilesIndexed,
      totalLinesIndexed,
      languagesDetected,
      recentConversations,
      recentRepositories: repos.slice(0, 6),
      averageHealthScore,
    };

    res.json(overview);
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    res.status(500).json({ error: 'Unable to load dashboard metrics.' });
  }
}

export async function listRepositories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const repos = await db.listRepositoriesByUser(req.user!.id);
  const search = String(req.query.q || '').trim().toLowerCase();
  const status = String(req.query.status || '').trim().toLowerCase();

  const filtered = repos.filter((r) => {
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search) ||
      r.fullName.toLowerCase().includes(search) ||
      r.primaryLanguage.toLowerCase().includes(search);
    const matchesStatus = !status || status === 'all' || r.status === status;
    return matchesSearch && matchesStatus;
  });

  res.json({ repositories: filtered });
}

export async function importGitHubRepository(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { repoInput } = req.body as { repoInput?: string };
    if (!repoInput || !repoInput.trim()) {
      res.status(400).json({ error: 'Repository URL or owner/repo is required.' });
      return;
    }

    const { owner, repo } = parseGitHubRepoInput(repoInput);
    const user = await db.findUserById(req.user!.id);

    const fetched = await fetchGitHubRepositoryFiles({
      owner,
      repo,
      token: user?.githubAccessToken,
    });

    const created = await db.createRepository({
      userId: req.user!.id,
      name: fetched.name,
      fullName: fetched.fullName,
      description: fetched.description,
      sourceType: 'github',
      githubUrl: fetched.htmlUrl,
      defaultBranch: fetched.defaultBranch,
      languages: [],
      primaryLanguage: 'Detecting...',
      fileCount: fetched.files.length,
      totalLines: 0,
      totalBytes: 0,
      status: 'indexing',
      progress: 8,
      progressStage: 'Queued for indexing & Gemini analysis',
    });

    // Background execution
    void runRepositoryAnalysisPipeline(created.id, fetched.files);

    res.status(202).json({ repository: created });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to import GitHub repository.',
    });
  }
}

export async function uploadZipRepository(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Please upload a .zip archive file.' });
      return;
    }

    const rawName = String(req.body?.name || file.originalname || 'uploaded-repo')
      .replace(/\.zip$/i, '')
      .trim();
    const description = String(req.body?.description || 'Uploaded ZIP source archive').trim();

    const extractedFiles = extractZipSafely(file.buffer);

    const created = await db.createRepository({
      userId: req.user!.id,
      name: rawName,
      fullName: rawName,
      description,
      sourceType: 'zip',
      languages: [],
      primaryLanguage: 'Detecting...',
      fileCount: extractedFiles.length,
      totalLines: 0,
      totalBytes: 0,
      status: 'indexing',
      progress: 8,
      progressStage: 'ZIP extracted securely; indexing files',
    });

    void runRepositoryAnalysisPipeline(created.id, extractedFiles);

    res.status(202).json({ repository: created });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to process uploaded ZIP archive.',
    });
  }
}

export async function getRepositoryDetail(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }

  const [analysis, files, bugs, docs] = await Promise.all([
    db.findAnalysisByRepo(repo.id),
    db.listRepositoryFiles(repo.id),
    db.listBugReports(repo.id),
    db.listDocumentation(repo.id),
  ]);

  res.json({
    repository: repo,
    analysis,
    files: files.map((f) => ({
      id: f.id,
      repositoryId: f.repositoryId,
      path: f.path,
      language: f.language,
      size: f.size,
      lines: f.lines,
      complexityScore: f.complexityScore,
      isImportant: f.isImportant,
      summary: f.summary,
    })),
    bugs,
    docs,
  });
}

export async function getRepositoryFileContent(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const filePath = String(req.query.path || '');
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }

  const files = await db.listRepositoryFiles(repo.id);
  const match = files.find((f) => f.path === filePath);
  if (!match) {
    res.status(404).json({ error: 'File not found in indexed repository.' });
    return;
  }

  // Reconstruct numbered content from chunks
  const lineMap = new Map<number, string>();
  for (const chunk of match.chunks) {
    const lines = chunk.content.split('\n');
    for (const rawLine of lines) {
      const m = rawLine.match(/^(\d+):\s?(.*)$/);
      if (m) {
        lineMap.set(Number(m[1]), m[2]);
      }
    }
  }
  const reconstructed = Array.from(lineMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, text]) => `${num}: ${text}`)
    .join('\n');

  res.json({
    path: match.path,
    language: match.language,
    lines: match.lines,
    complexityScore: match.complexityScore,
    content: reconstructed || match.chunks.map((c) => c.content).join('\n'),
  });
}

export async function reanalyzeRepository(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }

    let rawFiles: RawRepoFile[] = [];
    if (repo.sourceType === 'github') {
      const { owner, repo: repoName } = parseGitHubRepoInput(repo.fullName);
      const user = await db.findUserById(req.user!.id);
      const fetched = await fetchGitHubRepositoryFiles({
        owner,
        repo: repoName,
        token: user?.githubAccessToken,
      });
      rawFiles = fetched.files;
    } else {
      // Reconstruct raw files from stored chunks for ZIP repositories
      const storedFiles = await db.listRepositoryFiles(repo.id);
      rawFiles = storedFiles.map((f) => {
        const lineMap = new Map<number, string>();
        for (const c of f.chunks) {
          for (const line of c.content.split('\n')) {
            const m = line.match(/^(\d+):\s?(.*)$/);
            if (m) lineMap.set(Number(m[1]), m[2]);
          }
        }
        const content = Array.from(lineMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, txt]) => txt)
          .join('\n');
        return { path: f.path, content, size: f.size };
      });
    }

    if (rawFiles.length === 0) {
      res.status(400).json({ error: 'No source files available to re-analyze.' });
      return;
    }

    const updated = await db.updateRepository(repo.id, {
      status: 'indexing',
      progress: 5,
      progressStage: 'Restarting analysis pipeline',
      errorMessage: undefined,
    });

    void runRepositoryAnalysisPipeline(repo.id, rawFiles);
    res.status(202).json({ repository: updated });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to re-analyze repository.',
    });
  }
}

export async function deleteRepository(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }

  await db.deleteRepositoryCascade(repo.id);
  res.json({ ok: true });
}
