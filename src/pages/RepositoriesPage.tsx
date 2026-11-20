import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ExternalLink,
  FolderGit2,
  GitBranch,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { RepositoryDTO } from '../../shared/types.ts';
import { api, type GitHubRepoItem } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';

type ImportTab = 'url' | 'github' | 'zip';

export function RepositoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, connectGitHub } = useAuth();
  const { notify } = useToast();

  const importParam = searchParams.get('import');
  const [showImport, setShowImport] = useState(Boolean(importParam));
  const [importTab, setImportTab] = useState<ImportTab>(
    importParam === 'zip' ? 'zip' : importParam === 'github' ? 'github' : 'url'
  );

  const [repos, setRepos] = useState<RepositoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'indexing' | 'failed'>('all');

  // Import state
  const [repoInput, setRepoInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipName, setZipName] = useState('');
  const [draggingZip, setDraggingZip] = useState(false);

  // GitHub OAuth Repo Picker
  const [ghStatus, setGhStatus] = useState<{ oauthConfigured: boolean; connected: boolean } | null>(
    null
  );
  const [ghRepos, setGhRepos] = useState<GitHubRepoItem[]>([]);
  const [loadingGhRepos, setLoadingGhRepos] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RepositoryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await api.repositories.list({ q: search, status: statusFilter });
      setRepos(res.repositories);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load repositories.', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, notify]);

  useEffect(() => {
    void fetchRepos();
  }, [fetchRepos]);

  // Poll while any repo is actively indexing/analyzing
  useEffect(() => {
    const hasActive = repos.some((r) => r.status === 'indexing' || r.status === 'analyzing');
    if (!hasActive) return;
    const timer = setInterval(() => {
      void fetchRepos();
    }, 2500);
    return () => clearInterval(timer);
  }, [repos, fetchRepos]);

  useEffect(() => {
    api.github
      .status()
      .then((s) => setGhStatus(s))
      .catch(() => {});
  }, [user?.githubConnected]);

  const loadGitHubRepos = async () => {
    setLoadingGhRepos(true);
    try {
      const res = await api.github.repos();
      setGhRepos(res.repos);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not fetch GitHub repos.', 'error');
    } finally {
      setLoadingGhRepos(false);
    }
  };

  useEffect(() => {
    if (showImport && importTab === 'github' && user?.githubConnected && ghRepos.length === 0) {
      void loadGitHubRepos();
    }
  }, [showImport, importTab, user?.githubConnected]);

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setImporting(true);
    try {
      const res = await api.repositories.importGitHub(repoInput.trim());
      notify(`Started indexing ${res.repository.fullName}.`, 'success');
      setRepoInput('');
      setShowImport(false);
      navigate(`/repositories/${res.repository.id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImportSample = async (slug: string) => {
    setImporting(true);
    try {
      const res = await api.repositories.importGitHub(slug);
      notify(`Started indexing ${res.repository.fullName}.`, 'success');
      navigate(`/repositories/${res.repository.id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleUploadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) {
      notify('Please select a .zip archive to upload.', 'error');
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.append('archive', zipFile);
      if (zipName.trim()) form.append('name', zipName.trim());
      const res = await api.repositories.uploadZip(form);
      notify(`Uploaded & started analyzing ${res.repository.name}.`, 'success');
      setZipFile(null);
      setZipName('');
      navigate(`/repositories/${res.repository.id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ZIP upload failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleReanalyze = async (repo: RepositoryDTO) => {
    try {
      await api.repositories.reanalyze(repo.id);
      notify(`Re-analyzing ${repo.fullName}...`, 'info');
      void fetchRepos();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to re-analyze.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.repositories.delete(deleteTarget.id);
      notify(`Removed ${deleteTarget.fullName} from RepoMind.`, 'info');
      setDeleteTarget(null);
      void fetchRepos();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <WorkspaceLayout
      breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Repositories' }]}
      actions={
        <button
          type="button"
          onClick={() => {
            setShowImport((v) => !v);
            if (searchParams.has('import')) setSearchParams({});
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showImport ? 'Close Import Panel' : 'Add Repository'}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Import Drawer/Panel */}
        {showImport && (
          <section className="rounded-xl border border-blue-500/30 bg-[#111827] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  Connect or Upload a Repository
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Source files are extracted safely, scanned for credentials, chunked, and indexed
                  with Gemini embeddings.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0B0F19] border border-white/[0.08] shrink-0">
                <button
                  type="button"
                  onClick={() => setImportTab('url')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    importTab === 'url'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GitHub URL
                </button>
                <button
                  type="button"
                  onClick={() => setImportTab('github')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    importTab === 'github'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My GitHub
                </button>
                <button
                  type="button"
                  onClick={() => setImportTab('zip')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    importTab === 'zip'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upload ZIP
                </button>
              </div>
            </div>

            {importTab === 'url' && (
              <div className="pt-5 space-y-4">
                <form onSubmit={handleImportUrl} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="https://github.com/owner/repo or owner/repo (e.g. honojs/hono)"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0B0F19] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={importing}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {importing ? 'Fetching & Queuing...' : 'Analyze Repository'}
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Try a real public repo:</span>
                  {['honojs/hono', 'expressjs/express', 'pallets/flask'].map((slug) => (
                    <button
                      key={slug}
                      type="button"
                      disabled={importing}
                      onClick={() => void handleImportSample(slug)}
                      className="font-mono text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50"
                    >
                      {slug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {importTab === 'github' && (
              <div className="pt-5">
                {!user?.githubConnected ? (
                  <div className="rounded-lg border border-white/[0.08] bg-[#0B0F19] p-6 text-center">
                    <GitBranch className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">
                      Connect your GitHub account
                    </p>
                    <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                      {ghStatus?.oauthConfigured
                        ? 'Authorize read-only access via GitHub OAuth to browse and analyze your personal and organization repositories.'
                        : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server to enable GitHub OAuth, or import any public repository directly using the GitHub URL tab.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void connectGitHub()}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                    >
                      <GitBranch className="w-4 h-4" />
                      <span>Authorize GitHub OAuth</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        Signed in as <span className="text-white font-medium">@{user.githubUsername}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadGitHubRepos()}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Refresh list
                      </button>
                    </div>
                    {loadingGhRepos ? (
                      <div className="h-32 rounded-lg bg-[#0B0F19] animate-pulse" />
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#0B0F19]">
                        {ghRepos.map((gr) => (
                          <div
                            key={gr.id}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {gr.fullName}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {gr.language} · {gr.private ? 'Private' : 'Public'}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={importing}
                              onClick={() => void handleImportSample(gr.fullName)}
                              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shrink-0"
                            >
                              Import
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {importTab === 'zip' && (
              <form onSubmit={handleUploadZip} className="pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Project Name (optional)
                    </label>
                    <input
                      type="text"
                      value={zipName}
                      onChange={(e) => setZipName(e.target.value)}
                      placeholder="my-service-backend"
                      className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Source Archive (.zip, max 25 MB)
                    </label>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDraggingZip(true);
                      }}
                      onDragLeave={() => setDraggingZip(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDraggingZip(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped && dropped.name.toLowerCase().endsWith('.zip')) {
                          setZipFile(dropped);
                        } else {
                          notify('Please drop a valid .zip archive.', 'error');
                        }
                      }}
                      className={`flex items-center gap-3 w-full rounded-lg border border-dashed px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        draggingZip
                          ? 'border-blue-400 bg-blue-500/10 text-white'
                          : 'border-white/20 bg-[#0B0F19] text-slate-300 hover:border-blue-500/60'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate">
                        {zipFile
                          ? `${zipFile.name} (${(zipFile.size / 1024).toFixed(0)} KB)`
                          : 'Drop .zip here or click to browse'}
                      </span>
                      <input
                        type="file"
                        accept=".zip,application/zip"
                        className="sr-only"
                        onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={importing || !zipFile}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {importing ? 'Extracting & Uploading...' : 'Upload & Analyze ZIP'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories by name or language..."
              className="w-full rounded-lg border border-white/10 bg-[#111827] pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.08]">
            {([
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'indexing', label: 'In Progress' },
              { id: 'failed', label: 'Failed' },
            ] as const).map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => setStatusFilter(status.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === status.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Repository List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse"
              />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-12 text-center">
            <FolderGit2 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No repositories found</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              Import a repository from GitHub or upload a ZIP archive to inspect architecture, bugs,
              documentation, and chat with your codebase.
            </p>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Repository</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-[#111827] divide-y divide-white/[0.06]">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.015] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/repositories/${repo.id}`}
                      className="font-display text-base font-semibold text-white hover:text-blue-400 transition-colors truncate"
                    >
                      {repo.fullName}
                    </Link>
                    {repo.githubUrl && (
                      <a
                        href={repo.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-sm text-slate-400 line-clamp-1">{repo.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
                    <span>{repo.primaryLanguage}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{repo.fileCount} files</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{repo.totalLines.toLocaleString()} lines</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        repo.status === 'completed'
                          ? 'text-emerald-400'
                          : repo.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-blue-400'
                      }
                    >
                      {repo.status === 'completed'
                        ? 'Analyzed'
                        : repo.status === 'failed'
                        ? 'Failed'
                        : `${repo.progressStage} (${repo.progress}%)`}
                    </span>
                    {repo.lastAnalyzedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(repo.lastAnalyzedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  {(repo.status === 'indexing' || repo.status === 'analyzing') && (
                    <div className="mt-2.5 h-1.5 w-full max-w-md rounded-full bg-[#0B0F19] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                        style={{ width: `${repo.progress}%` }}
                      />
                    </div>
                  )}
                  {repo.status === 'failed' && repo.errorMessage && (
                    <p className="mt-1.5 text-xs text-rose-300/90 line-clamp-1">
                      {repo.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {typeof repo.healthScore === 'number' && (
                    <div className="text-right pr-2">
                      <div className="text-[11px] text-slate-500">Health</div>
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {repo.healthScore}/100
                      </div>
                    </div>
                  )}

                  <Link
                    to={`/repositories/${repo.id}`}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Open Workspace
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleReanalyze(repo)}
                    title="Re-analyze repository"
                    className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(repo)}
                    title="Remove repository"
                    className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove repository from RepoMind?"
        description={`This will permanently delete "${deleteTarget?.fullName}" along with its indexed chunks, architecture analysis, AI conversations, bug findings, and generated docs.`}
        confirmLabel="Remove Repository"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </WorkspaceLayout>
  );
}
