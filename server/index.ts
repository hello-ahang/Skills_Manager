import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import publishRouter from './routes/publish.js';
import importStreamRouter from './routes/import-stream.js';
import radarRouter from './routes/radar.js';
import skillLintRouter from './routes/skill-lint.js';
import sandboxRouter from './routes/sandbox.js';
import skillRubricRouter from './routes/skill-rubric.js';
import evalLoopRouter from './routes/eval-loop.js';
import compareRouter from './routes/compare.js';
import feedbackRouter from './routes/feedback.js';
import freshRouter from './routes/fresh.js';
import backupRouter from './routes/backup.js';
import skillCardRouter from './routes/skill-card.js';
import { loadExtensions } from './extensions.js';
import { authMiddleware, ensureToken } from './middleware/auth.js';
import { pathGuard } from './middleware/pathGuard.js';
import { rateLimit } from './middleware/rateLimit.js';
import { migrateLegacyJsonl } from './db/sqlite.js';
import { log } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.SM_HOST || '127.0.0.1';

const isDev = process.env.NODE_ENV !== 'production';

const allowedOrigins = new Set<string>([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
]);

const LOCAL_ORIGIN_RE = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  // In dev, accept any localhost/127.0.0.1 origin (port may vary)
  if (isDev && LOCAL_ORIGIN_RE.test(origin)) return true;
  return false;
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin)) return cb(null, true);
      log.warn({ origin }, '[CORS] rejected origin');
      // Return false (not error) so the request fails silently at the browser
      // without polluting the server error handler
      return cb(null, false);
    },
    credentials: false,
    allowedHeaders: ['Content-Type', 'X-SM-Token'],
  })
);
// 50mb was a DoS vector for global JSON parsing. Most endpoints take small
// payloads; specialized routes (e.g. backup import) use multipart, not JSON.
app.use(express.json({ limit: '1mb' }));
app.use(authMiddleware);
app.use('/api', pathGuard());

// Rate limits — per-IP, in-memory. Tighter caps on routes that fan out to
// outbound HTTP (fresh) or do heavy disk work (backup import/export).
app.use('/api', rateLimit({ max: 300, windowMs: 60_000 }));
app.use('/api/fresh', rateLimit({ max: 10, windowMs: 60_000, message: 'Freshness checks are rate-limited; try again shortly.' }));
app.use('/api/backup', rateLimit({ max: 5, windowMs: 60_000, message: 'Backup operations are rate-limited.' }));
// Rate-limit only the AI-bound generation endpoint, not the cheap local
// GET/DELETE ops on stored cards. Otherwise opening the card library or
// reopening the dialog a few times would burn the 15/min budget.
app.use('/api/skill-card/generate', rateLimit({ max: 15, windowMs: 60_000, message: 'Skill card generation is rate-limited; try again shortly.' }));

// API Routes
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/links', linksRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/import', importRouter);
app.use('/api/publish', publishRouter);
app.use('/api/import-stream', importStreamRouter);
app.use('/api/radar', radarRouter);
app.use('/api/skill-lint', skillLintRouter);
app.use('/api/sandbox', sandboxRouter);
app.use('/api/skill-rubric', skillRubricRouter);
app.use('/api/eval-loop', evalLoopRouter);
app.use('/api/compare', compareRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/fresh', freshRouter);
app.use('/api/backup', backupRouter);
app.use('/api/skill-card', skillCardRouter);

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
  log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

function startListening(): void {
  app.listen(port, host, () => {
    log.info(`Skills Manager API server running at http://${host}:${port}`);
    if (process.env.NODE_ENV !== 'production') {
      // Auth is enforced in dev too (v1.6 hardening, see auth.ts). The Vite
      // dev server reads ~/.skills-manager/security.json and injects ?token=
      // into the auto-open URL so the frontend captures it on first load. Set
      // SM_AUTH_DISABLE=1 to bypass auth (loopback host only).
      log.info('[Dev] API auth enforced; Vite opens with ?token= from ~/.skills-manager/security.json. Set SM_AUTH_DISABLE=1 (loopback only) to bypass.');
    }
  });
}

// Initialize auth token + SQLite migration first, then load extensions, then listen
ensureToken()
  .then(() => migrateLegacyJsonl())
  .then(() => loadExtensions())
  .then(() => {
    startListening();
  })
  .catch((err) => {
    log.error({ err }, '[Server] Initialization warning');
    // Start server anyway so user can recover via UI
    startListening();
  });

export default app;
