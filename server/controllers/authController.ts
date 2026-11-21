import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.ts';
import { db } from '../models/store.ts';
import {
  clearSessionCookie,
  setSessionCookie,
  signAuthToken,
  toPublicUser,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { isGitHubOAuthConfigured } from '../services/github/githubService.ts';

export async function getAuthProviders(_req: Request, res: Response): Promise<void> {
  res.json({
    githubOAuthConfigured: isGitHubOAuthConfigured(),
    callbackUrl: env.githubCallbackUrl || `${env.appUrl}/auth/github/callback`,
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const roleTitle = typeof body.roleTitle === 'string' ? body.roleTitle.trim().slice(0, 60) : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }

    const existing = await db.findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const user = await db.createUser({
      name,
      email,
      passwordHash,
      roleTitle: roleTitle || undefined,
      authProvider: 'local',
      lastLoginAt: now,
    });

    const token = signAuthToken(user.id, user.email);
    setSessionCookie(res, token);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Unable to complete registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({
        error:
          'This account was created with GitHub. Please click "Continue with GitHub" to sign in.',
      });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const updated =
      (await db.updateUser(user.id, { lastLoginAt: new Date().toISOString() })) || user;
    const token = signAuthToken(updated.id, updated.email);
    setSessionCookie(res, token);
    res.json({ token, user: toPublicUser(updated) });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Unable to sign in.' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearSessionCookie(res);
  res.json({ ok: true });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ user: req.user });
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const currentUser = await db.findUserById(userId);
    if (!currentUser) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const trimmedName = body.name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 80) {
        res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
        return;
      }
      patch.name = trimmedName;
    }

    if (typeof body.roleTitle === 'string') {
      const trimmedRole = body.roleTitle.trim().slice(0, 60);
      patch.roleTitle = trimmedRole || undefined;
    }

    if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
      if (body.newPassword.length < 8 || body.newPassword.length > 128) {
        res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
        return;
      }
      if (currentUser.passwordHash) {
        const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        if (!currentPassword) {
          res.status(400).json({ error: 'Current password is required to change your password.' });
          return;
        }
        const ok = await bcrypt.compare(currentPassword, currentUser.passwordHash);
        if (!ok) {
          res.status(401).json({ error: 'Current password is incorrect.' });
          return;
        }
      }
      patch.passwordHash = await bcrypt.hash(body.newPassword, 12);
      patch.authProvider = currentUser.githubId ? 'hybrid' : 'local';
    }

    const updated = (await db.updateUser(userId, patch)) || currentUser;
    res.json({ user: toPublicUser(updated) });
  } catch (err) {
    console.error('[Auth] Profile update error:', err);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
}

export async function demoLogin(_req: Request, res: Response): Promise<void> {
  try {
    const demoEmail = 'engineer@repomind.dev';
    let user = await db.findUserByEmail(demoEmail);
    const now = new Date().toISOString();
    if (!user) {
      const passwordHash = await bcrypt.hash('RepoMindDemo!2026', 10);
      user = await db.createUser({
        name: 'Alex Rivera',
        email: demoEmail,
        passwordHash,
        roleTitle: 'Staff Engineer',
        authProvider: 'local',
        lastLoginAt: now,
      });
    } else {
      user = (await db.updateUser(user.id, { lastLoginAt: now })) || user;
    }
    const token = signAuthToken(user.id, user.email);
    setSessionCookie(res, token);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('[Auth] Demo login error:', err);
    res.status(500).json({ error: 'Unable to initialize workspace session.' });
  }
}
