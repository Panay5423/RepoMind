import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const nextPath = searchParams.get('next') || '/dashboard';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login, register, demoLogin } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await register(name, email, password);
        notify('Account created. Welcome to RepoMind.', 'success');
      } else {
        await login(email, password);
        notify('Signed in successfully.', 'success');
      }
      navigate(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await demoLogin();
      notify('Signed into workspace account.', 'success');
      navigate(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] flex flex-col">
      <header className="h-16 px-6 border-b border-white/[0.08] flex items-center justify-between">
        <Link to="/" className="font-display text-lg font-bold tracking-tight text-white">
          RepoMind
        </Link>
        <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          Back to home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111827] p-8">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0F19] border border-white/[0.06] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <h1 className="font-display text-2xl font-bold text-white">
            {mode === 'login' ? 'Sign in to RepoMind' : 'Create your developer account'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {mode === 'login'
              ? 'Access your indexed repositories, architecture maps, and AI code chats.'
              : 'Start analyzing GitHub repositories and source archives in seconds.'}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.dev"
                className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-white/10 bg-[#0B0F19] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.08]">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDemo()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-white/10 bg-[#0B0F19] hover:bg-white/[0.04] text-slate-200 text-sm font-medium transition-colors"
            >
              <KeyRound className="w-4 h-4 text-violet-400" />
              <span>Instant Workspace Session</span>
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Creates a real JWT session so you can import and analyze repositories immediately.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
