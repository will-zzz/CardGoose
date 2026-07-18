import { describe, expect, it, vi, beforeEach } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
  },
  ListObjectsV2Command: class {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  CopyObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://r2.example/presigned'),
}));

describe('r2 helpers', () => {
  beforeEach(() => {
    send.mockReset();
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET = 'cardgoose';
  });

  it('getBucket returns R2_BUCKET', async () => {
    const { getBucket } = await import('./r2.js');
    expect(getBucket()).toBe('cardgoose');
  });

  it('getBucket throws when unset', async () => {
    delete process.env.R2_BUCKET;
    const { getBucket } = await import('./r2.js');
    expect(() => getBucket()).toThrow('R2_BUCKET');
    process.env.R2_BUCKET = 'cardgoose';
  });

  it('putObject sends PutObjectCommand', async () => {
    send.mockResolvedValueOnce({});
    const { putObject, getBucket } = await import('./r2.js');
    await putObject(getBucket(), 'k', Buffer.from('x'), 'text/plain');
    expect(send).toHaveBeenCalled();
  });

  it('listObjectKeys paginates', async () => {
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'a' }],
        IsTruncated: true,
        NextContinuationToken: 't1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'b' }],
        IsTruncated: false,
      });
    const { listObjectKeys, getBucket } = await import('./r2.js');
    const keys = await listObjectKeys(getBucket(), 'pre/');
    expect(keys).toEqual(['a', 'b']);
  });

  it('getSignedGetUrl returns presigned string', async () => {
    const { getSignedGetUrl, getBucket } = await import('./r2.js');
    const u = await getSignedGetUrl(getBucket(), 'key', 60);
    expect(u).toBe('https://r2.example/presigned');
  });

  it('getSignedPutUrl returns presigned string', async () => {
    const { getSignedPutUrl, getBucket } = await import('./r2.js');
    const u = await getSignedPutUrl(getBucket(), 'key', 'image/png');
    expect(u).toBe('https://r2.example/presigned');
  });
});
