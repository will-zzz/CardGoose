import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMock(): any {
  const client: Record<string, unknown> = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    layout: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cardGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    globalAsset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };

  client.$transaction = vi.fn(async (ops: unknown) => {
    if (typeof ops === 'function') {
      return (ops as (tx: typeof client) => Promise<unknown>)(client);
    }
    if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
    return Promise.resolve(undefined);
  });

  return client;
}

export const prisma = createMock();
