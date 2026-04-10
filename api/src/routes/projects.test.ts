import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signToken } from '../lib/jwt.js';

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

import { prisma } from '../test/prisma-mock.js';
import { createApp } from '../app.js';

const app = createApp();

function authed() {
  const token = signToken({ sub: 'u1', username: 'a@b.com' });
  return { Authorization: `Bearer ${token}` };
}

describe('projects routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET /api/projects lists', async () => {
    prisma.project.findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'P', createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = await request(app).get('/api/projects/').set(authed());
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
  });

  it('POST /api/projects creates', async () => {
    prisma.project.create.mockResolvedValueOnce({
      id: 'p1',
      name: 'New',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app).post('/api/projects/').set(authed()).send({ name: '  New  ' });
    expect(res.status).toBe(201);
  });

  it('POST /api/projects 400', async () => {
    const res = await request(app).post('/api/projects/').set(authed()).send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('GET layouts 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/layouts').set(authed());
    expect(res.status).toBe(404);
  });

  it('GET layouts', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findMany.mockResolvedValueOnce([
      { id: 'L1', name: 'L', lastUpdated: new Date(), state: {} },
    ]);
    const res = await request(app).get('/api/projects/p1/layouts').set(authed());
    expect(res.status).toBe(200);
  });

  it('POST layout 400', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app)
      .post('/api/projects/p1/layouts')
      .set(authed())
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('POST layout 400 no state', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app)
      .post('/api/projects/p1/layouts')
      .set(authed())
      .send({ name: 'L' });
    expect(res.status).toBe(400);
  });

  it('POST layout 201', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.create.mockResolvedValueOnce({
      id: 'L1',
      name: 'L',
      lastUpdated: new Date(),
      state: { v: 1 },
    });
    const res = await request(app)
      .post('/api/projects/p1/layouts')
      .set(authed())
      .send({ name: 'L', state: { x: 1 } });
    expect(res.status).toBe(201);
  });

  it('GET single layout 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/layouts/L1').set(authed());
    expect(res.status).toBe(404);
  });

  it('GET single layout 404 layout', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/layouts/L1').set(authed());
    expect(res.status).toBe(404);
  });

  it('GET single layout', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findFirst.mockResolvedValueOnce({
      id: 'L1',
      name: 'L',
      lastUpdated: new Date(),
      state: {},
    });
    const res = await request(app).get('/api/projects/p1/layouts/L1').set(authed());
    expect(res.status).toBe(200);
  });

  it('PUT layout', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findFirst.mockResolvedValueOnce({ id: 'L1' });
    prisma.layout.update.mockResolvedValueOnce({
      id: 'L1',
      name: 'N',
      lastUpdated: new Date(),
      state: {},
    });
    const res = await request(app)
      .put('/api/projects/p1/layouts/L1')
      .set(authed())
      .send({ name: 'N', state: { a: 1 } });
    expect(res.status).toBe(200);
  });

  it('PUT layout 400 bad name', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findFirst.mockResolvedValueOnce({ id: 'L1' });
    const res = await request(app)
      .put('/api/projects/p1/layouts/L1')
      .set(authed())
      .send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('DELETE layout', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.layout.findFirst.mockResolvedValueOnce({ id: 'L1' });
    prisma.layout.delete.mockResolvedValueOnce({} as never);
    const res = await request(app).delete('/api/projects/p1/layouts/L1').set(authed());
    expect(res.status).toBe(204);
  });

  it('PUT /data 400 bad body', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app).put('/api/projects/p1/data').set(authed()).send({ x: 1 });
    expect(res.status).toBe(400);
  });

  it('PUT /data', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.project.update.mockResolvedValueOnce({} as never);
    prisma.project.findFirst.mockResolvedValueOnce({
      csvData: { headers: ['A'], rows: [{ A: '1' }] },
      csvSourceUrl: null,
    });
    const res = await request(app)
      .put('/api/projects/p1/data')
      .set(authed())
      .send({
        headers: ['A'],
        rows: [{ A: '1' }],
      });
    expect(res.status).toBe(200);
  });

  it('PUT /csv-link clear', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.project.update.mockResolvedValueOnce({} as never);
    const res = await request(app)
      .put('/api/projects/p1/csv-link')
      .set(authed())
      .send({ url: null });
    expect(res.status).toBe(200);
  });

  it('PUT /csv-link set', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.project.update.mockResolvedValueOnce({} as never);
    const res = await request(app)
      .put('/api/projects/p1/csv-link')
      .set(authed())
      .send({ url: 'https://docs.google.com/spreadsheets/d/x/export?format=csv' });
    expect(res.status).toBe(200);
  });

  it('POST /csv/refresh', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      csvSourceUrl: 'https://example.com/x.csv',
    });
    prisma.project.update.mockResolvedValueOnce({} as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Name\nVal',
        headers: { get: () => null },
      })
    );
    const res = await request(app).post('/api/projects/p1/csv/refresh').set(authed()).send({});
    expect(res.status).toBe(200);
  });

  it('POST /csv/refresh 502', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      csvSourceUrl: 'https://example.com/x.csv',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Err',
      })
    );
    const res = await request(app).post('/api/projects/p1/csv/refresh').set(authed()).send({});
    expect(res.status).toBe(502);
  });

  it('GET card-groups', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findMany.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/projects/p1/card-groups').set(authed());
    expect(res.status).toBe(200);
  });

  it('GET card-groups 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1/card-groups').set(authed());
    expect(res.status).toBe(404);
  });

  it('POST card-groups 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/projects/p1/card-groups').set(authed()).send({});
    expect(res.status).toBe(404);
  });

  it('POST card-group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 0 } });
    prisma.cardGroup.create.mockResolvedValueOnce({
      id: 'g1',
      name: 'New group',
      layoutId: null,
      sortOrder: 1,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app).post('/api/projects/p1/card-groups').set(authed()).send({});
    expect(res.status).toBe(201);
  });

  it('PUT reorder', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    prisma.cardGroup.findMany.mockResolvedValueOnce([]);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/reorder')
      .set(authed())
      .send({ ids: ['a', 'b'] });
    expect(res.status).toBe(200);
  });

  it('PUT reorder 400', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/reorder')
      .set(authed())
      .send({ ids: [1, 2] });
    expect(res.status).toBe(400);
  });

  it('PUT reorder 400 unknown id', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/reorder')
      .set(authed())
      .send({ ids: ['a', 'missing'] });
    expect(res.status).toBe(400);
  });

  it('PUT reorder 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/reorder')
      .set(authed())
      .send({ ids: ['a'] });
    expect(res.status).toBe(404);
  });

  it('PUT group 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('PUT group 404 group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('PUT group rejects blank name', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('PUT group rejects malformed csv URL string', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://[bad' });
    expect(res.status).toBe(400);
  });

  it('PUT group update name', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'X',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ name: 'X' });
    expect(res.status).toBe(200);
  });

  it('PUT group clear csv', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: null });
    expect(res.status).toBe(200);
  });

  it('PUT group fetch csv parses unquoted filename', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: 'https://example.com/x.csv',
      dataSourceLabel: null,
      csvData: { headers: ['N'], rows: [{ N: '1' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'N\n1',
        headers: {
          get: (h: string) =>
            h === 'content-disposition' ? 'attachment; filename=Sheet.csv' : null,
        },
      })
    );
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://example.com/x.csv' });
    expect(res.status).toBe(200);
  });

  it('PUT group fetch csv uses Content-Disposition filename', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: 'https://example.com/x.csv',
      dataSourceLabel: 'Tab A',
      csvData: { headers: ['N'], rows: [{ N: '1' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'N,v\n1,x',
        headers: {
          get: (h: string) =>
            h === 'content-disposition'
              ? 'attachment; filename="Export - Tab A.csv"'
              : null,
        },
      })
    );
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://example.com/x.csv' });
    expect(res.status).toBe(200);
  });

  it('PUT group fetch csv', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: 'https://example.com/x.csv',
      dataSourceLabel: 'Tab',
      csvData: { headers: ['N'], rows: [{ N: '1' }] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'Name\nX',
        headers: {
          get: (h: string) =>
            h === 'content-disposition'
              ? `attachment; filename*=UTF-8''Deck%20-%20MyTab.csv`
              : null,
        },
      })
    );
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://example.com/x.csv' });
    expect(res.status).toBe(200);
  });

  it('PUT group fetch csv 502 when CSV empty', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
        headers: { get: () => null },
      })
    );
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://example.com/x.csv' });
    expect(res.status).toBe(502);
  });

  it('PUT group fetch csv 502', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'N',
      })
    );
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 'https://example.com/x.csv' });
    expect(res.status).toBe(502);
  });

  it('POST group csv refresh 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(404);
  });

  it('POST group csv refresh 404 group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(404);
  });

  it('POST group csv refresh no url', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ csvSourceUrl: null });
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST group csv refresh invalid stored url', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ csvSourceUrl: 'http://insecure.com/x.csv' });
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST group csv refresh download failure 502', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({
      csvSourceUrl: 'https://example.com/x.csv',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(502);
  });

  it('POST group csv refresh', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({
      csvSourceUrl: 'https://example.com/x.csv',
    });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: 'https://example.com/x.csv',
      dataSourceLabel: null,
      csvData: { headers: ['A'], rows: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'A\n1',
        headers: { get: () => null },
      })
    );
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/csv/refresh')
      .set(authed())
      .send({});
    expect(res.status).toBe(200);
  });

  it('duplicate group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({
      id: 'g1',
      name: 'Long name'.repeat(20),
      layoutId: 'L1',
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
    });
    prisma.cardGroup.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 0 } });
    prisma.cardGroup.create.mockResolvedValueOnce({
      id: 'g2',
      name: 'Copy',
      layoutId: 'L1',
      sortOrder: 1,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/duplicate')
      .set(authed())
      .send({});
    expect(res.status).toBe(201);
  });

  it('delete group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.delete.mockResolvedValueOnce({} as never);
    const res = await request(app).delete('/api/projects/p1/card-groups/g1').set(authed());
    expect(res.status).toBe(204);
  });

  it('GET project detail', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      name: 'P',
      csvData: null,
      csvSourceUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      layouts: [],
    });
    const res = await request(app).get('/api/projects/p1').set(authed());
    expect(res.status).toBe(200);
  });

  it('PUT project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.project.update.mockResolvedValueOnce({
      id: 'p1',
      name: 'Q',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app).put('/api/projects/p1').set(authed()).send({ name: 'Q' });
    expect(res.status).toBe(200);
  });

  it('DELETE project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.project.delete.mockResolvedValueOnce({} as never);
    const res = await request(app).delete('/api/projects/p1').set(authed());
    expect(res.status).toBe(204);
  });

  it('PUT layout connect', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.layout.findFirst.mockResolvedValueOnce({ id: 'L1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: 'L1',
      sortOrder: 0,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ layoutId: 'L1' });
    expect(res.status).toBe(200);
  });

  it('PUT layout unknown', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.layout.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ layoutId: 'bad' });
    expect(res.status).toBe(400);
  });

  it('GET project detail 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/projects/p1').set(authed());
    expect(res.status).toBe(404);
  });

  it('PUT project 400 empty name', async () => {
    const res = await request(app).put('/api/projects/p1').set(authed()).send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('PUT project 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).put('/api/projects/p1').set(authed()).send({ name: 'OK' });
    expect(res.status).toBe(404);
  });

  it('DELETE project 404', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).delete('/api/projects/p1').set(authed());
    expect(res.status).toBe(404);
  });

  it('PUT /data rejects bad sourceUrl', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app)
      .put('/api/projects/p1/data')
      .set(authed())
      .send({
        headers: ['A'],
        rows: [{ A: '1' }],
        sourceUrl: 'http://insecure.com/x.csv',
      });
    expect(res.status).toBe(400);
  });

  it('PUT /data rejects bad sourceUrl type', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    const res = await request(app)
      .put('/api/projects/p1/data')
      .set(authed())
      .send({
        headers: ['A'],
        rows: [{ A: '1' }],
        sourceUrl: 123,
      });
    expect(res.status).toBe(400);
  });

  it('POST /csv/refresh network failure', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      csvSourceUrl: 'https://example.com/x.csv',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const res = await request(app).post('/api/projects/p1/csv/refresh').set(authed()).send({});
    expect(res.status).toBe(502);
  });

  it('PUT card-group rejects non-string csvSourceUrl', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ csvSourceUrl: 99 });
    expect(res.status).toBe(400);
  });

  it('PUT card-group rejects invalid layoutId type', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ layoutId: 123 });
    expect(res.status).toBe(400);
  });

  it('PUT card-group disconnect layout', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce({ id: 'g1' });
    prisma.cardGroup.update.mockResolvedValueOnce({
      id: 'g1',
      name: 'G',
      layoutId: null,
      sortOrder: 0,
      csvSourceUrl: null,
      dataSourceLabel: null,
      csvData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await request(app)
      .put('/api/projects/p1/card-groups/g1')
      .set(authed())
      .send({ layoutId: null });
    expect(res.status).toBe(200);
  });

  it('duplicate group 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/duplicate')
      .set(authed())
      .send({});
    expect(res.status).toBe(404);
  });

  it('duplicate group 404 source', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/projects/p1/card-groups/g1/duplicate')
      .set(authed())
      .send({});
    expect(res.status).toBe(404);
  });

  it('delete group 404 project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).delete('/api/projects/p1/card-groups/g1').set(authed());
    expect(res.status).toBe(404);
  });

  it('delete group 404 group', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.cardGroup.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).delete('/api/projects/p1/card-groups/g1').set(authed());
    expect(res.status).toBe(404);
  });

  it('POST csv refresh invalid CSV body', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      csvSourceUrl: 'https://example.com/x.csv',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
        headers: { get: () => null },
      })
    );
    const res = await request(app).post('/api/projects/p1/csv/refresh').set(authed()).send({});
    expect(res.status).toBe(400);
  });
});
