import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import configRouter from './routes/config.js';
import projectsRouter from './routes/projects.js';
import skillsRouter from './routes/skills.js';
import linksRouter from './routes/links.js';
import toolsRouter from './routes/tools.js';
import versionsRouter from './routes/versions.js';
import analyticsRouter from './routes/analytics.js';
import importRouter from './routes/import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/links', linksRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/import', importRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: serve static files
if (process.env.NODE_ENV === 'production') {
  // Support both local dev build and npm global install
  // In npm install: compiled JS is at dist/server/server/index.js, frontend at dist/
  // SM_PKG_ROOT is set by cli.ts to the package root directory
  const pkgRoot = process.env.SM_PKG_ROOT || path.resolve(__dirname, '..');
  const clientDist = path.join(pkgRoot, 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Skills Manager API server running at http://127.0.0.1:${port}`);
});

export default app;
