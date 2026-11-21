import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
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
import {
  PRIMARY_BLUE_BTN,
  RM_EASE,
  SECONDARY_WHITE_BTN,
  SkeletonCard,
} from '../components/ui/PremiumPrimitives.tsx';

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

  const [repoInput, setRepoInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipName, setZipName] = useState('');
  const [draggingZip, setDraggingZip] = useState(false);

  const [ghStatus, setGhStatus] = useState<{ oauthConfigured: boolean; connected: boolean } | null>(
    null
  );
  const [ghRepos, setGhRepos] = useState<GitHubRepoItem[]>([]);
  const [loadingGhRepos, setLoadingGhRepos] = useState(false);

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
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.14 }}
          onClick={() => {
            setShowImport((v) => !v);
            if (searchParams.has('import')) setSearchParams({});
          }}
          className={`${PRIMARY_BLUE_BTN} h-9 px-3.5 text-[12px]`}
        >
          <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${showImport ? 'rotate-45' : ''}`} />
          <span>{showImport ? 'Close Import Panel' : 'Add Repository'}</span>
        </motion.button>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: RM_EASE }}
        className="space-y-6"
      >
        {/* Import Panel */}
        <AnimatePresence>
          {showImport && (
            <motion.section
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: RM_EASE }}
              className="rounded-2xl border border-[#BFDBFE] bg-white shadow-[0_12px_32px_-12px_rgba(37,99,235,0.16)] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E2E8F0] bg-gradient-to-r from-[#F8FAFC] to-[#EFF6FF]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-[15px] font-semibold text-[#0F172A]">
                    Connect or Upload a Repository
                  </h2>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    Source files are extracted safely, scanned for credentials, parsed into AST
                    graphs, and indexed.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                  {(
                    [
                      { id: 'url', label: 'GitHub URL' },
                      { id: 'github', label: 'My GitHub' },
                      { id: 'zip', label: 'Upload ZIP' },
                    ] as const
                  ).map((tab) => {
                    const active = importTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setImportTab(tab.id)}
                        className={`relative px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                          active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="repo-import-tab"
                            transition={{ duration: 0.16, ease: RM_EASE }}
                            className="absolute inset-0 rounded-lg bg-white border border-[#BFDBFE] shadow-2xs"
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6">
                <AnimatePresence mode="wait">
                  {importTab === 'url' && (
                    <motion.div
                      key="tab-url"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: RM_EASE }}
                      className="space-y-4"
                    >
                      <form onSubmit={handleImportUrl} className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          required
                          value={repoInput}
                          onChange={(e) => setRepoInput(e.target.value)}
                          placeholder="https://github.com/owner/repo or owner/repo (e.g. honojs/hono)"
                          className="flex-1 h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        />
                        <motion.button
                          type="submit"
                          whileTap={{ scale: 0.985 }}
                          disabled={importing}
                          className={`${PRIMARY_BLUE_BTN} h-10 px-5 text-[13px]`}
                        >
                          {importing ? 'Fetching & Queuing...' : 'Analyze Repository'}
                        </motion.button>
                      </form>

                      <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#64748B]">
                        <span>Try a real public repo:</span>
                        {['honojs/hono', 'expressjs/express', 'pallets/flask'].map((slug) => (
                          <button
                            key={slug}
                            type="button"
                            disabled={importing}
                            onClick={() => void handleImportSample(slug)}
                            className="font-mono font-medium text-[#2563EB] hover:text-[#1D4ED8] underline underline-offset-2 disabled:opacity-50"
                          >
                            {slug}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {importTab === 'github' && (
                    <motion.div
                      key="tab-github"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: RM_EASE }}
                    >
                      {!user?.githubConnected ? (
                        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center">
                          <GitBranch className="w-6 h-6 text-[#2563EB] mx-auto mb-2" />
                          <p className="text-[14px] font-semibold text-[#0F172A]">
                            Connect your GitHub account
                          </p>
                          <p className="mt-1 text-[12px] text-[#64748B] max-w-md mx-auto">
                            {ghStatus?.oauthConfigured
                              ? 'Authorize read-only access via GitHub OAuth to browse and analyze your personal and organization repositories.'
                              : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server to enable GitHub OAuth, or import any public repository directly using the GitHub URL tab.'}
                          </p>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => void connectGitHub()}
                            className={`${PRIMARY_BLUE_BTN} mt-4 h-9 px-4 text-[12px]`}
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span>Authorize GitHub OAuth</span>
                          </motion.button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] text-[#64748B]">
                              Signed in as{' '}
                              <span className="text-[#0F172A] font-mono font-semibold">
                                @{user.githubUsername}
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={() => void loadGitHubRepos()}
                              className="text-[12px] font-medium text-[#2563EB] hover:underline"
                            >
                              Refresh list
                            </button>
                          </div>
                          {loadingGhRepos ? (
                            <SkeletonCard className="h-32" />
                          ) : (
                            <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
                              {ghRepos.map((gr) => (
                                <div
                                  key={gr.id}
                                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#EFF6FF]/50 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                                      {gr.fullName}
                                    </p>
                                    <p className="text-[11px] font-mono text-[#64748B] truncate">
                                      {gr.language} · {gr.private ? 'Private' : 'Public'} ·{' '}
                                      {gr.defaultBranch}
                                    </p>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    disabled={importing}
                                    onClick={() => void handleImportSample(gr.fullName)}
                                    className={`${PRIMARY_BLUE_BTN} h-8 px-3 text-[12px]`}
                                  >
                                    Import
                                  </motion.button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {importTab === 'zip' && (
                    <motion.form
                      key="tab-zip"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: RM_EASE }}
                      onSubmit={handleUploadZip}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] font-medium text-[#475569] mb-1.5">
                            Project Name (optional)
                          </label>
                          <input
                            type="text"
                            value={zipName}
                            onChange={(e) => setZipName(e.target.value)}
                            placeholder="my-service-backend"
                            className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[#475569] mb-1.5">
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
                            className={`flex items-center gap-3 w-full h-10 rounded-xl border border-dashed px-4 text-[13px] cursor-pointer transition-all ${
                              draggingZip
                                ? 'border-[#2563EB] bg-[#EFF6FF] text-[#0B1F3A]'
                                : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] hover:border-[#2563EB]'
                            }`}
                          >
                            <Upload className="w-4 h-4 text-[#2563EB] shrink-0" />
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
                        <motion.button
                          type="submit"
                          whileTap={{ scale: 0.985 }}
                          disabled={importing || !zipFile}
                          className={`${PRIMARY_BLUE_BTN} h-10 px-5 text-[13px]`}
                        >
                          {importing ? 'Extracting & Uploading...' : 'Upload & Analyze ZIP'}
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories by name or language..."
              className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-white pl-10 pr-4 text-[13px] text-[#0F172A] placeholder-[#94A3B8] shadow-2xs focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
            {([
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'indexing', label: 'In Progress' },
              { id: 'failed', label: 'Failed' },
            ] as const).map((status) => {
              const active = statusFilter === status.id;
              return (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setStatusFilter(status.id)}
                  className={`relative px-3.5 py-1.5 text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="repo-status-filter"
                      transition={{ duration: 0.16, ease: RM_EASE }}
                      className="absolute inset-0 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]"
                    />
                  )}
                  <span className="relative z-10">{status.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Repository List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <SkeletonCard key={n} className="h-24" />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: RM_EASE }}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mx-auto mb-3">
              <FolderGit2 className="w-6 h-6 text-[#2563EB]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#0F172A]">No repositories found</h3>
            <p className="mt-1.5 text-[13px] text-[#64748B] max-w-md mx-auto">
              Import a repository from GitHub or upload a ZIP archive to inspect architecture, bugs,
              documentation, and chat with your codebase.
            </p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowImport(true)}
              className={`${PRIMARY_BLUE_BTN} mt-5 h-9 px-4 text-[12px]`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Repository</span>
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {repos.map((repo, idx) => (
              <motion.div
                key={repo.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.2), ease: RM_EASE }}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_22px_-12px_rgba(37,99,235,0.08)] hover:border-[#93C5FD] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_14px_28px_-10px_rgba(37,99,235,0.16)] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Link
                      to={`/repositories/${repo.id}`}
                      className="font-display text-[16px] font-bold text-[#0F172A] hover:text-[#2563EB] transition-colors truncate"
                    >
                      {repo.fullName}
                    </Link>
                    {repo.githubUrl && (
                      <a
                        href={repo.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#64748B] hover:text-[#2563EB] transition-colors"
                        title="Open on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-[13px] text-[#475569] line-clamp-1">{repo.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748B] font-mono">
                    <span className="text-[#0F172A] font-medium">{repo.primaryLanguage}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{repo.fileCount} files</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{repo.totalLines.toLocaleString()} lines</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        repo.status === 'completed'
                          ? 'text-[#059669] font-semibold'
                          : repo.status === 'failed'
                            ? 'text-[#E11D48] font-semibold'
                            : 'text-[#2563EB] font-semibold'
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
                    <div className="mt-2.5 h-1.5 w-full max-w-md rounded-full bg-[#EFF6FF] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all duration-300"
                        style={{ width: `${repo.progress}%` }}
                      />
                    </div>
                  )}
                  {repo.status === 'failed' && repo.errorMessage && (
                    <p className="mt-1.5 text-[12px] text-[#E11D48] line-clamp-1">
                      {repo.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {typeof repo.healthScore === 'number' && (
                    <div className="text-right pr-2">
                      <div className="text-[10px] font-mono text-[#64748B]">Health</div>
                      <div className="font-mono text-[14px] font-bold text-[#0B1F3A] tabular-nums">
                        {repo.healthScore}/100
                      </div>
                    </div>
                  )}

                  <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.14 }}>
                    <Link
                      to={`/repositories/${repo.id}`}
                      className={`${PRIMARY_BLUE_BTN} h-9 px-3.5 text-[12px]`}
                    >
                      Open Workspace
                    </Link>
                  </motion.div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94, rotate: 90 }}
                    onClick={() => void handleReanalyze(repo)}
                    title="Re-analyze repository"
                    className={`${SECONDARY_WHITE_BTN} h-9 w-9 p-0`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#475569]" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setDeleteTarget(repo)}
                    title="Remove repository"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#E11D48] hover:border-[#FECDD3] hover:bg-[#FFF1F2] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

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
