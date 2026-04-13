import { Router, type IRouter } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { copyObjectSameBucket, getAssetsBucket, getSignedGetUrl, putObject } from '../lib/s3.js';

export const assetsRouter: IRouter = Router();
assetsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Canonical art key stored in DB (lowercase slug, no extension). */
export function normalizeStoredArtKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\.(png|jpe?g|gif|webp|svg|bmp)$/i, '');
  s = s.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'asset';
}

function artKeyFromUpload(bodyArtKey: unknown, originalname: string): string {
  if (typeof bodyArtKey === 'string' && bodyArtKey.trim()) {
    return normalizeStoredArtKey(bodyArtKey);
  }
  const base = originalname.replace(/\.[^.]+$/, '');
  return normalizeStoredArtKey(base || originalname);
}

assetsRouter.get('/projects/:projectId/assets', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const [assets, globalAssets] = await Promise.all([
    prisma.asset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
    }),
    prisma.globalAsset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
    }),
  ]);

  const includeUrls =
    String(req.query.includeUrls) === '1' || String(req.query.includeUrls) === 'true';
  if (!includeUrls) {
    res.json({ assets, globalAssets });
    return;
  }
  const bucket = getAssetsBucket();
  const signRow = async <T extends { s3Key: string }>(row: T) => ({
    ...row,
    url: await getSignedGetUrl(bucket, row.s3Key),
  });
  const [withProjectUrls, withGlobalUrls] = await Promise.all([
    Promise.all(assets.map(signRow)),
    Promise.all(globalAssets.map(signRow)),
  ]);
  res.json({ assets: withProjectUrls, globalAssets: withGlobalUrls });
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
  const artKey = artKeyFromUpload(bodyArtKey, file.originalname);

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

/** Upload into the signed-in user's global library. */
assetsRouter.post('/user/global-assets', upload.single('file'), async (req, res) => {
  const userId = req.user!.id;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'file field is required' });
    return;
  }

  const bodyArtKey = (req.body as { artKey?: string }).artKey;
  const artKey = artKeyFromUpload(bodyArtKey, file.originalname);

  const bucket = getAssetsBucket();
  const s3Key = `global/${userId}/${artKey}`;

  await putObject(bucket, s3Key, file.buffer, file.mimetype || 'application/octet-stream');

  const row = await prisma.globalAsset.upsert({
    where: { userId_artKey: { userId, artKey } },
    create: { userId, artKey, s3Key },
    update: { s3Key },
    select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
  });

  res.status(201).json({ asset: row });
});

/** Copy S3 object to global library and remove the project row (content moves to global). */
assetsRouter.post('/projects/:projectId/assets/:assetId/promote-global', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const assetId = String(req.params.assetId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, projectId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const bucket = getAssetsBucket();
  const destKey = `global/${userId}/${normalizeStoredArtKey(existing.artKey)}`;

  await copyObjectSameBucket(bucket, existing.s3Key, destKey);

  const global = await prisma.$transaction(async (tx) => {
    await tx.asset.delete({ where: { id: existing.id } });
    return tx.globalAsset.upsert({
      where: { userId_artKey: { userId, artKey: normalizeStoredArtKey(existing.artKey) } },
      create: {
        userId,
        artKey: normalizeStoredArtKey(existing.artKey),
        s3Key: destKey,
      },
      update: { s3Key: destKey },
      select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
    });
  });

  res.json({ asset: global });
});

assetsRouter.delete('/projects/:projectId/assets/:assetId', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const assetId = String(req.params.assetId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, projectId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  await prisma.asset.delete({ where: { id: existing.id } });
  res.status(204).end();
});

assetsRouter.delete('/user/global-assets/:assetId', async (req, res) => {
  const userId = req.user!.id;
  const assetId = String(req.params.assetId);

  const existing = await prisma.globalAsset.findFirst({
    where: { id: assetId, userId },
  });
  if (!existing) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  await prisma.globalAsset.delete({ where: { id: existing.id } });
  res.status(204).end();
});
