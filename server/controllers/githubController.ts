import crypto from 'crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { db } from '../models/store.ts';
import {
  setSessionCookie,
  signAuthToken,
  toPublicUser,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  buildGitHubOAuthUrl,
  exchangeGitHubCode,
  isGitHubOAuthConfigured,
  listUserGitHubRepos,
} from '../services/github/githubService.ts';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function getGitHubStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({
    oauthConfigured: isGitHubOAuthConfigured(),
    connected: Boolean(req.user?.githubConnected),
    githubUsername: req.user?.githubUsername || null,
    githubAvatarUrl: req.user?.githubAvatarUrl || null,
    callbackUrl: env.githubCallbackUrl || `${env.appUrl}/auth/github/callback`,
  });
}

export async function getPublicGitHubAuthUrl(_req: Request, res: Response): Promise<void> {
  if (!isGitHubOAuthConfigured()) {
    res.status(400).json({
      error:
        'GitHub OAuth is not configured yet (set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET).',
    });
    return;
  }
  const state = jwt.sign(
    { purpose: 'github_signin', nonce: crypto.randomUUID() },
    env.jwtSecret,
    { expiresIn: '10m' }
  );
  const url = buildGitHubOAuthUrl(state);
  res.json({ url });
}

export async function getGitHubAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isGitHubOAuthConfigured()) {
    res.status(400).json({
      error:
        'GitHub OAuth is not configured on this server (missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET). You can still analyze any public GitHub repository by URL or upload a ZIP archive.',
    });
    return;
  }
  const state = jwt.sign(
    { uid: req.user!.id, purpose: 'github_oauth', nonce: crypto.randomUUID() },
    env.jwtSecret,
    { expiresIn: '10m' }
  );
  const url = buildGitHubOAuthUrl(state);
  res.json({ url });
}

export async function handleGitHubCallback(req: Request, res: Response): Promise<void> {
  const sendPopupResult = (
    payload: Record<string, unknown>,
    message: string,
    redirectTarget = '/repositories'
  ) => {
    const safeJson = (val: unknown) =>
      JSON.stringify(val)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

    const safePayload = safeJson(payload);
    const safeMessage = escapeHtml(message);
    const safeRedirect = safeJson(redirectTarget);
    res.send(`<!doctype html>
<html>
  <head><title>RepoMind GitHub Authorization</title></head>
  <body style="background:#080B12;color:#F1F5F9;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <div style="text-align:center;max-width:420px;padding:28px;border:1px solid #202A3A;border-radius:12px;background:#101623;">
      <p style="font-size:15px;font-weight:600;margin:0 0 8px 0;">${safeMessage}</p>
      <p style="font-size:13px;color:#94A3B8;margin:0;">Completing authentication and closing window...</p>
    </div>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${safePayload}, window.location.origin);
          window.close();
        } else {
          window.location.href = ${safeRedirect};
        }
      } catch (e) {}
    </script>
  </body>
</html>`);
  };

  try {
    const oauthError = typeof req.query.error_description === 'string'
      ? req.query.error_description
      : typeof req.query.error === 'string'
        ? req.query.error
        : '';
    if (oauthError) {
      sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: oauthError },
        'GitHub authorization was cancelled.'
      );
      return;
    }

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
    if (decoded.purpose !== 'github_oauth' && decoded.purpose !== 'github_signin') {
      sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: 'Invalid OAuth state.' },
        'Invalid or expired authorization state.'
      );
      return;
    }

    const gh = await exchangeGitHubCode(code);
    const now = new Date().toISOString();

    if (decoded.purpose === 'github_oauth') {
      if (!decoded.uid) {
        sendPopupResult(
          { type: 'GITHUB_OAUTH_ERROR', error: 'Missing user session context.' },
          'Invalid authorization state.'
        );
        return;
      }
      const existing = await db.findUserById(decoded.uid);
      if (!existing) {
        sendPopupResult(
          { type: 'GITHUB_OAUTH_ERROR', error: 'User account not found.' },
          'Unable to locate your RepoMind account.'
        );
        return;
      }

      await db.updateUser(decoded.uid, {
        githubId: gh.id,
        githubAccessToken: gh.accessToken,
        githubUsername: gh.username,
        githubAvatarUrl: gh.avatarUrl,
        authProvider: existing.passwordHash ? 'hybrid' : 'github',
        lastLoginAt: now,
      });

      sendPopupResult(
        { type: 'GITHUB_OAUTH_SUCCESS', githubUsername: gh.username },
        `Connected GitHub account @${gh.username}.`
      );
      return;
    }

    // Public Sign-In / Create Account via GitHub OAuth
    let user = await db.findUserByGitHubId(gh.id);
    if (!user && gh.email) {
      user = await db.findUserByEmail(gh.email);
    }

    if (user) {
      user =
        (await db.updateUser(user.id, {
          githubId: gh.id,
          githubAccessToken: gh.accessToken,
          githubUsername: gh.username,
          githubAvatarUrl: gh.avatarUrl || user.githubAvatarUrl,
          authProvider: user.passwordHash ? 'hybrid' : 'github',
          lastLoginAt: now,
        })) || user;
    } else {
      user = await db.createUser({
        name: gh.name || gh.username,
        email: gh.email,
        authProvider: 'github',
        githubId: gh.id,
        githubAccessToken: gh.accessToken,
        githubUsername: gh.username,
        githubAvatarUrl: gh.avatarUrl,
        lastLoginAt: now,
      });
    }

    const token = signAuthToken(user.id, user.email);
    setSessionCookie(res, token);

    sendPopupResult(
      {
        type: 'GITHUB_OAUTH_SIGNIN_SUCCESS',
        token,
        user: toPublicUser(user),
      },
      `Signed in as @${gh.username}.`,
      '/dashboard'
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
  const existing = await db.findUserById(req.user!.id);
  await db.updateUser(req.user!.id, {
    githubAccessToken: undefined,
    githubUsername: undefined,
    githubAvatarUrl: undefined,
    authProvider: existing?.passwordHash ? 'local' : 'github',
  });
  res.json({ ok: true });
}
