import { Router, type IRouter } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { copyObjectSameBucket, getBucket, getSignedGetUrl, getSignedPutUrl } from '../lib/r2.js';

export const assetsRouter: IRouter = Router();
assetsRouter.use(requireAuth);

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
]);

/** Canonical art key stored in DB (lowercase slug, no extension). */
export function normalizeStoredArtKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\.(png|jpe?g|gif|webp|svg|bmp)$/i, '');
  s = s.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'asset';
}

function artKeyFromFilename(bodyArtKey: unknown, filename: string): string {
  if (typeof bodyArtKey === 'string' && bodyArtKey.trim()) {
    return normalizeStoredArtKey(bodyArtKey);
  }
  const base = filename.replace(/\.[^.]+$/, '');
  return normalizeStoredArtKey(base || filename);
}

// ---------------------------------------------------------------------------
// GET assets
// ---------------------------------------------------------------------------

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
  const bucket = getBucket();
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

// ---------------------------------------------------------------------------
// Presigned upload URL — client uploads directly to R2
// ---------------------------------------------------------------------------

assetsRouter.post('/projects/:projectId/assets/upload-url', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const {
    filename,
    contentType,
    artKey: bodyArtKey,
  } = req.body as {
    filename?: string;
    contentType?: string;
    artKey?: string;
  };

  if (!filename || typeof filename !== 'string') {
    res.status(400).json({ error: 'filename is required' });
    return;
  }
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    res.status(400).json({ error: 'contentType must be an image MIME type' });
    return;
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const artKey = artKeyFromFilename(bodyArtKey, filename);
  const bucket = getBucket();
  const s3Key = `${projectId}/${artKey}`;
  const uploadUrl = await getSignedPutUrl(bucket, s3Key, contentType);

  res.json({ uploadUrl, s3Key, artKey });
});

assetsRouter.post('/projects/:projectId/assets/confirm', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const { s3Key, artKey } = req.body as { s3Key?: string; artKey?: string };

  if (!s3Key || typeof s3Key !== 'string') {
    res.status(400).json({ error: 's3Key is required' });
    return;
  }
  if (!artKey || typeof artKey !== 'string') {
    res.status(400).json({ error: 'artKey is required' });
    return;
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const asset = await prisma.asset.upsert({
    where: { projectId_artKey: { projectId, artKey } },
    create: { projectId, artKey, s3Key },
    update: { s3Key },
    select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
  });

  res.status(201).json({ asset });
});

// ---------------------------------------------------------------------------
// Global assets
// ---------------------------------------------------------------------------

assetsRouter.post('/user/global-assets/upload-url', async (req, res) => {
  const userId = req.user!.id;
  const {
    filename,
    contentType,
    artKey: bodyArtKey,
  } = req.body as {
    filename?: string;
    contentType?: string;
    artKey?: string;
  };

  if (!filename || typeof filename !== 'string') {
    res.status(400).json({ error: 'filename is required' });
    return;
  }
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    res.status(400).json({ error: 'contentType must be an image MIME type' });
    return;
  }

  const artKey = artKeyFromFilename(bodyArtKey, filename);
  const bucket = getBucket();
  const s3Key = `global/${userId}/${artKey}`;
  const uploadUrl = await getSignedPutUrl(bucket, s3Key, contentType);

  res.json({ uploadUrl, s3Key, artKey });
});

assetsRouter.post('/user/global-assets/confirm', async (req, res) => {
  const userId = req.user!.id;
  const { s3Key, artKey } = req.body as { s3Key?: string; artKey?: string };

  if (!s3Key || typeof s3Key !== 'string') {
    res.status(400).json({ error: 's3Key is required' });
    return;
  }
  if (!artKey || typeof artKey !== 'string') {
    res.status(400).json({ error: 'artKey is required' });
    return;
  }

  const row = await prisma.globalAsset.upsert({
    where: { userId_artKey: { userId, artKey } },
    create: { userId, artKey, s3Key },
    update: { s3Key },
    select: { id: true, artKey: true, s3Key: true, createdAt: true, updatedAt: true },
  });

  res.status(201).json({ asset: row });
});

// ---------------------------------------------------------------------------
// Promote project asset to global library
// ---------------------------------------------------------------------------

assetsRouter.post('/projects/:projectId/assets/:assetId/promote-global', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const assetId = String(req.params.assetId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
  if (!existing) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const bucket = getBucket();
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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

assetsRouter.delete('/projects/:projectId/assets/:assetId', async (req, res) => {
  const userId = req.user!.id;
  const projectId = String(req.params.projectId);
  const assetId = String(req.params.assetId);

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const existing = await prisma.asset.findFirst({ where: { id: assetId, projectId } });
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

  const existing = await prisma.globalAsset.findFirst({ where: { id: assetId, userId } });
  if (!existing) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  await prisma.globalAsset.delete({ where: { id: existing.id } });
  res.status(204).end();
});
