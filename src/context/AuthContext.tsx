import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PublicUser } from '../../shared/types.ts';
import { api, getStoredToken, setStoredToken } from '../lib/api.ts';
import { useToast } from './ToastContext.tsx';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  connectGitHub: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { notify } = useToast();

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
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
  }, [refreshUser]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
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

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.auth.register({ name, email, password });
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const demoLogin = useCallback(async () => {
    const res = await api.auth.demo();
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
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
        login,
        register,
        demoLogin,
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
