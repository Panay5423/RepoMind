import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { env } from './server/config/env.ts';
import { initDatabase } from './server/models/store.ts';
import { apiRouter, oauthCallbackRouter } from './server/routes/index.ts';

async function startServer(): Promise<void> {
  await initDatabase();

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Mount OAuth callback and API endpoints
  app.use(oauthCallbackRouter);
  app.use('/api', apiRouter);

  // Express error middleware (including Multer file upload validation errors)
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'ZIP file exceeds the 25 MB upload limit.' });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message || 'Request failed.' });
        return;
      }
    }
  );

  if (env.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/auth/')) {
        next();
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Production build not found.');
      }
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[RepoMind] Server running on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('[RepoMind] Fatal server startup error:', err);
  process.exit(1);
});
