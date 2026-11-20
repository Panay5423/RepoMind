import { Router } from 'express';
import { aiLimiter, apiLimiter, authLimiter, requireAuth } from '../middleware/auth.ts';
import { zipUploadMiddleware } from '../middleware/upload.ts';
import { demoLogin, getMe, login, register } from '../controllers/authController.ts';
import {
  disconnectGitHub,
  getGitHubAuthUrl,
  getGitHubStatus,
  handleGitHubCallback,
  listMyGitHubRepos,
} from '../controllers/githubController.ts';
import {
  deleteRepository,
  getDashboardOverview,
  getRepositoryDetail,
  getRepositoryFileContent,
  importGitHubRepository,
  listRepositories,
  reanalyzeRepository,
  searchRepositoryCode,
  uploadZipRepository,
} from '../controllers/repoController.ts';
import {
  createConversation,
  deleteConversation,
  explainRepositoryFile,
  generateDoc,
  getBugReports,
  listConversations,
  listDocumentation,
  listMessages,
  runBugScan,
  sendChatMessage,
  updateDoc,
} from '../controllers/aiFeaturesController.ts';
import {
  getArchitectureIntelligence,
  getNodeImpactReport,
  getScopedCodeLevel,
} from '../controllers/architectureController.ts';

export const apiRouter = Router();
export const oauthCallbackRouter = Router();

// GitHub OAuth Callback (supports optional trailing slash)
oauthCallbackRouter.get(['/auth/github/callback', '/auth/github/callback/'], handleGitHubCallback);

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RepoMind API' });
});

// Authentication
apiRouter.post('/auth/register', authLimiter, register);
apiRouter.post('/auth/login', authLimiter, login);
apiRouter.post('/auth/demo', authLimiter, demoLogin);
apiRouter.get('/auth/me', apiLimiter, requireAuth, getMe);

// GitHub Integration
apiRouter.get('/github/status', apiLimiter, requireAuth, getGitHubStatus);
apiRouter.get('/github/auth-url', apiLimiter, requireAuth, getGitHubAuthUrl);
apiRouter.get('/github/repos', apiLimiter, requireAuth, listMyGitHubRepos);
apiRouter.post('/github/disconnect', apiLimiter, requireAuth, disconnectGitHub);

// Dashboard
apiRouter.get('/dashboard', apiLimiter, requireAuth, getDashboardOverview);

// Repositories
apiRouter.get('/repositories', apiLimiter, requireAuth, listRepositories);
apiRouter.post('/repositories/github', aiLimiter, requireAuth, importGitHubRepository);
apiRouter.post(
  '/repositories/upload',
  aiLimiter,
  requireAuth,
  zipUploadMiddleware.single('archive'),
  uploadZipRepository
);
apiRouter.get('/repositories/:id', apiLimiter, requireAuth, getRepositoryDetail);
apiRouter.get('/repositories/:id/file', apiLimiter, requireAuth, getRepositoryFileContent);
apiRouter.get('/repositories/:id/search', apiLimiter, requireAuth, searchRepositoryCode);
apiRouter.post('/repositories/:id/explain-file', aiLimiter, requireAuth, explainRepositoryFile);
apiRouter.post('/repositories/:id/reanalyze', aiLimiter, requireAuth, reanalyzeRepository);
apiRouter.delete('/repositories/:id', aiLimiter, requireAuth, deleteRepository);

// Deterministic AST Architecture Intelligence
apiRouter.get('/repositories/:id/architecture', apiLimiter, requireAuth, getArchitectureIntelligence);
apiRouter.get('/repositories/:id/architecture/code', apiLimiter, requireAuth, getScopedCodeLevel);
apiRouter.get('/repositories/:id/architecture/impact', apiLimiter, requireAuth, getNodeImpactReport);

// AI Code Chat & RAG
apiRouter.get('/repositories/:id/conversations', apiLimiter, requireAuth, listConversations);
apiRouter.post('/repositories/:id/conversations', apiLimiter, requireAuth, createConversation);
apiRouter.delete('/conversations/:conversationId', apiLimiter, requireAuth, deleteConversation);
apiRouter.get('/conversations/:conversationId/messages', apiLimiter, requireAuth, listMessages);
apiRouter.post('/conversations/:conversationId/messages', aiLimiter, requireAuth, sendChatMessage);

// Bug Detective
apiRouter.get('/repositories/:id/bugs', apiLimiter, requireAuth, getBugReports);
apiRouter.post('/repositories/:id/bugs/scan', aiLimiter, requireAuth, runBugScan);

// Documentation Generator
apiRouter.get('/repositories/:id/docs', apiLimiter, requireAuth, listDocumentation);
apiRouter.post('/repositories/:id/docs/generate', aiLimiter, requireAuth, generateDoc);
apiRouter.put('/repositories/:id/docs/:type', apiLimiter, requireAuth, updateDoc);
