import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib/prisma.js', async () => {
  const { prisma } = await import('./test/prisma-mock.js');
  return { prisma };
});

import { createApp } from './app.js';

describe('createApp', () => {
  const app = createApp();

  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'cardgoose-api' });
  });
});
