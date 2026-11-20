import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const globalWithSecret = globalThis as typeof globalThis & { __repomindJwtSecret?: string };

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (!globalWithSecret.__repomindJwtSecret) {
    globalWithSecret.__repomindJwtSecret = crypto.randomBytes(48).toString('hex');
    console.warn(
      '[RepoMind] JWT_SECRET not configured; generated an ephemeral runtime secret. Set JWT_SECRET in production.'
    );
  }
  return globalWithSecret.__repomindJwtSecret;
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  jwtSecret: getJwtSecret(),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  githubClientId: (process.env.GITHUB_CLIENT_ID || '').trim(),
  githubClientSecret: (process.env.GITHUB_CLIENT_SECRET || '').trim(),
  githubCallbackUrl: (process.env.GITHUB_CALLBACK_URL || '').trim(),
  githubFallbackToken: (process.env.GITHUB_TOKEN || '').trim(),
};
