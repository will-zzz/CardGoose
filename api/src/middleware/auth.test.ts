import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authedHeaders } from '../test/auth-test-utils.js';
import { requireAuth } from './auth.js';

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

import { prisma } from '../test/prisma-mock.js';

describe('requireAuth', () => {
  const app = express();
  app.use(requireAuth);
  app.get('/x', (_req, res) => res.json({ ok: true }));

  beforeEach(() => {
    prisma.user.upsert.mockReset();
    prisma.user.upsert.mockResolvedValue({});
  });

  it('returns 401 without header', async () => {
    const res = await request(app).get('/x');
    expect(res.status).toBe(401);
  });

  it('returns 401 for bad bearer', async () => {
    const res = await request(app).get('/x').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('returns 401 when bearer token is only whitespace', async () => {
    const res = await request(app).get('/x').set('Authorization', 'Bearer    ');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const res = await request(app).get('/x').set('Authorization', 'Bearer bad.token');
    expect(res.status).toBe(401);
  });

  it('allows valid token', async () => {
    const res = await request(app).get('/x').set(authedHeaders());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(prisma.user.upsert).toHaveBeenCalled();
  });
});
