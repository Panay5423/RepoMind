import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Bug,
  Database,
  FileCode2,
  FileText,
  GitFork,
  Globe,
  Layers,
  MessageSquareCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

type PreviewTab = 'architecture' | 'chat' | 'explorer' | 'bugs';

const EASE = [0.16, 1, 0.3, 1] as const;

interface HeroNodeSpec {
  id: string;
  label: string;
  kind: string;
  file: string;
  line: number;
  xPct: number;
  yPct: number;
  icon: typeof Globe;
  detail: string;
}

const HERO_NODES: HeroNodeSpec[] = [
  {
    id: 'client',
    label: 'React Client',
    kind: 'Frontend',
    file: 'src/lib/api.ts',
    line: 42,
    xPct: 16,
    yPct: 24,
    icon: Globe,
    detail: 'Dispatches authenticated fetch with CSRF header & Bearer token',
  },
  {
    id: 'router',
    label: 'Express Router',
    kind: 'API Route',
    file: 'server/routes/index.ts',
    line: 83,
    xPct: 50,
    yPct: 24,
    icon: GitFork,
    detail: 'Routes POST /api/repositories/github through rate-limit & auth chain',
  },
  {
    id: 'auth',
    label: 'requireAuth()',
    kind: 'Middleware',
    file: 'server/middleware/auth.ts',
    line: 92,
    xPct: 84,
    yPct: 24,
    icon: ShieldCheck,
    detail: 'Verifies JWT Bearer or HttpOnly cookie & binds req.user',
  },
  {
    id: 'ast',
    label: 'AST Analyzer',
    kind: 'Service',
    file: 'server/services/ai/astEngine.ts',
    line: 148,
    xPct: 33,
    yPct: 72,
    icon: FileCode2,
    detail: 'Resolves imports, call graphs, classes & 4-level architecture nodes',
  },
  {
    id: 'store',
    label: 'MongoDB / Store',
    kind: 'Database',
    file: 'server/models/store.ts',
    line: 152,
    xPct: 68,
    yPct: 72,
    icon: Database,
    detail: 'Persists indexed files, analyses, bug findings & user records',
  },
];

interface HeroEdgeSpec {
  id: string;
  from: string;
  to: string;
  label: string;
  path: string;
}

const HERO_EDGES: HeroEdgeSpec[] = [
  {
    id: 'client-router',
    from: 'client',
    to: 'router',
    label: 'HTTPS POST',
    path: 'M 170 79 C 192 79, 204 79, 223 79',
  },
  {
    id: 'router-auth',
    from: 'router',
    to: 'auth',
    label: 'GUARD',
    path: 'M 374 79 C 396 79, 408 79, 427 79',
  },
  {
    id: 'auth-ast',
    from: 'auth',
    to: 'ast',
    label: 'DISPATCH',
    path: 'M 504 116 C 504 176, 232 144, 202 197',
  },
  {
    id: 'ast-store',
    from: 'ast',
    to: 'store',
    label: 'WRITES',
    path: 'M 272 238 C 296 238, 308 238, 331 238',
  },
];

function GitHubGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0.297C5.37 0.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385 0.6 0.113 0.82-0.258 0.82-0.577 0-0.285-0.01-1.04-0.015-2.04-3.338 0.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-0.744 0.084-0.729 0.084-0.729 1.205 0.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495 0.998 0.108-0.776 0.417-1.305 0.76-1.605-2.665-0.3-5.466-1.332-5.466-5.93 0-1.31 0.465-2.38 1.235-3.22-0.135-0.303-0.54-1.523 0.105-3.176 0 0 1.005-0.322 3.3 1.23 0.96-0.267 1.98-0.399 3-0.405 1.02 0.006 2.04 0.138 3 0.405 2.28-1.552 3.285-1.23 3.285-1.23 0.645 1.653 0.24 2.873 0.12 3.176 0.765 0.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92 0.42 0.36 0.81 1.096 0.81 2.22 0 1.606-0.015 2.896-0.015 3.286 0 0.315 0.21 0.69 0.825 0.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function LandingPage() {
  const { user, signInWithGitHub, githubOAuthConfigured } = useAuth();
  const navigate = useNavigate();
  const [previewTab, setPreviewTab] = useState<PreviewTab>('architecture');
  const [activeNodeId, setActiveNodeId] = useState<string>('ast');
  const [userInteractedNode, setUserInteractedNode] = useState(false);

  // Gentle auto-walk across AST nodes until user interacts
  useEffect(() => {
    if (userInteractedNode) return;
    const order = HERO_NODES.map((n) => n.id);
    const timer = setInterval(() => {
      setActiveNodeId((prev) => {
        const idx = order.indexOf(prev);
        return order[(idx + 1) % order.length];
      });
    }, 2600);
    return () => clearInterval(timer);
  }, [userInteractedNode]);

  const activeNode = HERO_NODES.find((n) => n.id === activeNodeId) || HERO_NODES[0];

  const handleContinueWithGitHub = async () => {
    if (user) {
      navigate('/repositories?import=github');
      return;
    }
    if (githubOAuthConfigured) {
      const opened = await signInWithGitHub();
      if (opened) return;
    }
    navigate('/auth?mode=login&next=/repositories?import=github');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Bar Contract: 3 balanced zones */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0 group"
          >
            <motion.span
              whileHover={{ rotate: -8, scale: 1.06 }}
              transition={{ duration: 0.16, ease: EASE }}
              className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shadow-xs shadow-blue-600/25"
            >
              <GitFork className="w-3.5 h-3.5 text-white" />
            </motion.span>
            <span>RepoMind</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-slate-600">
            <a
              href="#preview"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#capabilities"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#pricing"
              className="hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              Plans
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {!user && (
              <Link
                to="/auth?mode=login"
                className="hidden sm:inline-flex items-center h-9 px-3.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
            )}
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.14 }}>
              <Link
                to={user ? '/dashboard' : '/auth?mode=register'}
                className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs shadow-blue-600/20 whitespace-nowrap shrink-0"
              >
                <span>{user ? 'Open Workspace' : 'Create Account'}</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section: Crisp White + Blue Architectural Canvas with Live Node Animation */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 pt-14 pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="text-[12px] font-mono font-medium text-blue-600 mb-4"
              >
                Repository Intelligence &amp; AST Graph Platform
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.05, ease: EASE }}
                className="font-display font-semibold tracking-tight text-slate-900 leading-[1.08]"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3.6rem)',
                  textWrap: 'balance',
                }}
              >
                Understand Your Codebase. Build Smarter.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.1, ease: EASE }}
                className="mt-6 text-[16px] text-slate-600 leading-relaxed max-w-xl"
              >
                Connect any GitHub repository or upload a source archive. RepoMind parses AST call
                graphs across 4 structural levels, traces live data flows, detects security issues,
                and answers questions grounded in exact file paths and line numbers.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.15, ease: EASE }}
                className="mt-8 flex flex-wrap items-center gap-3.5"
              >
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.14 }}>
                  <Link
                    to={user ? '/dashboard' : '/auth?mode=register'}
                    className="group inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-blue-600/20 whitespace-nowrap shrink-0"
                  >
                    <span>{user ? 'Go to Dashboard' : 'Get Started Free'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => void handleContinueWithGitHub()}
                  className="inline-flex items-center gap-2.5 h-11 px-5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 text-slate-800 text-[13px] font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <GitHubGlyph className="w-4 h-4 text-slate-900 shrink-0" />
                  <span>{user ? 'Import from GitHub' : 'Continue with GitHub'}</span>
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.32, delay: 0.22 }}
                className="mt-9 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-mono text-slate-500"
              >
                <span>4-Level AST Graph</span>
                <span aria-hidden="true">·</span>
                <span>Data Flow Tracing</span>
                <span aria-hidden="true">·</span>
                <span>Static + AI Bug Inspection</span>
                <span aria-hidden="true">·</span>
                <span>RAG Code Chat</span>
              </motion.div>
            </div>

            {/* Right Interactive Blue & White AST Node Graph Canvas */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.36, delay: 0.1, ease: EASE }}
              className="lg:col-span-6 flex"
            >
              <div className="relative w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] overflow-hidden flex flex-col justify-between shadow-sm">
                {/* Canvas Top Bar */}
                <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
                  <span className="text-slate-700 font-medium">
                    ast-topology · interactive-flow
                  </span>
                  <span className="text-blue-600">System → Module → File → Symbol</span>
                </div>

                {/* Live Node Stage */}
                <div className="relative flex-1 min-h-[320px] arch-blueprint-light p-4 overflow-hidden">
                  {/* SVG Bezier Edges + Flowing Data Packets */}
                  <svg
                    viewBox="0 0 600 330"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="landing-arrow-idle"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
                      </marker>
                      <marker
                        id="landing-arrow-active"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563EB" />
                      </marker>
                    </defs>

                    {HERO_EDGES.map((edge, idx) => {
                      const isConnected =
                        edge.from === activeNodeId || edge.to === activeNodeId;
                      return (
                        <g key={edge.id}>
                          {/* Base Bezier edge */}
                          <motion.path
                            d={edge.path}
                            fill="none"
                            stroke={isConnected ? '#2563EB' : '#CBD5E1'}
                            strokeWidth={isConnected ? 2.25 : 1.5}
                            markerEnd={
                              isConnected
                                ? 'url(#landing-arrow-active)'
                                : 'url(#landing-arrow-idle)'
                            }
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{
                              duration: 0.65,
                              delay: 0.15 + idx * 0.1,
                              ease: EASE,
                            }}
                          />
                          {/* Animated flowing packet dash */}
                          <motion.path
                            d={edge.path}
                            fill="none"
                            stroke={isConnected ? '#60A5FA' : '#93C5FD'}
                            strokeWidth={isConnected ? 2.5 : 1.5}
                            strokeLinecap="round"
                            strokeDasharray="6 18"
                            initial={{ strokeDashoffset: 0 }}
                            animate={{ strokeDashoffset: -48 }}
                            transition={{
                              duration: isConnected ? 1.15 : 2.1,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                            opacity={isConnected ? 0.95 : 0.45}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Positioned Nodes */}
                  {HERO_NODES.map((node, idx) => {
                    const Icon = node.icon;
                    const isSelected = node.id === activeNodeId;
                    return (
                      <div
                        key={node.id}
                        style={{
                          left: `${node.xPct}%`,
                          top: `${node.yPct}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                          isSelected ? 'z-20' : 'z-10'
                        }`}
                      >
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, scale: 0.92, y: 8 }}
                          animate={{
                            opacity: 1,
                            scale: isSelected ? 1.03 : 1,
                            y: 0,
                          }}
                          transition={{
                            duration: 0.28,
                            delay: 0.12 + idx * 0.06,
                            ease: EASE,
                          }}
                          whileHover={{ y: -3, scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onMouseEnter={() => {
                            setUserInteractedNode(true);
                            setActiveNodeId(node.id);
                          }}
                          onClick={() => {
                            setUserInteractedNode(true);
                            setActiveNodeId(node.id);
                          }}
                          className={`w-[118px] sm:w-[148px] rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-white shadow-lg shadow-blue-600/15 ring-2 ring-blue-600/15'
                              : 'border-slate-200 bg-white/95 hover:border-blue-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-mono font-medium text-blue-600 truncate">
                              {node.kind}
                            </span>
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] sm:text-[12px] font-semibold text-slate-900 truncate">
                            {node.label}
                          </p>
                          <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 truncate">
                            {node.file}:{node.line}
                          </p>
                        </motion.button>
                      </div>
                    );
                  })}
                </div>

                {/* Live Selected Node Inspector Strip */}
                <div className="px-4 py-3 border-t border-slate-200 bg-white">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeNode.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: EASE }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-900 truncate">
                          {activeNode.label}{' '}
                          <span className="font-mono font-normal text-blue-600">
                            ({activeNode.file}:{activeNode.line})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{activeNode.detail}</p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        Click or hover any node
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Product Preview Section */}
      <section id="preview" className="border-b border-slate-200 bg-[#F8FAFC] py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8"
          >
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                One workspace for deep code comprehension
              </h2>
              <p className="mt-2 text-[14px] text-slate-600 max-w-2xl">
                Switch between the multi-level AST Architecture Graph, source-grounded AI chat,
                full-text explorer, and verified security inspections.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
              {(
                [
                  { id: 'architecture', label: 'Architecture Graph' },
                  { id: 'chat', label: 'Grounded AI Chat' },
                  { id: 'explorer', label: 'Code Explorer' },
                  { id: 'bugs', label: 'Bug Detective' },
                ] as const
              ).map((tab) => {
                const active = previewTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={`relative px-3.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                      active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="landing-preview-tab"
                        transition={{ duration: 0.18, ease: EASE }}
                        className="absolute inset-0 rounded-md bg-blue-600"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="text-slate-700 font-medium">workspace / acme-api-gateway</span>
              <span>main · TypeScript · 84 files</span>
            </div>

            <AnimatePresence mode="wait">
              {previewTab === 'architecture' && (
                <motion.div
                  key="preview-arch"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="p-6 sm:p-8 arch-blueprint-light bg-[#F8FAFC] space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-600">
                    <span>Level 2: Module &amp; Data Flow Trace</span>
                    <span className="text-blue-600 font-medium">
                      Route → Auth Middleware → Controller → DB
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {[
                      {
                        step: '01',
                        layer: 'API Endpoint',
                        title: 'POST /api/auth/login',
                        files: 'server/routes/index.ts · L31',
                        accent: 'text-blue-600',
                        border: 'border-blue-500 ring-1 ring-blue-500/15',
                      },
                      {
                        step: '02',
                        layer: 'Controller',
                        title: 'authController.login',
                        files: 'server/controllers/authController.ts · L94',
                        accent: 'text-blue-600',
                        border: 'border-slate-200',
                      },
                      {
                        step: '03',
                        layer: 'Service / Auth',
                        title: 'signJwt + setSessionCookie',
                        files: 'server/middleware/auth.ts · L28',
                        accent: 'text-blue-600',
                        border: 'border-slate-200',
                      },
                      {
                        step: '04',
                        layer: 'Persistence',
                        title: 'UserModel.findUserByEmail',
                        files: 'server/models/store.ts · L71',
                        accent: 'text-blue-600',
                        border: 'border-slate-200',
                      },
                    ].map((node, idx) => (
                      <motion.div
                        key={node.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: idx * 0.06, ease: EASE }}
                        whileHover={{ y: -4 }}
                        className={`group p-4 rounded-xl border ${node.border} bg-white space-y-2 transition-all hover:border-blue-400 hover:shadow-md hover:shadow-blue-600/10`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-[11px] font-mono font-medium ${node.accent}`}>
                            {node.layer}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            {node.step}
                          </span>
                        </div>
                        <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {node.title}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 truncate">{node.files}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {previewTab === 'chat' && (
                <motion.div
                  key="preview-chat"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
                >
                  <div className="lg:col-span-4 p-5 space-y-3 bg-slate-50">
                    <p className="text-[11px] font-mono text-slate-500">Indexed Context Chunks</p>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/80 text-slate-900">
                        <div className="text-blue-700 font-medium">server/middleware/auth.ts</div>
                        <div className="text-slate-600 mt-1">Lines 18–74 · Dual JWT + Cookie</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-white text-slate-700">
                        <div className="text-slate-900 font-medium">
                          server/controllers/githubController.ts
                        </div>
                        <div className="text-slate-500 mt-1">Lines 38–126 · OAuth callback</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-white text-slate-700">
                        <div className="text-slate-900 font-medium">server/models/mongoose.ts</div>
                        <div className="text-slate-500 mt-1">Lines 1–42 · User schema &amp; indexes</div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-8 p-6 space-y-5 bg-white">
                    <div className="text-[13px] font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                      Where is authentication implemented and how are protected routes verified?
                    </div>
                    <div className="space-y-3 text-[13px] text-slate-600 leading-relaxed">
                      <p>
                        Authentication sessions are issued in{' '}
                        <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          server/controllers/authController.ts:94-142
                        </code>{' '}
                        after verifying bcrypt password hashes against{' '}
                        <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          server/models/store.ts
                        </code>
                        .
                      </p>
                      <p>
                        Protected endpoints pass through{' '}
                        <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          requireAuth
                        </code>{' '}
                        in{' '}
                        <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          server/middleware/auth.ts:76-108
                        </code>
                        , verifying either the Authorization Bearer JWT or the HttpOnly session
                        cookie before invoking controllers.
                      </p>
                      <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono text-blue-600">
                        <span>Cited: server/middleware/auth.ts (L76-108)</span>
                        <span className="text-slate-400">·</span>
                        <span>server/controllers/authController.ts (L94-142)</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {previewTab === 'explorer' && (
                <motion.div
                  key="preview-explorer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
                >
                  <div className="lg:col-span-4 p-5 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium">Full-Text Code Search</span>
                      <span className="font-mono text-blue-600 tabular-nums">3 matches</span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900">
                      requireAuth
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/80 text-slate-900">
                        <div className="text-blue-700 font-medium">server/middleware/auth.ts:76</div>
                        <div className="text-slate-600 mt-0.5 truncate">
                          export async function requireAuth(req, res, next)
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-700">
                        <div className="text-slate-900 font-medium">server/routes/index.ts:44</div>
                        <div className="text-slate-500 mt-0.5 truncate">
                          router.get(&apos;/repositories&apos;, requireAuth, listRepos);
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-8 p-6 space-y-4 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-mono text-xs text-slate-900 font-medium">
                        server/middleware/auth.ts
                      </span>
                      <span className="text-xs font-medium text-blue-600">
                        Explain File · Ask in Chat
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700 space-y-1">
                      <div>
                        <span className="text-slate-400 mr-4">76</span>export async function
                        requireAuth(req, res, next) {'{'}
                      </div>
                      <div className="bg-blue-100/80 text-blue-950 px-1 -mx-1 rounded">
                        <span className="text-blue-600 mr-4">77</span> const token =
                        extractToken(req);
                      </div>
                      <div>
                        <span className="text-slate-400 mr-4">78</span> if (!token) return
                        res.status(401).json({'{'} error: &apos;Authentication required.&apos; {'}'});
                      </div>
                      <div>
                        <span className="text-slate-400 mr-4">79</span> req.user = await
                        verifySession(token);
                      </div>
                      <div>
                        <span className="text-slate-400 mr-4">80</span> return next();
                      </div>
                      <div>
                        <span className="text-slate-400 mr-4">81</span>
                        {'}'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {previewTab === 'bugs' && (
                <motion.div
                  key="preview-bugs"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE }}
                  className="p-6 divide-y divide-slate-200 bg-white"
                >
                  <div className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">
                        Zip extraction path normalization check
                      </p>
                      <p className="text-[12px] font-mono text-slate-500 mt-0.5">
                        server/services/repository/zipService.ts · Lines 24–31
                      </p>
                    </div>
                    <div className="text-[12px] text-emerald-700 font-mono font-medium">
                      Verified Static Check · Low Risk
                    </div>
                  </div>
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">
                        Unhandled upstream timeout in external webhook dispatcher
                      </p>
                      <p className="text-[12px] font-mono text-slate-500 mt-0.5">
                        src/services/webhook.ts · Lines 44–62
                      </p>
                    </div>
                    <div className="text-[12px] text-amber-700 font-mono font-medium">
                      Potential Issue · Medium Severity
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* Capabilities Asymmetric Grid with Animated Cards */}
      <section id="capabilities" className="max-w-[1280px] mx-auto px-6 py-20 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="max-w-2xl mb-12"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Engineered for real repositories, not toy snippets
          </h2>
          <p className="mt-3 text-[15px] text-slate-600">
            Every view operates directly on deterministic AST parses, directory trees, and
            vector-indexed source chunks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {[
            {
              span: 'md:col-span-7',
              icon: MessageSquareCode,
              title: 'Source-Grounded AI Code Chat',
              copy: 'Switch between Q&A, Trace Flow, Write Tests, and Refactor modes. RepoMind retrieves ranked chunks using embeddings and lexical matching, returning answers with clickable file paths and line numbers.',
            },
            {
              span: 'md:col-span-5',
              icon: Layers,
              title: '4-Level AST Architecture Graph',
              copy: 'Drill from System Architecture down to Modules, Files, Functions, Classes, and Objects with deterministic call edges, global search, and PNG/SVG export.',
            },
            {
              span: 'md:col-span-4',
              icon: Bug,
              title: 'Bug Detective',
              copy: 'Separates verified static pattern detections (exposed secrets, unsafe eval/exec) from deep logic reviews, with severity filters and Ask AI Fix handoff.',
            },
            {
              span: 'md:col-span-4',
              icon: FileText,
              title: 'Documentation & Audit Export',
              copy: 'Generate READMEs, API references, architecture overviews, and setup guides, or download a complete Markdown audit report of your repository.',
            },
            {
              span: 'md:col-span-4',
              icon: ShieldCheck,
              title: 'Security-First Ingestion',
              copy: 'Path-traversal protection on ZIP archives, automatic credential redaction prior to external calls, and persistent database-backed accounts.',
            },
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.25, delay: idx * 0.05, ease: EASE }}
                whileHover={{ y: -4 }}
                className={`${card.span} group rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg hover:shadow-blue-600/[0.07] transition-all p-7`}
              >
                <div className="w-10 h-10 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 flex items-center justify-center mb-5 transition-all duration-200 group-hover:scale-105">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-[17px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {card.title}
                </h3>
                <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">{card.copy}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="border-y border-slate-200 bg-[#F8FAFC] py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-10"
          >
            How RepoMind analyzes a repository
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01. Connect or Upload',
                title: 'Ingest from GitHub or ZIP',
                body: 'Paste any public GitHub URL, sign in with GitHub OAuth for private repositories, or upload a local `.zip` source archive up to 25 MB.',
              },
              {
                step: '02. Parse & Map',
                title: 'Build AST Graphs & Vectors',
                body: 'RepoMind resolves imports, call graphs, and module boundaries deterministically, runs static secret checks, and embeds priority code chunks.',
              },
              {
                step: '03. Inspect & Query',
                title: 'Explore Graphs, Bugs & Docs',
                body: 'Navigate your multi-level architecture diagram, trace live data flows, query the codebase in chat, and export technical audits.',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.26, delay: idx * 0.07, ease: EASE }}
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-md hover:shadow-blue-600/5 transition-all"
              >
                <p className="font-mono text-xs font-medium text-blue-600">{item.step}</p>
                <h3 className="mt-2.5 font-display text-[17px] font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-[1280px] mx-auto px-6 py-20 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.26, ease: EASE }}
          className="max-w-xl mb-12"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Transparent plans for solo developers and teams
          </h2>
          <p className="mt-2 text-[13px] text-slate-600">
            Workspace capabilities are active immediately after creating an account or signing in
            with GitHub.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              tier: 'Developer',
              audience: 'For individual engineers',
              price: '$0',
              cadence: 'forever',
              limits: [
                'Public GitHub URLs & 25 MB ZIP uploads',
                '4-Level AST Architecture Graph + PNG/SVG export',
                'RAG AI Code Chat & Bug Detective',
                'Markdown documentation export',
              ],
              highlight: false,
            },
            {
              tier: 'Team',
              audience: 'For scaling product teams',
              price: '$29',
              cadence: 'per seat / month',
              limits: [
                'Unlimited repositories & private GitHub OAuth',
                'Deep Bug Detective & security pattern scans',
                'Persistent workspace history across sessions',
                'Priority analysis throughput',
              ],
              highlight: true,
            },
            {
              tier: 'Enterprise',
              audience: 'For regulated organizations',
              price: 'Custom',
              cadence: 'annual contract',
              limits: [
                'Dedicated MongoDB cluster & VPC deployment',
                'Custom secret-scanning policy rules',
                'SSO / SAML & audit trails',
                'Dedicated solutions engineering',
              ],
              highlight: false,
            },
          ].map((plan, idx) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.25, delay: idx * 0.06, ease: EASE }}
              whileHover={{ y: -4 }}
              className={`rounded-2xl p-7 flex flex-col justify-between border transition-all ${
                plan.highlight
                  ? 'border-blue-600 bg-blue-50/40 shadow-md shadow-blue-600/10'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-600/5'
              }`}
            >
              <div>
                <p className="text-[14px] font-semibold text-slate-900">{plan.tier}</p>
                <p className="text-[12px] text-slate-500 mt-1">{plan.audience}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-[12px] text-slate-500">{plan.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-[13px] text-slate-700">
                  {plan.limits.map((l) => (
                    <li key={l} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold mt-0.5">·</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/auth?mode=register')}
                className={`mt-8 w-full h-10 px-4 rounded-lg text-[13px] font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-600/20'
                    : 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 text-slate-800'
                }`}
              >
                {plan.tier === 'Enterprise' ? 'Request Access' : `Start ${plan.tier}`}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-[#F8FAFC] py-10">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-800">RepoMind</span>
            <span>·</span>
            <span>Repository Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/auth?mode=login" className="hover:text-blue-600 transition-colors">
              Sign In
            </Link>
            <Link to="/auth?mode=register" className="hover:text-blue-600 transition-colors">
              Create Account
            </Link>
            <Link to="/repositories" className="hover:text-blue-600 transition-colors">
              Import Repository
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>ZIP &amp; GitHub Ready</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
