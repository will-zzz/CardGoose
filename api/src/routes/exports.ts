import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { buildPdfExportPayload } from '../lib/pdfExportPayload.js';
import { requireAuth } from '../middleware/auth.js';
import { getExportsBucket, getSignedGetUrl, listObjectKeys, putObject } from '../lib/s3.js';
import { sendJsonMessage } from '../lib/sqs.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const PAYLOAD_INLINE_MAX_BYTES = 200 * 1024;

export const exportsRouter: IRouter = Router();
exportsRouter.use(requireAuth);

exportsRouter.post('/projects/:projectId/export', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const timestamp = new Date().toISOString();
  await sendJsonMessage({
    type: 'export-legacy-json',
    projectId,
    userId,
    timestamp,
  });
  req.log.info({ projectId, userId, timestamp }, 'exports.enqueue sqs send ok');

  res.json({ queued: true, projectId, timestamp });
});

/** Full PDF export: enqueue job with layout + CSV + presigned asset URLs for the worker. */
exportsRouter.post('/projects/:projectId/export-pdf', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const dpi = (req.body as { dpi?: unknown } | undefined)?.dpi;

  const built = await buildPdfExportPayload(projectId, userId, { dpi });
  if ('error' in built) {
    if (built.error === 'Project not found') {
      res.status(404).json({ error: built.error });
    } else {
      res.status(400).json({ error: built.error });
    }
    return;
  }

  const { payload, timestamp } = built;
  const bodyStr = JSON.stringify(payload);
  const bodyBytes = Buffer.byteLength(bodyStr, 'utf8');

  let message: Record<string, unknown>;

  if (bodyBytes <= PAYLOAD_INLINE_MAX_BYTES) {
    message = payload;
  } else {
    const id = randomUUID();
    const key = `${projectId}/payloads/${id}.json`;
    const exportsBucket = getExportsBucket();
    await putObject(exportsBucket, key, Buffer.from(bodyStr, 'utf8'), 'application/json');
    req.log.info({ projectId, key, bytes: bodyBytes }, 'exports-pdf payload stored in S3');
    message = {
      type: 'export-pdf',
      projectId,
      userId,
      timestamp,
      payloadS3Key: key,
    };
  }

  await sendJsonMessage(message);
  req.log.info({ projectId, userId, timestamp, inline: bodyBytes <= PAYLOAD_INLINE_MAX_BYTES }, 'exports-pdf sqs ok');

  res.json({ queued: true, projectId, timestamp });
});

/**
 * Run PDF export in-process via Python subprocess (bypasses SQS). For local debugging.
 */
exportsRouter.post('/projects/:projectId/export-pdf-direct', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const dpi = (req.body as { dpi?: unknown } | undefined)?.dpi;

  const built = await buildPdfExportPayload(projectId, userId, { dpi });
  if ('error' in built) {
    if (built.error === 'Project not found') {
      res.status(404).json({ error: built.error });
    } else {
      res.status(400).json({ error: built.error });
    }
    return;
  }

  const { payload, timestamp } = built;
  const tmpPath = join(tmpdir(), `pdf-export-${randomUUID()}.json`);
  const workerSrc = process.env.WORKER_SRC_DIR ?? join(repoRoot, 'worker', 'src');
  const workerRoot = join(workerSrc, '..');

  try {
    writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');

    const py = process.env.PYTHON_BIN ?? 'python3';
    const result = spawnSync(py, ['-m', 'baker.run_pdf_sync', tmpPath], {
      env: { ...process.env, PYTHONPATH: workerSrc, PYTHONUNBUFFERED: '1' },
      cwd: workerRoot,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.error) {
      req.log.error({ err: result.error }, 'export-pdf-direct spawn failed');
      res.status(502).json({ error: `Failed to start Python: ${result.error.message}` });
      return;
    }

    const out = (result.stdout ?? '').trim();
    const err = (result.stderr ?? '').trim();

    if (result.status !== 0) {
      req.log.warn(
        { status: result.status, stderr: err, stdout: out },
        'export-pdf-direct python failed',
      );
      try {
        const j = JSON.parse(out) as { ok?: boolean; error?: string };
        if (j && j.ok === false && typeof j.error === 'string' && j.error.trim()) {
          res.status(502).json({ error: j.error.trim() });
          return;
        }
      } catch {
        /* fall through to raw detail */
      }
      let detail = err || out || 'Unknown error';
      if (detail.length > 2000) detail = `${detail.slice(0, 2000)}…`;
      res.status(502).json({ error: 'PDF export failed', detail });
      return;
    }

    let parsed: { ok?: boolean; s3Key?: string; error?: string };
    try {
      parsed = JSON.parse(out) as { ok?: boolean; s3Key?: string; error?: string };
    } catch {
      res.status(502).json({ error: 'Invalid worker output', detail: out.slice(0, 500) });
      return;
    }

    if (!parsed.ok || !parsed.s3Key) {
      res.status(502).json({ error: parsed.error ?? 'PDF export failed' });
      return;
    }

    if (err) {
      const cap = 12_000;
      req.log.info(
        {
          projectId,
          stderrChars: err.length,
          stderr: err.length > cap ? `${err.slice(0, cap)}…` : err,
        },
        'export-pdf-direct subprocess stderr (Python baker logs; only after process exits)',
      );
    }
    req.log.info({ projectId, s3Key: parsed.s3Key }, 'export-pdf-direct ok');
    res.json({ ok: true, projectId, timestamp, s3Key: parsed.s3Key });
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
});

exportsRouter.get('/projects/:projectId/exports', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const bucket = getExportsBucket();
  const prefix = `${projectId}/`;
  const keys = await listObjectKeys(bucket, prefix);

  const exports = await Promise.all(
    keys.map(async (key) => ({
      key,
      url: await getSignedGetUrl(bucket, key),
    })),
  );

  res.json({ exports });
});
