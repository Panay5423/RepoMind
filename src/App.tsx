import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { GitFork } from 'lucide-react';
import { ToastProvider } from './context/ToastContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { RepositoriesPage } from './pages/RepositoriesPage.tsx';
import { RepoWorkspacePage } from './pages/RepoWorkspacePage.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3.5 shadow-[0_8px_24px_-10px_rgba(37,99,235,0.14)]"
        >
          <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
            <GitFork className="w-3.5 h-3.5 text-[#2563EB] animate-spin" />
          </span>
          <span className="text-[13px] font-medium text-[#0F172A]">
            Restoring workspace session...
          </span>
        </motion.div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  // Keep workspace path stable across tab query-param switches so workspace tabs animate internally
  const routeKey = location.pathname;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={routeKey}>
        <Route
          path="/"
          element={
            <PageFrame>
              <LandingPage />
            </PageFrame>
          }
        />
        <Route
          path="/auth"
          element={
            <PageFrame>
              <AuthPage />
            </PageFrame>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repositories"
          element={
            <ProtectedRoute>
              <RepositoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repositories/:id"
          element={
            <ProtectedRoute>
              <RepoWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ErrorBoundary title="Application rendering error">
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AnimatedRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
