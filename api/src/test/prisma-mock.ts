import { vi } from 'vitest';

function createMock() {
  return {
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
      upsert: vi.fn(),
    },
    $transaction: vi.fn((ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return Promise.resolve(undefined);
    }),
  };
}

export const prisma = createMock();
