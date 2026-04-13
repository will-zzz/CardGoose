import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signToken } from '../lib/jwt.js';

const sqsMocks = vi.hoisted(() => ({
  sendJsonMessage: vi.fn(async () => {}),
}));

const s3ExportMocks = vi.hoisted(() => ({
  putObject: vi.fn(async () => {}),
}));

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

vi.mock('../lib/s3.js', () => ({
  getExportsBucket: () => 'exports-bucket',
  getAssetsBucket: () => 'assets-bucket',
  getSignedGetUrl: vi.fn(async () => 'https://signed'),
  listObjectKeys: vi.fn(async () => ['p1/a.pdf', 'p1/b.pdf']),
  putObject: s3ExportMocks.putObject,
}));

vi.mock('../lib/sqs.js', () => ({
  sendJsonMessage: sqsMocks.sendJsonMessage,
}));

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(() => ({
    status: 0,
    stdout: JSON.stringify({ ok: true, s3Key: 'exports/out.pdf' }),
    stderr: '',
    error: undefined,
  })),
}));

import { spawnSync } from 'node:child_process';
import { prisma } from '../test/prisma-mock.js';
import { createApp } from '../app.js';

const app = createApp();

function authed() {
  const token = signToken({ sub: 'u1', username: 'a@b.com' });
  return { Authorization: `Bearer ${token}` };
}

describe('exports routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.globalAsset.findMany.mockResolvedValue([]);
  });

  it('POST /export enqueues', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    const res = await request(app).post('/api/projects/p1/export').set(authed()).send({});
    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(true);
    expect(sqsMocks.sendJsonMessage).toHaveBeenCalled();
  });

  it('POST /export 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/projects/p1/export').set(authed()).send({});
    expect(res.status).toBe(404);
  });

  it('POST /export-pdf 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/projects/p1/export-pdf').set(authed()).send({});
    expect(res.status).toBe(404);
  });

  it('POST /export-pdf 400 when no groups', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([]);
    const res = await request(app).post('/api/projects/p1/export-pdf').set(authed()).send({});
    expect(res.status).toBe(400);
  });

  it('POST /export-pdf queues inline', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'art1',
              },
            ],
          },
        },
        csvData: { headers: ['A'], rows: [{ A: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'art1', s3Key: 'k' }]);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf')
      .set(authed())
      .send({ dpi: 200 });
    expect(res.status).toBe(200);
    expect(sqsMocks.sendJsonMessage).toHaveBeenCalled();
  });

  it('POST /export-pdf stores large payload in S3', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    /** Few columns (≤64) but huge cell strings so JSON exceeds 200 KiB inline cap */
    const headers = Array.from({ length: 32 }, (_, i) => `c${i}`);
    const bigRow = Object.fromEntries(headers.map((h) => [h, 'z'.repeat(8000)]));
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: Array.from({ length: 30 }, (_, j) => ({
              type: 'image' as const,
              id: `i${j}`,
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              artKey: `art${j}`,
            })),
          },
        },
        csvData: { headers, rows: [bigRow] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce(
      Array.from({ length: 30 }, (_, j) => ({ artKey: `art${j}`, s3Key: `k${j}` }))
    );
    const res = await request(app)
      .post('/api/projects/p1/export-pdf')
      .set(authed())
      .send({ dpi: 150 });
    expect(res.status).toBe(200);
    expect(s3ExportMocks.putObject).toHaveBeenCalled();
  });

  it('GET /exports lists', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    const res = await request(app).get('/api/projects/p1/exports').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.exports.length).toBe(2);
  });

  it('GET /exports 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/exports').set(authed());
    expect(res.status).toBe(404);
  });

  it('POST /export-pdf-direct success', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'a1',
              },
            ],
          },
        },
        csvData: { headers: ['N'], rows: [{ N: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'a1', s3Key: 'k' }]);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf-direct')
      .set(authed())
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /export-pdf-direct spawn failure', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'a1',
              },
            ],
          },
        },
        csvData: { headers: ['N'], rows: [{ N: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'a1', s3Key: 'k' }]);
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: new Error('spawn failed'),
      status: null,
      stdout: '',
      stderr: '',
    } as never);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf-direct')
      .set(authed())
      .send({});
    expect(res.status).toBe(502);
  });

  it('POST /export-pdf-direct python stderr with structured error', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'a1',
              },
            ],
          },
        },
        csvData: { headers: ['N'], rows: [{ N: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'a1', s3Key: 'k' }]);
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: JSON.stringify({ ok: false, error: 'bad pdf' }),
      stderr: 'warn',
      error: undefined,
    } as never);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf-direct')
      .set(authed())
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('bad pdf');
  });

  it('POST /export-pdf-direct logs stderr on success', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'a1',
              },
            ],
          },
        },
        csvData: { headers: ['N'], rows: [{ N: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'a1', s3Key: 'k' }]);
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: JSON.stringify({ ok: true, s3Key: 'out.pdf' }),
      stderr: 'python wrote to stderr',
      error: undefined,
    } as never);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf-direct')
      .set(authed())
      .send({});
    expect(res.status).toBe(200);
  });

  it('POST /export-pdf-direct invalid stdout json', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' } as never);
    prisma.cardGroup.findMany.mockResolvedValueOnce([
      {
        layoutId: 'L1',
        layout: {
          state: {
            version: 2,
            width: 100,
            height: 100,
            root: [
              {
                type: 'image',
                id: 'i',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                artKey: 'a1',
              },
            ],
          },
        },
        csvData: { headers: ['N'], rows: [{ N: '1' }] },
        name: 'G',
      },
    ]);
    prisma.asset.findMany.mockResolvedValueOnce([{ artKey: 'a1', s3Key: 'k' }]);
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: 'not-json',
      stderr: '',
      error: undefined,
    } as never);
    const res = await request(app)
      .post('/api/projects/p1/export-pdf-direct')
      .set(authed())
      .send({});
    expect(res.status).toBe(502);
  });
});
