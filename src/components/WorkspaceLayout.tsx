import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  GitFork,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Network,
  Plus,
  Search,
  Settings2,
  X,
  XCircle,
} from 'lucide-react';
import type { RepositoryDTO } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { AccountModal } from './AccountModal.tsx';
import { PRIMARY_BLUE_BTN, RM_EASE } from './ui/PremiumPrimitives.tsx';

interface WorkspaceLayoutProps {
  breadcrumbs: Array<{ label: string; to?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function WorkspaceLayout({ breadcrumbs, actions, children }: WorkspaceLayoutProps) {
  const { user, logout, connectGitHub } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Real repository quick-search & activity notifications backed by /api/repositories
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [repos, setRepos] = useState<RepositoryDTO[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const loadWorkspaceRepos = async () => {
    setReposLoading(true);
    try {
      const res = await api.repositories.list();
      setRepos(res.repositories);
    } catch {
      // Keep previous list if offline/transient
    } finally {
      setReposLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaceRepos();
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        // Yield when inside Architecture Graph's canvas search shortcut if user already focused it
        if (tag === 'input' || tag === 'textarea') return;
        if (!location.search.includes('tab=architecture')) {
          e.preventDefault();
          setNotifOpen(false);
          setSearchOpen(true);
          void loadWorkspaceRepos();
          setTimeout(() => searchInputRef.current?.focus(), 40);
        }
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [location.search]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchOpen && searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (notifOpen && notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [searchOpen, notifOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
  ];

  const initials = (user?.name || 'RM')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const filteredRepos = repos
    .filter((repo) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        repo.fullName.toLowerCase().includes(q) ||
        repo.name.toLowerCase().includes(q) ||
        (repo.primaryLanguage || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  const activeIndexingCount = repos.filter(
    (r) => r.status === 'pending' || r.status === 'indexing' || r.status === 'analyzing'
  ).length;
  const recentActivityRepos = repos.slice(0, 5);

  const renderSidebar = (isMobile = false) => (
    <div className="flex h-full flex-col justify-between bg-white border-r border-[#E2E8F0] w-[256px]">
      <div>
        <div className="flex items-center justify-between h-14 px-5 border-b border-[#E2E8F0] bg-gradient-to-r from-white to-[#EFF6FF]/60">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 font-display text-[16px] font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0 group"
          >
            <motion.span
              whileHover={{ rotate: -8, scale: 1.05 }}
              transition={{ duration: 0.16, ease: RM_EASE }}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] shadow-sm shadow-[#2563EB]/25 flex items-center justify-center"
            >
              <GitFork className="w-4 h-4 text-white" />
            </motion.span>
            <span>RepoMind</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F8FAFC]"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 space-y-1">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
            Workspace
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 h-10 px-3.5 rounded-xl text-[13px] font-medium transition-colors whitespace-nowrap ${
                  active ? 'text-[#2563EB] font-semibold' : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                {active && !isMobile && (
                  <motion.span
                    layoutId="sidebar-active-nav"
                    transition={{ duration: 0.2, ease: RM_EASE }}
                    className="absolute inset-0 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] shadow-2xs"
                  />
                )}
                {active && isMobile && (
                  <span className="absolute inset-0 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]" />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 shrink-0 ${
                    active ? 'text-[#2563EB]' : 'text-[#64748B]'
                  }`}
                />
                <span className="relative z-10">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="px-3.5 pt-1">
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.14 }}
            onClick={() => {
              setMobileOpen(false);
              navigate('/repositories?import=open');
            }}
            className={`${PRIMARY_BLUE_BTN} w-full h-10 px-3.5 text-[13px]`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Analyze Codebase</span>
          </motion.button>
        </div>
      </div>

      <div className="p-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC]/70 space-y-2.5">
        {user?.githubConnected ? (
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.14 }}
            onClick={() => setAccountOpen(true)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#93C5FD] shadow-2xs transition-all"
          >
            <div className="flex items-center gap-2 text-[12px] text-[#0F172A]">
              <GitBranch className="w-3.5 h-3.5 text-[#059669] shrink-0" />
              <span className="truncate font-mono font-semibold">@{user.githubUsername}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#64748B]">GitHub OAuth connected</p>
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.14 }}
            onClick={() => void connectGitHub()}
            className="w-full h-9 flex items-center justify-center gap-2 px-3 rounded-xl text-[12px] font-medium text-[#0F172A] border border-[#E2E8F0] bg-white hover:border-[#93C5FD] hover:bg-[#EFF6FF]/60 shadow-2xs transition-all whitespace-nowrap"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span>Connect GitHub</span>
          </motion.button>
        )}

        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex items-center gap-2.5 min-w-0 text-left group"
            title="Account & security settings"
          >
            {user?.githubAvatarUrl ? (
              <img
                src={user.githubAvatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl border border-[#E2E8F0] object-cover shrink-0 transition-transform duration-150 group-hover:scale-105"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0 transition-transform duration-150 group-hover:scale-105">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F172A] group-hover:text-[#2563EB] truncate transition-colors">
                {user?.name}
              </p>
              <p className="text-[11px] text-[#64748B] truncate">
                {user?.roleTitle || user?.email}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setAccountOpen(true)}
              className="p-1.5 text-[#64748B] hover:text-[#2563EB] rounded-lg hover:bg-white transition-colors"
              title="Account settings"
              aria-label="Account settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => void handleLogout()}
              className="p-1.5 text-[#64748B] hover:text-[#E11D48] rounded-lg hover:bg-white transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">{renderSidebar(false)}</aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-[#0B1F3A]/35 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{ duration: 0.22, ease: RM_EASE }}
              className="relative z-10 h-full shadow-2xl"
            >
              {renderSidebar(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 border-b border-[#E2E8F0] bg-white/85 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-xl transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.label}>
                  {i > 0 && <span className="text-[#94A3B8]">/</span>}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="text-[#64748B] hover:text-[#2563EB] transition-colors truncate whitespace-nowrap font-medium"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#0F172A] font-semibold truncate whitespace-nowrap">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}

            {/* Real Workspace Quick Search */}
            <div ref={searchContainerRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(false);
                  setSearchOpen((v) => !v);
                  void loadWorkspaceRepos();
                  setTimeout(() => searchInputRef.current?.focus(), 40);
                }}
                className="h-9 inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#93C5FD] px-2.5 sm:px-3 text-[12px] text-[#64748B] hover:text-[#0F172A] transition-all whitespace-nowrap shrink-0"
                title="Jump to repository or architecture graph"
                aria-label="Quick search repositories"
              >
                <Search className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="hidden md:inline">Quick jump</span>
                <kbd className="hidden lg:inline-block rounded bg-white border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-mono text-[#64748B]">
                  ⌘K
                </kbd>
              </button>

              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: RM_EASE }}
                    className="absolute right-0 top-11 w-[320px] sm:w-[360px] rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_48px_-12px_rgba(11,31,58,0.18)] overflow-hidden z-50"
                  >
                    <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
                      <Search className="w-4 h-4 text-[#2563EB] shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search repositories or languages..."
                        className="flex-1 bg-transparent text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="p-0.5 text-[#64748B] hover:text-[#0F172A]"
                          aria-label="Clear quick search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9]">
                      {reposLoading && repos.length === 0 ? (
                        <div className="p-4 flex items-center gap-2 text-[12px] text-[#64748B]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                          <span>Loading repositories...</span>
                        </div>
                      ) : filteredRepos.length === 0 ? (
                        <div className="p-4 text-[12px] text-[#64748B] text-center">
                          No indexed repositories match &ldquo;{searchQuery}&rdquo;.
                        </div>
                      ) : (
                        filteredRepos.map((repo) => (
                          <div
                            key={repo.id}
                            className="px-3.5 py-2.5 hover:bg-[#EFF6FF]/60 transition-colors flex items-center justify-between gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                navigate(`/repositories/${repo.id}`);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                                {repo.fullName}
                              </p>
                              <p className="text-[11px] font-mono text-[#64748B] truncate tabular-nums">
                                {repo.primaryLanguage || 'Mixed'} · {repo.fileCount} files ·{' '}
                                {repo.status}
                              </p>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  navigate(`/repositories/${repo.id}?tab=architecture`);
                                }}
                                title="Open Architecture Graph"
                                className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:border-[#93C5FD] text-[#2563EB] transition-colors"
                              >
                                <Network className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  navigate(`/repositories/${repo.id}`);
                                }}
                                title="Open Workspace"
                                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A]"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Real Indexing Activity Notifications */}
            <div ref={notifContainerRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setNotifOpen((v) => !v);
                  void loadWorkspaceRepos();
                }}
                className="relative h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#93C5FD] text-[#475569] hover:text-[#2563EB] transition-all shrink-0"
                title="Indexing & analysis activity"
                aria-label="Indexing activity notifications"
              >
                <Bell className="w-4 h-4" />
                {activeIndexingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {activeIndexingCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: RM_EASE }}
                    className="absolute right-0 top-11 w-[310px] sm:w-[340px] rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_48px_-12px_rgba(11,31,58,0.18)] overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#0F172A] flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Repository Analysis Activity</span>
                      </span>
                      <Link
                        to="/repositories"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] font-medium text-[#2563EB] hover:underline"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9]">
                      {recentActivityRepos.length === 0 ? (
                        <div className="p-4 text-[12px] text-[#64748B] text-center">
                          No repository activity recorded yet.
                        </div>
                      ) : (
                        recentActivityRepos.map((repo) => {
                          const isBusy =
                            repo.status === 'pending' ||
                            repo.status === 'indexing' ||
                            repo.status === 'analyzing';
                          const isFailed = repo.status === 'failed';
                          return (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => {
                                setNotifOpen(false);
                                navigate(`/repositories/${repo.id}`);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#EFF6FF]/60 transition-colors flex items-start gap-2.5"
                            >
                              {isBusy ? (
                                <Loader2 className="w-4 h-4 text-[#2563EB] animate-spin shrink-0 mt-0.5" />
                              ) : isFailed ? (
                                <XCircle className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-[#0F172A] truncate">
                                  {repo.fullName}
                                </p>
                                <p className="text-[11px] text-[#64748B] truncate">
                                  {isBusy
                                    ? `${repo.progressStage || 'Indexing'} (${repo.progress}%)`
                                    : isFailed
                                      ? repo.errorMessage || 'Analysis failed'
                                      : `Ready · ${repo.fileCount} files indexed`}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Avatar Button */}
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#93C5FD] transition-all shrink-0"
              title="Account settings"
            >
              {user?.githubAvatarUrl ? (
                <img
                  src={user.githubAvatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-lg object-cover"
                />
              ) : (
                <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[10px] font-bold text-[#2563EB]">
                  {initials}
                </span>
              )}
              <span className="text-[12px] font-medium text-[#0F172A] max-w-[100px] truncate hidden xl:inline">
                {user?.name}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
