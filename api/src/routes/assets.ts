import { Router, type IRouter } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getAssetsBucket, getSignedGetUrl, putObject } from '../lib/s3.js';

export const assetsRouter: IRouter = Router();
assetsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

assetsRouter.get('/projects/:projectId/assets', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const assets = await prisma.asset.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
  });
  const includeUrls =
    String(req.query.includeUrls) === '1' || String(req.query.includeUrls) === 'true';
  if (!includeUrls) {
    res.json({ assets });
    return;
  }
  const bucket = getAssetsBucket();
  const withUrls = await Promise.all(
    assets.map(async (a) => ({
      ...a,
      url: await getSignedGetUrl(bucket, a.s3Key),
    }))
  );
  res.json({ assets: withUrls });
});

assetsRouter.post('/projects/:projectId/assets', upload.single('file'), async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'file field is required' });
    return;
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const bodyArtKey = (req.body as { artKey?: string }).artKey;
  const artKey =
    typeof bodyArtKey === 'string' && bodyArtKey.trim()
      ? bodyArtKey.trim()
      : file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';

  const bucket = getAssetsBucket();
  const s3Key = `${projectId}/${artKey}`;

  await putObject(bucket, s3Key, file.buffer, file.mimetype || 'application/octet-stream');
  req.log.info(
    { projectId, bucket, s3Key, bytes: file.buffer.length, contentType: file.mimetype },
    'assets.upload s3 put ok'
  );

  const asset = await prisma.asset.upsert({
    where: {
      projectId_artKey: { projectId, artKey },
    },
    create: {
      projectId,
      artKey,
      s3Key,
    },
    update: {
      s3Key,
    },
    select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
  });

  res.status(201).json({ asset });
});
