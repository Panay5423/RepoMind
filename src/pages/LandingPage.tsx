import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bug,
  FileText,
  GitBranch,
  Layers,
  MessageSquareCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

type PreviewTab = 'chat' | 'architecture' | 'bugs';

export function LandingPage() {
  const { user, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [previewTab, setPreviewTab] = useState<PreviewTab>('chat');
  const [imgFailed, setImgFailed] = useState(false);
  const [startingDemo, setStartingDemo] = useState(false);

  const handleConnectGitHubClick = async () => {
    if (user) {
      navigate('/repositories?import=github');
      return;
    }
    navigate('/auth?mode=login&next=/repositories?import=github');
  };

  const handleQuickStart = async () => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    setStartingDemo(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch {
      navigate('/auth');
    } finally {
      setStartingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            RepoMind
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a
              href="#capabilities"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#preview"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#pricing"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? '/dashboard' : '/auth'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>{user ? 'Open Workspace' : 'Get Started'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-medium tracking-wider text-blue-400 uppercase mb-4">
              Repository Intelligence Platform
            </p>
            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.08]"
              style={{
                fontSize: 'clamp(2.25rem, 4vw, 3.75rem)',
                textWrap: 'balance',
              }}
            >
              Understand Your Codebase. Build Smarter.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              Connect any GitHub repository or upload a source ZIP archive. RepoMind indexes your
              file tree, maps module dependencies, detects vulnerabilities, generates documentation,
              and answers engineering questions grounded in exact file paths and line numbers.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void handleQuickStart()}
                disabled={startingDemo}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <span>{user ? 'Go to Dashboard' : startingDemo ? 'Opening Workspace...' : 'Get Started'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => void handleConnectGitHubClick()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/15 bg-[#111827] hover:bg-[#1A2234] text-slate-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <GitBranch className="w-4 h-4 text-violet-400 shrink-0" />
                <span>Connect GitHub</span>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <span>Vector RAG Indexing</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Static + AI Bug Inspection</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Interactive Architecture Maps</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="relative w-full rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden flex flex-col justify-between">
              {!imgFailed ? (
                <div className="relative w-full h-full min-h-[320px]">
                  <img
                    src="/src/assets/images/hero_code_topology_1795167593371.jpg"
                    alt="Isometric software module dependency lattice visualization"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/30 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Grounded Codebase Topology
                      </p>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Every graph node and chat citation maps directly to indexed source files.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full min-h-[320px] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#111827] to-[#0B0F19]">
                  <Layers className="w-10 h-10 text-blue-400 mb-3" />
                  <p className="text-sm font-medium text-white">Codebase Dependency Topology</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Product Preview Section */}
      <section id="preview" className="border-t border-white/[0.08] bg-[#0E1320]/60 py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                One workspace for deep code comprehension
              </h2>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Switch between semantic code search, live module architecture diagrams, and verified
                static + AI code inspections.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setPreviewTab('chat')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  previewTab === 'chat'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Grounded AI Chat
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('architecture')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  previewTab === 'architecture'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Architecture Map
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('bugs')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  previewTab === 'bugs'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bug Detective
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
            <div className="border-b border-white/[0.08] px-5 py-3 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>workspace / acme-api-gateway</span>
              <span>main · TypeScript · 84 files</span>
            </div>

            {previewTab === 'chat' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
                <div className="lg:col-span-4 p-5 space-y-3 bg-[#0B0F19]/40">
                  <p className="text-xs font-medium text-slate-400">Indexed Context Chunks</p>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/[0.06] text-slate-200">
                      <div className="text-blue-400">src/middleware/auth.ts</div>
                      <div className="text-slate-400 mt-1">Lines 18–54 · JWT verification</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/[0.06] bg-[#0B0F19] text-slate-300">
                      <div className="text-slate-200">src/routes/sessions.ts</div>
                      <div className="text-slate-500 mt-1">Lines 1–42 · Token issuance</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/[0.06] bg-[#0B0F19] text-slate-300">
                      <div className="text-slate-200">src/models/User.ts</div>
                      <div className="text-slate-500 mt-1">Lines 12–68 · Schema & indexes</div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-8 p-6 space-y-5">
                  <div className="text-sm text-slate-200 bg-[#0B0F19] border border-white/[0.06] rounded-lg px-4 py-3">
                    Where is authentication implemented and how are protected routes verified?
                  </div>
                  <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                    <p>
                      Authentication tokens are issued in{' '}
                      <code className="font-mono text-blue-300">src/routes/sessions.ts:14-39</code>{' '}
                      after verifying bcrypt password hashes against{' '}
                      <code className="font-mono text-blue-300">src/models/User.ts</code>.
                    </p>
                    <p>
                      Protected endpoints pass through{' '}
                      <code className="font-mono text-blue-300">requireAuth</code> in{' '}
                      <code className="font-mono text-blue-300">src/middleware/auth.ts:18-54</code>,
                      which validates the Bearer JWT signature and attaches the resolved user record
                      before invoking route controllers.
                    </p>
                    <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-blue-400">
                      <span>Cited: src/middleware/auth.ts (L18-54)</span>
                      <span className="text-slate-600">·</span>
                      <span>src/routes/sessions.ts (L14-39)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'architecture' && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                {[
                  {
                    layer: 'Frontend Layer',
                    title: 'React Client UI',
                    files: 'src/pages/* · src/lib/api.ts',
                  },
                  {
                    layer: 'API Layer',
                    title: 'Express REST Router',
                    files: 'server/routes/index.ts',
                  },
                  {
                    layer: 'AI & Analysis',
                    title: 'Gemini RAG Pipeline',
                    files: 'server/services/ai/*',
                  },
                  {
                    layer: 'Persistence',
                    title: 'MongoDB / Store',
                    files: 'server/models/mongoose.ts',
                  },
                ].map((node) => (
                  <div
                    key={node.title}
                    className="p-4 rounded-lg border border-white/10 bg-[#0B0F19] space-y-1.5"
                  >
                    <p className="text-[11px] font-medium text-violet-400">{node.layer}</p>
                    <p className="text-sm font-semibold text-white">{node.title}</p>
                    <p className="text-xs font-mono text-slate-400 truncate">{node.files}</p>
                  </div>
                ))}
              </div>
            )}

            {previewTab === 'bugs' && (
              <div className="p-6 divide-y divide-white/[0.08]">
                <div className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Zip extraction path normalization check
                    </p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      server/services/repository/zipService.ts · Lines 24–31
                    </p>
                  </div>
                  <div className="text-xs text-emerald-400 font-medium">
                    Verified Static Check · Low Risk
                  </div>
                </div>
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Unhandled upstream timeout in external webhook dispatcher
                    </p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      src/services/webhook.ts · Lines 44–62
                    </p>
                  </div>
                  <div className="text-xs text-amber-400 font-medium">
                    AI Potential Issue · Medium Severity
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Capabilities Asymmetric Grid */}
      <section id="capabilities" className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Engineered for real codebases, not toy snippets
          </h2>
          <p className="mt-3 text-slate-400">
            Every workflow operates directly on parsed repository trees, chunked source files, and
            vector embeddings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-7 rounded-xl border border-white/[0.08] bg-[#111827] p-7">
            <MessageSquareCode className="w-5 h-5 text-blue-400 mb-4" />
            <h3 className="font-display text-lg font-semibold text-white">
              Source-Grounded AI Code Chat
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Ask architectural questions, trace authentication flows, or locate database queries.
              RepoMind retrieves top-ranked chunks using Gemini embeddings and lexical matching,
              returning answers with verified file paths and line numbers.
            </p>
          </div>

          <div className="md:col-span-5 rounded-xl border border-white/[0.08] bg-[#111827] p-7">
            <Layers className="w-5 h-5 text-violet-400 mb-4" />
            <h3 className="font-display text-lg font-semibold text-white">
              Interactive Architecture Graph
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Inspect frontend modules, backend routers, APIs, database schemas, and external
              services on an interactive zoomable canvas generated from your actual files.
            </p>
          </div>

          <div className="md:col-span-4 rounded-xl border border-white/[0.08] bg-[#111827] p-7">
            <Bug className="w-5 h-5 text-amber-400 mb-4" />
            <h3 className="font-display text-lg font-semibold text-white">Bug Detective</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Separates verified static pattern detections (exposed secrets, unsafe eval/exec) from
              AI-identified potential bugs and duplication risks.
            </p>
          </div>

          <div className="md:col-span-4 rounded-xl border border-white/[0.08] bg-[#111827] p-7">
            <FileText className="w-5 h-5 text-blue-400 mb-4" />
            <h3 className="font-display text-lg font-semibold text-white">
              Documentation Generator
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Produce READMEs, API references, architecture overviews, installation guides, and
              environment setup docs—then edit, preview, and download Markdown.
            </p>
          </div>

          <div className="md:col-span-4 rounded-xl border border-white/[0.08] bg-[#111827] p-7">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mb-4" />
            <h3 className="font-display text-lg font-semibold text-white">
              Security-First Ingestion
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Path-traversal protection on ZIP archives, automatic credential redaction prior to AI
              prompts, and strict untrusted-data isolation.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="border-t border-white/[0.08] bg-[#0E1320]/60 py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mb-10">
            How RepoMind analyzes a repository
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-t border-white/15 pt-5">
              <p className="font-mono text-xs text-blue-400">01. Connect or Upload</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-white">
                Ingest from GitHub or ZIP
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Paste any public GitHub URL, connect GitHub OAuth for private repositories, or
                upload a local `.zip` source archive up to 25 MB.
              </p>
            </div>
            <div className="border-t border-white/15 pt-5">
              <p className="font-mono text-xs text-blue-400">02. Parse & Embed</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-white">
                Index Trees, Deps & Vectors
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                RepoMind filters build artifacts, extracts language & dependency metadata, runs
                static secret checks, and embeds priority code chunks.
              </p>
            </div>
            <div className="border-t border-white/15 pt-5">
              <p className="font-mono text-xs text-blue-400">03. Inspect & Query</p>
              <h3 className="mt-2 font-display text-lg font-semibold text-white">
                Explore Graphs, Bugs & Docs
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Navigate your architecture diagram, ask grounded questions in AI Code Chat, review
                potential bugs, and export documentation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing (UI only) */}
      <section id="pricing" className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="max-w-xl mb-12">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Transparent plans for solo developers and teams
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Pricing tiers shown for platform planning; all workspace features are active in this
            deployment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              tier: 'Developer',
              audience: 'For individual engineers',
              price: '$0',
              cadence: 'forever',
              limits: [
                'Up to 5 active repositories',
                'Public GitHub URLs & 25 MB ZIP uploads',
                'RAG AI Code Chat & Architecture Graph',
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
                'Shared team conversation history',
                'Priority Gemini analysis throughput',
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
          ].map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-xl p-7 flex flex-col justify-between border ${
                plan.highlight
                  ? 'border-blue-500/50 bg-[#111827]'
                  : 'border-white/[0.08] bg-[#111827]/60'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white">{plan.tier}</p>
                <p className="text-xs text-slate-400 mt-1">{plan.audience}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-white tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-400">{plan.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                  {plan.limits.map((l) => (
                    <li key={l} className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">·</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className={`mt-8 w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'border border-white/10 hover:bg-white/[0.04] text-slate-200'
                }`}
              >
                {plan.tier === 'Enterprise' ? 'Request Access' : `Start ${plan.tier}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.08] py-10">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-300">RepoMind</span>
            <span>·</span>
            <span>AI Repository Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
            <Link to="/repositories" className="hover:text-slate-300 transition-colors">
              Import Repository
            </Link>
            <span className="flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>ZIP & GitHub Ready</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
