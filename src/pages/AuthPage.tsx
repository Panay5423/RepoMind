import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  GitFork,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { PRIMARY_BLUE_BTN, RM_EASE, SECONDARY_WHITE_BTN } from '../components/ui/PremiumPrimitives.tsx';

function GitHubGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0.297C5.37 0.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385 0.6 0.113 0.82-0.258 0.82-0.577 0-0.285-0.01-1.04-0.015-2.04-3.338 0.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-0.744 0.084-0.729 0.084-0.729 1.205 0.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495 0.998 0.108-0.776 0.417-1.305 0.76-1.605-2.665-0.3-5.466-1.332-5.466-5.93 0-1.31 0.465-2.38 1.235-3.22-0.135-0.303-0.54-1.523 0.105-3.176 0 0 1.005-0.322 3.3 1.23 0.96-0.267 1.98-0.399 3-0.405 1.02 0.006 2.04 0.138 3 0.405 2.28-1.552 3.285-1.23 3.285-1.23 0.645 1.653 0.24 2.873 0.12 3.176 0.765 0.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92 0.42 0.36 0.81 1.096 0.81 2.22 0 1.606-0.015 2.896-0.015 3.286 0 0.315 0.21 0.69 0.825 0.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const nextPath = searchParams.get('next') || '/dashboard';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [error, setError] = useState('');

  const {
    user,
    login,
    register,
    demoLogin,
    signInWithGitHub,
    githubOAuthConfigured,
    githubCallbackUrl,
  } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(nextPath, { replace: true });
    }
  }, [user, nextPath, navigate]);

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'Enter 8+ characters', hasLength: false, hasMix: false };
    const hasLength = password.length >= 8;
    const hasUpperOrNum = /[A-Z0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    let score = 1;
    if (hasLength) score += 1;
    if (hasLength && hasUpperOrNum) score += 1;
    if (hasLength && hasUpperOrNum && hasSymbol && password.length >= 10) score += 1;
    const label =
      score <= 1 ? 'Too short' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
    return { score, label, hasLength, hasMix: hasUpperOrNum };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(name, email, password, roleTitle || undefined);
        notify('Account created and saved. Welcome to RepoMind.', 'success');
      } else {
        await login(email, password);
        notify('Signed in successfully.', 'success');
      }
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGitHubOAuth = async () => {
    setError('');
    if (!githubOAuthConfigured) {
      setShowOAuthHelp(true);
      return;
    }
    setOauthPending(true);
    const opened = await signInWithGitHub();
    if (!opened) {
      setOauthPending(false);
    } else {
      setTimeout(() => setOauthPending(false), 12000);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await demoLogin();
      notify('Signed into workspace account.', 'success');
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start session.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCallbackUrl = async () => {
    await navigator.clipboard.writeText(githubCallbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-[#E2E8F0] bg-white/85 backdrop-blur-md flex items-center justify-between gap-8 sticky top-0 z-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 font-display text-[17px] font-bold tracking-tight text-[#0B1F3A] whitespace-nowrap shrink-0 group"
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

        <Link
          to="/"
          className="text-[13px] font-medium text-[#64748B] hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0"
        >
          Back to overview
        </Link>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Architectural Showcase Column */}
        <aside className="hidden lg:flex lg:col-span-6 border-r border-[#E2E8F0] bg-[#F8FAFC] arch-blueprint-light p-12 xl:p-16 flex-col justify-between relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#3B82F6]/10 blur-3xl"
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: RM_EASE }}
            className="relative z-10 max-w-lg space-y-5"
          >
            <p className="text-[12px] font-mono font-semibold text-[#2563EB]">
              Repository Intelligence Workspace
            </p>
            <h1
              className="font-display text-[38px] xl:text-[42px] leading-[1.12] font-bold tracking-tight text-[#0B1F3A]"
              style={{ textWrap: 'balance' }}
            >
              Every repository, mapped down to the symbol.
            </h1>
            <p className="text-[15px] leading-relaxed text-[#475569]">
              Sign in with your GitHub account or create a workspace profile to index private
              repositories, trace multi-level AST call graphs, and interrogate source files with
              verified citations.
            </p>
          </motion.div>

          {/* Architectural Trace Specimen Card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08, ease: RM_EASE }}
            className="relative z-10 max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_14px_38px_-12px_rgba(37,99,235,0.14)] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#0B1F3A] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
              <span className="text-[#E2E8F0]">ast-trace · auth-pipeline.ts</span>
              <span className="text-[#60A5FA] font-semibold">4 levels resolved</span>
            </div>

            <div className="p-5 space-y-3 bg-gradient-to-b from-white to-[#F8FAFC]">
              {[
                {
                  kind: 'GitHub OAuth',
                  title: 'handleGitHubCallback',
                  meta: 'server/controllers/githubController.ts · L38',
                  accent: 'text-[#2563EB]',
                  border: 'border-[#BFDBFE]',
                },
                {
                  kind: 'Database Store',
                  title: 'UserSchema · findUserByEmail',
                  meta: 'server/models/mongoose.ts · L3',
                  accent: 'text-[#0284C7]',
                  border: 'border-[#E2E8F0]',
                },
                {
                  kind: 'Session Guard',
                  title: 'requireAuth (Bearer + HttpOnly)',
                  meta: 'server/middleware/auth.ts · L76',
                  accent: 'text-[#0B1F3A]',
                  border: 'border-[#E2E8F0]',
                },
              ].map((node, idx) => (
                <motion.div
                  key={node.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: 0.14 + idx * 0.07, ease: RM_EASE }}
                  whileHover={{ x: 4 }}
                  className={`rounded-xl border ${node.border} bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-2xs transition-all hover:border-[#93C5FD] hover:shadow-md`}
                >
                  <div className="min-w-0">
                    <div className={`text-[10px] font-mono font-semibold ${node.accent}`}>
                      {node.kind}
                    </div>
                    <div className="text-[13px] font-semibold text-[#0F172A] truncate">
                      {node.title}
                    </div>
                    <div className="text-[11px] font-mono text-[#64748B] truncate">
                      {node.meta}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#64748B] tabular-nums shrink-0">
                    0{idx + 1}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.24 }}
            className="relative z-10 flex flex-wrap items-center gap-4 text-[12px] text-[#64748B]"
          >
            <span className="inline-flex items-center gap-1.5 text-[#475569] font-medium">
              <ShieldCheck className="w-4 h-4 text-[#059669]" />
              <span>Encrypted password hashing</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Persistent database accounts</span>
            <span aria-hidden="true">·</span>
            <span>GitHub OAuth ready</span>
          </motion.div>
        </aside>

        {/* Right Interactive Auth Form Column */}
        <section className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10 rm-ambient-mesh">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.24, ease: RM_EASE }}
            className="w-full max-w-[448px] rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-8 shadow-[0_16px_44px_-14px_rgba(37,99,235,0.14)]"
          >
            {/* Animated Segmented Auth Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mb-6">
              {(
                [
                  { id: 'login', label: 'Sign In' },
                  { id: 'register', label: 'Create Account' },
                ] as const
              ).map((tab) => {
                const active = mode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMode(tab.id);
                      setError('');
                    }}
                    className={`relative h-9 text-[13px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        transition={{ duration: 0.18, ease: RM_EASE }}
                        className="absolute inset-0 rounded-lg bg-white border border-[#BFDBFE] shadow-2xs"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: RM_EASE }}
              >
                <h2 className="font-display text-[22px] font-bold tracking-tight text-[#0B1F3A]">
                  {mode === 'login' ? 'Sign in to RepoMind' : 'Create your account'}
                </h2>
                <p className="mt-1 text-[13px] text-[#64748B]">
                  {mode === 'login'
                    ? 'Access your saved repositories, AST graphs, and AI chat threads.'
                    : 'Your profile and repositories are stored securely in the database.'}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* GitHub OAuth Primary Button */}
            <div className="mt-5 space-y-2.5">
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.14 }}
                disabled={oauthPending || submitting}
                onClick={() => void handleGitHubOAuth()}
                className="w-full h-11 px-4 rounded-xl border border-[#0B1F3A] bg-[#0B1F3A] hover:bg-[#132C4E] text-white text-[13px] font-semibold flex items-center justify-center gap-2.5 shadow-sm shadow-[#0B1F3A]/15 transition-all disabled:opacity-60"
              >
                <GitHubGlyph className="w-4 h-4 text-white" />
                <span>
                  {oauthPending
                    ? 'Waiting for GitHub authorization...'
                    : mode === 'register'
                      ? 'Sign up with GitHub'
                      : 'Continue with GitHub'}
                </span>
              </motion.button>

              <AnimatePresence>
                {!githubOAuthConfigured && showOAuthHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: RM_EASE }}
                    className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5 text-[12px] space-y-2"
                  >
                    <p className="font-semibold text-[#B45309]">
                      GitHub OAuth requires environment credentials
                    </p>
                    <p className="text-[#78350F] leading-relaxed">
                      Add <code className="font-mono font-semibold">GITHUB_CLIENT_ID</code> and{' '}
                      <code className="font-mono font-semibold">GITHUB_CLIENT_SECRET</code> in
                      Settings → Secrets, and register this callback URL in your GitHub OAuth App:
                    </p>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#FDE68A] bg-white px-2.5 py-1.5 font-mono text-[11px] text-[#2563EB]">
                      <span className="truncate">{githubCallbackUrl}</span>
                      <button
                        type="button"
                        onClick={() => void copyCallbackUrl()}
                        className="text-[#64748B] hover:text-[#0F172A] shrink-0"
                        title="Copy callback URL"
                      >
                        {copiedCallback ? (
                          <Check className="w-3.5 h-3.5 text-[#059669]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E2E8F0]" />
              <span className="text-[11px] font-mono text-[#64748B]">or continue with email</span>
              <div className="h-px flex-1 bg-[#E2E8F0]" />
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className="mb-4 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 text-[12px] font-medium text-[#E11D48]"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <AnimatePresence initial={false}>
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: RM_EASE }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-[12px] font-medium text-[#475569] mb-1.5"
                      >
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="name"
                          type="text"
                          required
                          minLength={2}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex Rivera"
                          className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="roleTitle"
                        className="block text-[12px] font-medium text-[#475569] mb-1.5"
                      >
                        Role (optional)
                      </label>
                      <input
                        id="roleTitle"
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="Staff Engineer"
                        className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label
                  htmlFor="email"
                  className="block text-[12px] font-medium text-[#475569] mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.dev"
                    className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[12px] font-medium text-[#475569]"
                  >
                    Password
                  </label>
                  {mode === 'register' && password && (
                    <span
                      className={`text-[11px] font-mono font-semibold ${
                        passwordStrength.score >= 3
                          ? 'text-[#059669]'
                          : passwordStrength.score === 2
                            ? 'text-[#D97706]'
                            : 'text-[#E11D48]'
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-10 text-[13px] text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'register' && (
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((idx) => (
                      <div key={idx} className="h-1 rounded-full bg-[#E2E8F0] overflow-hidden">
                        <motion.div
                          initial={false}
                          animate={{ scaleX: passwordStrength.score >= idx ? 1 : 0 }}
                          transition={{ duration: 0.18, ease: RM_EASE }}
                          className={`h-full origin-left ${
                            passwordStrength.score >= 3
                              ? 'bg-[#059669]'
                              : passwordStrength.score === 2
                                ? 'bg-[#D97706]'
                                : 'bg-[#E11D48]'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <motion.button
                type="submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.14 }}
                disabled={submitting || oauthPending}
                className={`${PRIMARY_BLUE_BTN} group w-full h-10 px-4 text-[13px]`}
              >
                <span>
                  {submitting
                    ? 'Please wait...'
                    : mode === 'login'
                      ? 'Sign In'
                      : 'Create Account'}
                </span>
                <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </motion.button>
            </form>

            <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.14 }}
                disabled={submitting || oauthPending}
                onClick={() => void handleDemo()}
                className={`${SECONDARY_WHITE_BTN} w-full h-10 px-4 text-[12px]`}
              >
                <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Instant Workspace Session</span>
              </motion.button>
              <p className="mt-2 text-center text-[11px] text-[#64748B]">
                Creates an active session so you can explore and index repositories immediately.
              </p>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
