import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.ts';
import { db } from '../models/store.ts';
import type { PublicUser } from '../../shared/types.ts';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export function signAuthToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: '7d' });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string };
    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid authentication token.' });
      return;
    }

    const user = await db.findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      githubConnected: Boolean(user.githubAccessToken),
      githubUsername: user.githubUsername,
      githubAvatarUrl: user.githubAvatarUrl,
      createdAt: user.createdAt,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

export const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait a moment before sending more requests.' },
});

export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
