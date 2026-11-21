import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PublicUser } from '../../shared/types.ts';
import { api, setStoredToken } from '../lib/api.ts';
import { useToast } from './ToastContext.tsx';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  githubOAuthConfigured: boolean;
  githubCallbackUrl: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, roleTitle?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  signInWithGitHub: () => Promise<boolean>;
  updateProfile: (body: {
    name?: string;
    roleTitle?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [githubOAuthConfigured, setGithubOAuthConfigured] = useState<boolean>(false);
  const [githubCallbackUrl, setGithubCallbackUrl] = useState<string>(
    typeof window !== 'undefined' ? `${window.location.origin}/auth/github/callback` : ''
  );
  const { notify } = useToast();

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
    api.auth
      .providers()
      .then((res) => {
        setGithubOAuthConfigured(res.githubOAuthConfigured);
        if (res.callbackUrl) setGithubCallbackUrl(res.callbackUrl);
      })
      .catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (origin && origin !== window.location.origin) {
        try {
          const parsed = new URL(origin);
          const allowedHost =
            parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1' ||
            parsed.hostname.endsWith('.run.app');
          if (!allowedHost) return;
        } catch {
          return;
        }
      }

      if (event.data?.type === 'GITHUB_OAUTH_SIGNIN_SUCCESS') {
        const token = typeof event.data.token === 'string' ? event.data.token : null;
        const nextUser = event.data.user as PublicUser | undefined;
        if (token) setStoredToken(token);
        if (nextUser) {
          setUser(nextUser);
          notify(`Signed in with GitHub as @${nextUser.githubUsername || nextUser.name}`, 'success');
        } else {
          void refreshUser();
        }
      } else if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        notify(`Connected GitHub account @${event.data.githubUsername}`, 'success');
        void refreshUser();
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        notify(event.data.error || 'GitHub authorization failed.', 'error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [notify, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, roleTitle?: string) => {
      const res = await api.auth.register({ name, email, password, roleTitle });
      setStoredToken(res.token);
      setUser(res.user);
    },
    []
  );

  const demoLogin = useCallback(async () => {
    const res = await api.auth.demo();
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const signInWithGitHub = useCallback(async (): Promise<boolean> => {
    try {
      const { url } = await api.auth.githubUrl();
      const popup = window.open(url, 'repomind_github_oauth', 'width=640,height=740');
      if (!popup) {
        notify('Popup was blocked by your browser. Please allow popups for this site.', 'error');
        return false;
      }
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to start GitHub OAuth.', 'error');
      return false;
    }
  }, [notify]);

  const updateProfile = useCallback(
    async (body: {
      name?: string;
      roleTitle?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const res = await api.auth.updateProfile(body);
      setUser(res.user);
      notify('Account settings saved to database.', 'success');
    },
    [notify]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // clear local auth state even if network logout fails
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  const connectGitHub = useCallback(async () => {
    try {
      const { url } = await api.github.authUrl();
      const popup = window.open(url, 'repomind_github_oauth', 'width=640,height=740');
      if (!popup) {
        notify('Popup was blocked by your browser. Please allow popups for this site.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to start GitHub OAuth.', 'error');
    }
  }, [notify]);

  const disconnectGitHub = useCallback(async () => {
    await api.github.disconnect();
    await refreshUser();
    notify('Disconnected GitHub account.', 'info');
  }, [notify, refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        githubOAuthConfigured,
        githubCallbackUrl,
        login,
        register,
        demoLogin,
        signInWithGitHub,
        updateProfile,
        logout,
        refreshUser,
        connectGitHub,
        disconnectGitHub,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
