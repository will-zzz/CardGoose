import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { assetsRouter } from './routes/assets.js';
import { exportsRouter } from './routes/exports.js';
import { rootLogger } from './lib/logger.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.NODE_ENV !== 'production') {
  const localEnv = join(repoRoot, '.env.local');
  if (existsSync(localEnv)) {
    loadEnv({ path: localEnv });
  }
}

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  pinoHttp({
    logger: rootLogger,
    genReqId: () => randomUUID(),
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} — ${err instanceof Error ? err.message : 'error'}`,
  })
);

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin === '*' || !corsOrigin ? true : corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cardboardforge-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', assetsRouter);
app.use('/api', exportsRouter);

app.listen(port, () => {
  rootLogger.info(
    {
      port,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      awsEndpoint: process.env.AWS_ENDPOINT_URL ?? '(real AWS)',
    },
    'API listening'
  );
});
