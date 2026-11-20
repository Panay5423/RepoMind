import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { db } from '../models/store.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import {
  buildGitHubOAuthUrl,
  exchangeGitHubCode,
  isGitHubOAuthConfigured,
  listUserGitHubRepos,
} from '../services/github/githubService.ts';

export async function getGitHubStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({
    oauthConfigured: isGitHubOAuthConfigured(),
    connected: Boolean(req.user?.githubConnected),
    githubUsername: req.user?.githubUsername || null,
    githubAvatarUrl: req.user?.githubAvatarUrl || null,
    callbackUrl: env.githubCallbackUrl || `${env.appUrl}/auth/github/callback`,
  });
}

export async function getGitHubAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isGitHubOAuthConfigured()) {
    res.status(400).json({
      error:
        'GitHub OAuth is not configured on this server (missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET). You can still analyze any public GitHub repository by URL or upload a ZIP archive.',
    });
    return;
  }
  const state = jwt.sign({ uid: req.user!.id, purpose: 'github_oauth' }, env.jwtSecret, {
    expiresIn: '10m',
  });
  const url = buildGitHubOAuthUrl(state);
  res.json({ url });
}

export async function handleGitHubCallback(req: Request, res: Response): Promise<void> {
  const sendPopupResult = (payload: Record<string, unknown>, message: string) => {
    res.send(`<!doctype html>
<html>
  <head><title>RepoMind GitHub Authorization</title></head>
  <body style="background:#0B0F19;color:#F8FAFC;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <div style="text-align:center;max-width:420px;padding:24px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:#111827;">
      <p style="font-size:15px;margin:0 0 12px 0;">${message}</p>
      <p style="font-size:13px;color:#94A3B8;margin:0;">You may close this window if it does not close automatically.</p>
    </div>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${JSON.stringify(payload)}, '*');
          window.close();
        } else {
          window.location.href = '/repositories';
        }
      } catch (e) {}
    </script>
  </body>
</html>`);
  };

  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: 'Missing authorization code or state.' },
        'GitHub authorization was cancelled or missing parameters.'
      );
      return;
    }

    const decoded = jwt.verify(state, env.jwtSecret) as { uid?: string; purpose?: string };
    if (!decoded.uid || decoded.purpose !== 'github_oauth') {
      sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: 'Invalid OAuth state.' },
        'Invalid or expired authorization state.'
      );
      return;
    }

    const gh = await exchangeGitHubCode(code);
    await db.updateUser(decoded.uid, {
      githubAccessToken: gh.accessToken,
      githubUsername: gh.username,
      githubAvatarUrl: gh.avatarUrl,
    });

    sendPopupResult(
      { type: 'GITHUB_OAUTH_SUCCESS', githubUsername: gh.username },
      `Connected GitHub account @${gh.username}.`
    );
  } catch (err) {
    console.error('[GitHub OAuth] Callback error:', err);
    sendPopupResult(
      {
        type: 'GITHUB_OAUTH_ERROR',
        error: err instanceof Error ? err.message : 'GitHub OAuth failed.',
      },
      'GitHub connection failed. Please try again.'
    );
  }
}

export async function listMyGitHubRepos(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await db.findUserById(req.user!.id);
    if (!user?.githubAccessToken) {
      res.status(400).json({ error: 'GitHub account is not connected.' });
      return;
    }
    const repos = await listUserGitHubRepos(user.githubAccessToken);
    res.json({ repos });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to load GitHub repositories.',
    });
  }
}

export async function disconnectGitHub(req: AuthenticatedRequest, res: Response): Promise<void> {
  await db.updateUser(req.user!.id, {
    githubAccessToken: undefined,
    githubUsername: undefined,
    githubAvatarUrl: undefined,
  });
  res.json({ ok: true });
}
