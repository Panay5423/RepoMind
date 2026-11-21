import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Code2,
  FolderGit2,
  GitBranch,
  Layers,
  MessageSquare,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import type { DashboardOverviewDTO } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import {
  AnimatedCounter,
  InteractiveCard,
  PRIMARY_BLUE_BTN,
  RM_EASE,
  SkeletonCard,
} from '../components/ui/PremiumPrimitives.tsx';

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

  const langBarColors = ['bg-[#2563EB]', 'bg-[#3B82F6]', 'bg-[#60A5FA]', 'bg-[#0B1F3A]'];

  return (
    <WorkspaceLayout
      breadcrumbs={[{ label: 'Dashboard' }]}
      actions={
        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.14 }}>
          <Link to="/repositories?import=open" className={`${PRIMARY_BLUE_BTN} h-9 px-3.5 text-[12px]`}>
            <Plus className="w-3.5 h-3.5" />
            <span>Import Repository</span>
          </Link>
        </motion.div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: RM_EASE }}
        className="space-y-8 relative"
      >
        {/* Welcome Hero Card */}
        <section className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white rm-ambient-mesh px-6 py-6 sm:px-7 sm:py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-12px_rgba(37,99,235,0.12)]">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#2563EB]">
                Engineering Workspace
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-[28px] font-bold tracking-tight bg-gradient-to-r from-[#0B1F3A] via-[#1D4ED8] to-[#3B82F6] bg-clip-text text-transparent">
                Welcome back, {user?.name}
              </h1>
              <p className="mt-1.5 text-[13px] text-[#475569] max-w-2xl">
                Repository indexing overview, language distribution, AST architecture graphs, and
                recent engineering threads.
              </p>
            </div>
            {user?.roleTitle && (
              <span className="font-mono text-[12px] font-medium text-[#475569] bg-white/90 border border-[#E2E8F0] px-3 py-1.5 rounded-xl shrink-0">
                {user.roleTitle}
              </span>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: user?.githubConnected
                ? `GitHub: @${user.githubUsername}`
                : 'Connect GitHub',
              subtitle: user?.githubConnected
                ? 'Browse & import private or public repos'
                : 'Authorize OAuth to browse your repositories',
              icon: GitBranch,
              iconBg: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]',
              onClick: () => void connectGitHub(),
            },
            {
              title: 'Upload Repository ZIP',
              subtitle: 'Securely extract & analyze local archives',
              icon: Upload,
              iconBg: 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0284C7]',
              onClick: () => navigate('/repositories?import=zip'),
            },
            {
              title: 'Analyze Codebase URL',
              subtitle: 'Paste any public GitHub repository URL',
              icon: FolderGit2,
              iconBg: 'bg-[#EFF6FF] border-[#DBEAFE] text-[#0B1F3A]',
              onClick: () => navigate('/repositories?import=url'),
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.title}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: idx * 0.05, ease: RM_EASE }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                onClick={item.onClick}
                className="group flex items-center justify-between p-5 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#93C5FD] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(37,99,235,0.06)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_14px_30px_-10px_rgba(37,99,235,0.16)] text-left transition-all"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-[14px] font-semibold text-[#0F172A] group-hover:text-[#2563EB] truncate transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1">{item.subtitle}</p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl border ${item.iconBg} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] p-4 text-[13px] font-medium text-[#E11D48]">
            {error}
          </div>
        )}

        {/* KPI Strip */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Repositories Analyzed',
                icon: FolderGit2,
                accent: 'from-[#2563EB] to-[#60A5FA]',
                value: data?.totalRepositories ?? 0,
                isScore: false,
              },
              {
                label: 'Total Files Indexed',
                icon: Layers,
                accent: 'from-[#3B82F6] to-[#93C5FD]',
                value: data?.totalFilesIndexed ?? 0,
                isScore: false,
              },
              {
                label: 'Lines Indexed',
                icon: Code2,
                accent: 'from-[#0284C7] to-[#38BDF8]',
                value: data?.totalLinesIndexed ?? 0,
                isScore: false,
              },
              {
                label: 'Avg Health Estimate',
                icon: Activity,
                accent: 'from-[#0B1F3A] to-[#2563EB]',
                value: data?.averageHealthScore ?? null,
                isScore: true,
              },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <InteractiveCard key={kpi.label} delay={0.06 + idx * 0.04} className="overflow-hidden p-5">
                  <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${kpi.accent}`} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono font-medium text-[#64748B]">{kpi.label}</p>
                    <Icon className="w-4 h-4 text-[#2563EB] shrink-0" />
                  </div>
                  <p className="mt-3 font-display text-2xl sm:text-[26px] font-bold text-[#0F172A] tabular-nums">
                    {kpi.isScore ? (
                      kpi.value !== null ? (
                        <AnimatedCounter value={kpi.value} suffix="/100" />
                      ) : (
                        '—'
                      )
                    ) : (
                      <AnimatedCounter value={kpi.value ?? 0} />
                    )}
                  </p>
                </InteractiveCard>
              );
            })}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Repository Activity */}
          <InteractiveCard hoverLift={false} className="lg:col-span-7 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[15px] font-semibold text-[#0F172A]">
                Recent Repository Activity
              </h2>
              <div className="flex items-center gap-3">
                {(data?.recentRepositories.length || 0) > 1 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={repoFilter}
                      onChange={(e) => setRepoFilter(e.target.value)}
                      placeholder="Filter..."
                      className="w-36 h-8 rounded-lg border border-[#E2E8F0] bg-white pl-7 pr-2.5 text-[12px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                )}
                <Link
                  to="/repositories"
                  className="text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  View all
                </Link>
              </div>
            </div>

            {!loading && (!data || data.recentRepositories.length === 0) ? (
              <div className="p-10 text-center">
                <p className="text-[15px] font-semibold text-[#0F172A]">No repositories indexed yet</p>
                <p className="mt-1.5 text-[13px] text-[#64748B] max-w-sm mx-auto">
                  Import a GitHub repository or upload a `.zip` archive to generate your first
                  multi-level architecture graph and AI code workspace.
                </p>
                <Link
                  to="/repositories?import=open"
                  className={`${PRIMARY_BLUE_BTN} mt-5 h-9 px-4 text-[12px]`}
                >
                  <span>Import First Repository</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#64748B]">
                No recent repositories match &ldquo;{repoFilter}&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {filteredRepos.map((repo, idx) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: idx * 0.03, ease: RM_EASE }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-[#EFF6FF]/45 transition-colors"
                  >
                    <Link to={`/repositories/${repo.id}`} className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-[#0F172A] hover:text-[#2563EB] truncate transition-colors">
                        {repo.fullName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#64748B] font-mono">
                        <span>{repo.primaryLanguage}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{repo.fileCount} files</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{repo.status}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono font-medium text-[#475569]">
                        <Link
                          to={`/repositories/${repo.id}?tab=architecture`}
                          className="hover:text-[#2563EB] transition-colors"
                        >
                          Graph
                        </Link>
                        <span className="text-[#CBD5E1]">·</span>
                        <Link
                          to={`/repositories/${repo.id}?tab=explorer`}
                          className="hover:text-[#2563EB] transition-colors"
                        >
                          Code
                        </Link>
                        <span className="text-[#CBD5E1]">·</span>
                        <Link
                          to={`/repositories/${repo.id}?tab=chat`}
                          className="hover:text-[#2563EB] transition-colors"
                        >
                          Chat
                        </Link>
                      </div>
                      {typeof repo.healthScore === 'number' ? (
                        <span className="font-mono text-[13px] font-bold text-[#0B1F3A] tabular-nums pl-3 border-l border-[#E2E8F0]">
                          {repo.healthScore}/100
                        </span>
                      ) : (
                        <span className="font-mono text-[12px] text-[#2563EB] font-semibold pl-3 border-l border-[#E2E8F0] tabular-nums">
                          {repo.progress}%
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </InteractiveCard>

          {/* Languages + Recent Conversations */}
          <div className="lg:col-span-5 space-y-6">
            <InteractiveCard hoverLift={false} className="overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/80">
                <h2 className="font-display text-[15px] font-semibold text-[#0F172A]">
                  Languages Detected
                </h2>
              </div>
              <div className="p-5">
                {!data || data.languagesDetected.length === 0 ? (
                  <p className="text-[13px] text-[#64748B]">
                    Language distribution appears after your first repository is indexed.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {data.languagesDetected.map((lang, idx) => (
                      <div key={lang.language}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="text-[#0F172A] font-semibold">{lang.language}</span>
                          <span className="font-mono text-[#64748B] tabular-nums">
                            {lang.count} files
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: 0.45,
                              delay: 0.1 + idx * 0.05,
                              ease: RM_EASE,
                            }}
                            className={`h-full rounded-full origin-left ${langBarColors[idx % langBarColors.length]}`}
                            style={{ width: `${Math.round((lang.count / maxLangCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </InteractiveCard>

            <InteractiveCard hoverLift={false} className="overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/80">
                <h2 className="font-display text-[15px] font-semibold text-[#0F172A]">
                  Recent AI Conversations
                </h2>
              </div>
              {!data || data.recentConversations.length === 0 ? (
                <div className="p-5 text-[13px] text-[#64748B]">
                  Start an AI Code Chat inside any repository workspace to trace code and ask
                  questions.
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {data.recentConversations.map((conv, idx) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: idx * 0.03, ease: RM_EASE }}
                    >
                      <Link
                        to={`/repositories/${conv.repositoryId}?tab=chat&conv=${conv.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#EFF6FF]/45 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#0F172A] truncate">
                              {conv.title}
                            </p>
                            <p className="text-[11px] font-mono text-[#64748B] truncate">
                              {conv.repositoryName}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-[#2563EB] shrink-0">
                          Open
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </InteractiveCard>
          </div>
        </div>
      </motion.div>
    </WorkspaceLayout>
  );
}
