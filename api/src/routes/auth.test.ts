import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', async () => {
  const { prisma } = await import('../test/prisma-mock.js');
  return { prisma };
});

import { prisma } from '../test/prisma-mock.js';

import { createApp } from '../app.js';

const app = createApp();

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('POST /api/auth/register', () => {
    it('400 when missing fields', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(400);
    });

    it('400 invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'secret12' });
      expect(res.status).toBe(400);
    });

    it('400 short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'a@b.com', password: '12345' });
      expect(res.status).toBe(400);
    });

    it('409 when google-only account exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'x',
        username: 'a@b.com',
        passwordHash: null,
      } as never);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'a@b.com', password: 'secret12' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Google/);
    });

    it('409 when password account exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'x',
        username: 'a@b.com',
        passwordHash: 'h',
      } as never);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'a@b.com', password: 'secret12' });
      expect(res.status).toBe(409);
    });

    it('201 registers', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ id: 'u1', username: 'new@b.com' } as never);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@b.com', password: 'secret12' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.username).toBe('new@b.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('400 missing', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('401 unknown user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'secret12' });
      expect(res.status).toBe(401);
    });

    it('401 google-only', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        username: 'a@b.com',
        passwordHash: null,
      } as never);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'secret12' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Google/);
    });

    it('401 bad password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u',
        username: 'a@b.com',
        passwordHash: 'not-bcrypt',
      } as never);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('200 logs in', async () => {
      const hash = '$2a$10$abcdefghijklmnopqrstuv/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1',
        username: 'ok@b.com',
        passwordHash: hash,
      } as never);
      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt.default, 'compare').mockResolvedValueOnce(true as never);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ok@b.com', password: 'correcthorse' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });
  });

  describe('POST /api/auth/google', () => {
    it('400 without token', async () => {
      const res = await request(app).post('/api/auth/google').send({});
      expect(res.status).toBe(400);
    });

    it('401 when google rejects', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
      );
      const res = await request(app).post('/api/auth/google').send({ accessToken: 'bad' });
      expect(res.status).toBe(401);
    });

    it('400 unverified email', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ email: 'a@b.com', email_verified: false }),
        })
      );
      const res = await request(app).post('/api/auth/google').send({ accessToken: 't' });
      expect(res.status).toBe(400);
    });

    it('400 invalid email string from Google', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ email: 'not-an-email', email_verified: true, sub: 's' }),
        })
      );
      const res = await request(app).post('/api/auth/google').send({ accessToken: 't' });
      expect(res.status).toBe(400);
    });

    it('200 creates user', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ email: 'g@b.com', email_verified: true, sub: 'gp' }),
        })
      );
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({ id: 'u2', username: 'g@b.com' } as never);
      const res = await request(app).post('/api/auth/google').send({ accessToken: 't' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('g@b.com');
    });

    it('200 existing user', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ email: 'ex@b.com', email_verified: true, sub: 'gp' }),
        })
      );
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u3', username: 'ex@b.com' } as never);
      const res = await request(app).post('/api/auth/google').send({ accessToken: 't' });
      expect(res.status).toBe(200);
    });
  });
});
