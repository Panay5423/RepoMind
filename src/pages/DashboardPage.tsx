import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FolderGit2,
  GitBranch,
  MessageSquare,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import type { DashboardOverviewDTO } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';

export function DashboardPage() {
  const { user, connectGitHub } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repoFilter, setRepoFilter] = useState('');

  useEffect(() => {
    let active = true;
    api.dashboard
      .overview()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxLangCount =
    data?.languagesDetected.reduce((m, l) => Math.max(m, l.count), 1) || 1;

  const filteredRepos = (data?.recentRepositories || []).filter((repo) => {
    const q = repoFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      repo.fullName.toLowerCase().includes(q) ||
      repo.primaryLanguage.toLowerCase().includes(q)
    );
  });

  return (
    <WorkspaceLayout
      breadcrumbs={[{ label: 'Dashboard' }]}
      actions={
        <Link
          to="/repositories?import=open"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Import Repository</span>
        </Link>
      }
    >
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Repository indexing summary, detected languages, and recent engineering conversations.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => void connectGitHub()}
            className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-[#111827] hover:border-violet-500/40 text-left transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {user?.githubConnected ? `GitHub: @${user.githubUsername}` : 'Connect GitHub'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {user?.githubConnected
                  ? 'Browse & import private or public repos'
                  : 'Authorize OAuth to browse your repositories'}
              </p>
            </div>
            <GitBranch className="w-5 h-5 text-violet-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/repositories?import=zip')}
            className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-[#111827] hover:border-blue-500/40 text-left transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-white">Upload Repository ZIP</p>
              <p className="text-xs text-slate-400 mt-1">
                Securely extract & analyze local archives
              </p>
            </div>
            <Upload className="w-5 h-5 text-blue-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/repositories?import=url')}
            className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-[#111827] hover:border-emerald-500/40 text-left transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-white">Analyze Codebase URL</p>
              <p className="text-xs text-slate-400 mt-1">
                Paste any public GitHub repository URL
              </p>
            </div>
            <FolderGit2 className="w-5 h-5 text-emerald-400 shrink-0" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* KPI Strip */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/[0.08] border-t-blue-500/40 bg-[#111827] p-5">
              <p className="text-xs text-slate-400">Repositories Analyzed</p>
              <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
                {data?.totalRepositories ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] border-t-violet-500/40 bg-[#111827] p-5">
              <p className="text-xs text-slate-400">Total Files Indexed</p>
              <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
                {(data?.totalFilesIndexed ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] border-t-cyan-500/40 bg-[#111827] p-5">
              <p className="text-xs text-slate-400">Lines Indexed</p>
              <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
                {(data?.totalLinesIndexed ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] border-t-emerald-500/40 bg-[#111827] p-5">
              <p className="text-xs text-slate-400">Avg Health Estimate</p>
              <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
                {data?.averageHealthScore !== null && data?.averageHealthScore !== undefined
                  ? `${data.averageHealthScore}/100`
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Main Grid: Recent Repositories + Languages & Conversations */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Repository Activity */}
          <section className="lg:col-span-7 rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-white">
                Recent Repository Activity
              </h2>
              <div className="flex items-center gap-3">
                {(data?.recentRepositories.length || 0) > 1 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={repoFilter}
                      onChange={(e) => setRepoFilter(e.target.value)}
                      placeholder="Filter..."
                      className="w-36 rounded-md border border-white/10 bg-[#0B0F19] pl-7 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
                <Link
                  to="/repositories"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all
                </Link>
              </div>
            </div>

            {!loading && (!data || data.recentRepositories.length === 0) ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-200">No repositories indexed yet</p>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  Import a public GitHub repository or upload a `.zip` archive to generate your
                  first architecture graph and AI code workspace.
                </p>
                <Link
                  to="/repositories?import=open"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <span>Import First Repository</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent repositories match "{repoFilter}".
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <Link to={`/repositories/${repo.id}`} className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white hover:text-blue-400 truncate transition-colors">
                        {repo.fullName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <span>{repo.primaryLanguage}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{repo.fileCount} files</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{repo.status}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <Link
                          to={`/repositories/${repo.id}?tab=explorer`}
                          className="hover:text-blue-300 transition-colors"
                        >
                          Code
                        </Link>
                        <span className="text-slate-600">·</span>
                        <Link
                          to={`/repositories/${repo.id}?tab=chat`}
                          className="hover:text-blue-300 transition-colors"
                        >
                          Chat
                        </Link>
                        <span className="text-slate-600">·</span>
                        <Link
                          to={`/repositories/${repo.id}?tab=bugs`}
                          className="hover:text-blue-300 transition-colors"
                        >
                          Bugs
                        </Link>
                      </div>
                      {typeof repo.healthScore === 'number' ? (
                        <span className="font-mono text-sm font-semibold text-slate-200 tabular-nums pl-2 border-l border-white/[0.08]">
                          {repo.healthScore}/100
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 pl-2 border-l border-white/[0.08] tabular-nums">
                          {repo.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Languages + Recent Conversations */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5">
              <h2 className="font-display text-base font-semibold text-white mb-4">
                Languages Detected
              </h2>
              {!data || data.languagesDetected.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Language distribution appears after your first repository is indexed.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.languagesDetected.map((lang) => (
                    <div key={lang.language}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-200 font-medium">{lang.language}</span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {lang.count} files
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#0B0F19] overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((lang.count / maxLangCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.08]">
                <h2 className="font-display text-base font-semibold text-white">
                  Recent AI Conversations
                </h2>
              </div>
              {!data || data.recentConversations.length === 0 ? (
                <div className="p-5 text-xs text-slate-400">
                  Start an AI Code Chat inside any repository workspace to trace code and ask
                  questions.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {data.recentConversations.map((conv) => (
                    <Link
                      key={conv.id}
                      to={`/repositories/${conv.repositoryId}?tab=chat&conv=${conv.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 truncate">{conv.title}</p>
                          <p className="text-xs text-slate-500 truncate">{conv.repositoryName}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">Open</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
