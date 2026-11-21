import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.ts';
import { db, type StoredUser } from '../models/store.ts';
import type { PublicUser } from '../../shared/types.ts';

export const SESSION_COOKIE_NAME = 'repomind_session';

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export function toPublicUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleTitle: u.roleTitle,
    authProvider: u.authProvider || (u.githubId ? 'github' : 'local'),
    hasPassword: Boolean(u.passwordHash),
    githubConnected: Boolean(u.githubAccessToken),
    githubUsername: u.githubUsername,
    githubAvatarUrl: u.githubAvatarUrl,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}

export function signAuthToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.jwtSecret, { expiresIn: '7d' });
}

export function setSessionCookie(res: Response, token: string): void {
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  res.append('Set-Cookie', parts.join('; '));
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(idx + 1).trim());
      } catch {
        return pair.slice(idx + 1).trim();
      }
    }
  }
  return '';
}

function isSameOriginOrCustomHeader(req: Request): boolean {
  if (req.headers['x-requested-with']) return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    return Boolean(originHost && hostHeader && originHost === hostHeader);
  } catch {
    return false;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = parseCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
    const token = bearerToken || cookieToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    // CSRF guard when authenticating solely via cookie on state-changing routes
    if (!bearerToken && cookieToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (!isSameOriginOrCustomHeader(req)) {
        res.status(403).json({ error: 'Cross-site request validation failed.' });
        return;
      }
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

    req.user = toPublicUser(user);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
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
