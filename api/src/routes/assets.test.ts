import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authedHeaders } from '../test/auth-test-utils.js';

const r2Mocks = vi.hoisted(() => ({
  getSignedGetUrl: vi.fn(async () => 'https://signed.example/o'),
  getSignedPutUrl: vi.fn(async () => 'https://signed.example/put'),
}));

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

vi.mock('../lib/r2.js', () => ({
  getBucket: () => 'cardgoose',
  getSignedGetUrl: r2Mocks.getSignedGetUrl,
  getSignedPutUrl: r2Mocks.getSignedPutUrl,
  copyObjectSameBucket: vi.fn(async () => {}),
}));

import { prisma } from '../test/prisma-mock.js';

import { createApp } from '../app.js';

const app = createApp();

describe('assets routes', () => {
  beforeEach(() => {
    r2Mocks.getSignedGetUrl.mockClear();
    r2Mocks.getSignedPutUrl.mockClear();
    prisma.user.upsert.mockReset();
    prisma.user.upsert.mockResolvedValue({});
    prisma.globalAsset.findMany.mockReset();
    prisma.globalAsset.findMany.mockResolvedValue([]);
  });

  it('404 when project missing', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/assets').set(authedHeaders());
    expect(res.status).toBe(404);
  });

  it('lists assets without URLs', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.findMany.mockResolvedValueOnce([
      { id: '1', artKey: 'a', s3Key: 'k', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app).get('/api/projects/p1/assets').set(authedHeaders());
    expect(res.status).toBe(200);
    expect(res.body.assets[0].url).toBeUndefined();
    expect(Array.isArray(res.body.globalAssets)).toBe(true);
  });

  it('includes signed URLs when requested', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.findMany.mockResolvedValueOnce([
      { id: '1', artKey: 'a', s3Key: 'k', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app)
      .get('/api/projects/p1/assets?includeUrls=1')
      .set(authedHeaders());
    expect(res.status).toBe(200);
    expect(res.body.assets[0].url).toBe('https://signed.example/o');
  });

  it('400 upload-url without filename', async () => {
    const res = await request(app)
      .post('/api/projects/p1/assets/upload-url')
      .set(authedHeaders())
      .send({ contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('404 upload-url when project missing', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/assets/upload-url')
      .set(authedHeaders())
      .send({ filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns presigned upload URL', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    const res = await request(app)
      .post('/api/projects/p1/assets/upload-url')
      .set(authedHeaders())
      .send({ filename: 'card.png', contentType: 'image/png', artKey: 'hero' });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe('https://signed.example/put');
    expect(res.body.artKey).toBe('hero');
    expect(r2Mocks.getSignedPutUrl).toHaveBeenCalled();
  });

  it('201 confirm upload', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.upsert.mockResolvedValueOnce({
      id: 'a1',
      artKey: 'hero',
      s3Key: 'p1/hero',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/projects/p1/assets/confirm')
      .set(authedHeaders())
      .send({ s3Key: 'p1/hero', artKey: 'hero' });
    expect(res.status).toBe(201);
    expect(res.body.asset.artKey).toBe('hero');
  });
});
