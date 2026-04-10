import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signToken } from '../lib/jwt.js';

const s3Mocks = vi.hoisted(() => ({
  putObject: vi.fn(async () => {}),
  getSignedGetUrl: vi.fn(async () => 'https://signed.example/o'),
}));

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

vi.mock('../lib/s3.js', () => ({
  getAssetsBucket: () => 'assets-bucket',
  putObject: s3Mocks.putObject,
  getSignedGetUrl: s3Mocks.getSignedGetUrl,
}));

import { prisma } from '../test/prisma-mock.js';

import { createApp } from '../app.js';

const app = createApp();

function authed() {
  const token = signToken({ sub: 'u1', username: 'a@b.com' });
  return { Authorization: `Bearer ${token}` };
}

describe('assets routes', () => {
  beforeEach(() => {
    s3Mocks.putObject.mockClear();
    s3Mocks.putObject.mockResolvedValue(undefined);
  });

  it('404 when project missing', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/assets').set(authed());
    expect(res.status).toBe(404);
  });

  it('lists assets without URLs', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.findMany.mockResolvedValueOnce([
      { id: '1', artKey: 'a', s3Key: 'k', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app).get('/api/projects/p1/assets').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.assets[0].url).toBeUndefined();
  });

  it('includes signed URLs when requested', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.findMany.mockResolvedValueOnce([
      { id: '1', artKey: 'a', s3Key: 'k', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app).get('/api/projects/p1/assets?includeUrls=1').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.assets[0].url).toBe('https://signed.example/o');
  });

  it('400 upload without file', async () => {
    const res = await request(app)
      .post('/api/projects/p1/assets')
      .set(authed())
      .field('artKey', 'hero');
    expect(res.status).toBe(400);
  });

  it('404 upload when project missing', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/assets')
      .set(authed())
      .attach('file', Buffer.from('x'), 'x.png');
    expect(res.status).toBe(404);
  });

  it('uses sanitized filename when artKey omitted', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.upsert.mockResolvedValueOnce({
      id: 'a1',
      artKey: 'x',
      s3Key: 'p1/x',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/projects/p1/assets')
      .set(authed())
      .attach('file', Buffer.from('x'), 'weird!!!name?.png');
    expect(res.status).toBe(201);
  });

  it('uses explicit artKey from body', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.upsert.mockResolvedValueOnce({
      id: 'a1',
      artKey: 'hero',
      s3Key: 'p1/hero',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/projects/p1/assets')
      .set(authed())
      .field('artKey', 'hero')
      .attach('file', Buffer.from('d'), 'ignored.png');
    expect(res.status).toBe(201);
  });

  it('201 upload file', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.asset.upsert.mockResolvedValueOnce({
      id: 'a1',
      artKey: 'pic',
      s3Key: 'p1/pic',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/projects/p1/assets')
      .set(authed())
      .attach('file', Buffer.from('png-bytes'), 'card.png');
    expect(res.status).toBe(201);
    expect(s3Mocks.putObject).toHaveBeenCalled();
  });
});
