import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getExportsBucket, getSignedGetUrl, listObjectKeys } from '../lib/s3.js';
import { sendJsonMessage } from '../lib/sqs.js';

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
    projectId,
    userId,
    timestamp,
  });
  req.log.info({ projectId, userId, timestamp }, 'exports.enqueue sqs send ok');

  res.json({ queued: true, projectId, timestamp });
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
