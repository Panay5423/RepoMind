import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../models/store.ts';
import { signAuthToken, type AuthenticatedRequest } from '../middleware/auth.ts';
import type { PublicUser } from '../../shared/types.ts';

function toPublicUser(u: {
  id: string;
  name: string;
  email: string;
  githubAccessToken?: string;
  githubUsername?: string;
  githubAvatarUrl?: string;
  createdAt: string;
}): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    githubConnected: Boolean(u.githubAccessToken),
    githubUsername: u.githubUsername,
    githubAvatarUrl: u.githubAvatarUrl,
    createdAt: u.createdAt,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = await db.findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    const token = signAuthToken(user.id, user.email);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Unable to complete registration.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signAuthToken(user.id, user.email);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Unable to sign in.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({ user: req.user });
}

export async function demoLogin(_req: Request, res: Response): Promise<void> {
  try {
    const demoEmail = 'engineer@repomind.dev';
    let user = await db.findUserByEmail(demoEmail);
    if (!user) {
      const passwordHash = await bcrypt.hash('RepoMindDemo!2026', 10);
      user = await db.createUser({
        name: 'Alex Rivera',
        email: demoEmail,
        passwordHash,
      });
    }
    const token = signAuthToken(user.id, user.email);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('[Auth] Demo login error:', err);
    res.status(500).json({ error: 'Unable to initialize workspace session.' });
  }
}
