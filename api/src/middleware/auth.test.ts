import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signToken } from '../lib/jwt.js';
import { requireAuth } from './auth.js';

describe('requireAuth', () => {
  const app = express();
  app.use(requireAuth);
  app.get('/x', (_req, res) => res.json({ ok: true }));

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
    const token = signToken({ sub: 'u1', username: 'a@b.com' });
    const res = await request(app).get('/x').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
