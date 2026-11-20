import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface WorkspaceLayoutProps {
  breadcrumbs: Array<{ label: string; to?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function WorkspaceLayout({ breadcrumbs, actions, children }: WorkspaceLayoutProps) {
  const { user, logout, connectGitHub } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#0B0F19] border-r border-white/[0.08] w-[248px]">
      <div>
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.08]">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            RepoMind
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#111827] text-white border border-white/[0.08]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              navigate('/repositories?import=open');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Analyze Codebase</span>
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-white/[0.08] space-y-3">
        {user?.githubConnected ? (
          <div className="px-3 py-2 rounded-lg bg-[#111827] border border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <GitBranch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate font-medium">@{user.githubUsername}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">GitHub OAuth linked</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void connectGitHub()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 border border-white/10 hover:bg-white/[0.04] transition-colors whitespace-nowrap"
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>Connect GitHub</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors shrink-0"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-white/[0.08] bg-[#0B0F19]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.label}>
                  {i > 0 && <span className="text-slate-600">/</span>}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="text-slate-400 hover:text-white transition-colors truncate whitespace-nowrap"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-100 font-medium truncate whitespace-nowrap">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
