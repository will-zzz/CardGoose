import { describe, expect, it, vi, beforeEach } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
  },
  CreateBucketCommand: class {
    constructor(public input: unknown) {}
  },
  HeadBucketCommand: class {
    constructor(public input: unknown) {}
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
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/presigned'),
}));

describe('s3 helpers', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('getAssetsBucket throws when unset', async () => {
    const prev = process.env.S3_BUCKET_ASSETS;
    delete process.env.S3_BUCKET_ASSETS;
    const { getAssetsBucket } = await import('./s3.js');
    expect(() => getAssetsBucket()).toThrow('S3_BUCKET_ASSETS');
    process.env.S3_BUCKET_ASSETS = prev;
  });

  it('getExportsBucket throws when unset', async () => {
    const prev = process.env.S3_BUCKET_EXPORTS;
    delete process.env.S3_BUCKET_EXPORTS;
    const { getExportsBucket } = await import('./s3.js');
    expect(() => getExportsBucket()).toThrow('S3_BUCKET_EXPORTS');
    process.env.S3_BUCKET_EXPORTS = prev;
  });

  it('putObject sends PutObjectCommand', async () => {
    send.mockResolvedValueOnce({});
    const { putObject, getAssetsBucket } = await import('./s3.js');
    await putObject(getAssetsBucket(), 'k', Buffer.from('x'), 'text/plain');
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
    const { listObjectKeys, getAssetsBucket } = await import('./s3.js');
    const keys = await listObjectKeys(getAssetsBucket(), 'pre/');
    expect(keys).toEqual(['a', 'b']);
  });

  it('getSignedGetUrl returns presigned string', async () => {
    send.mockResolvedValueOnce({});
    const { getSignedGetUrl, getAssetsBucket } = await import('./s3.js');
    const u = await getSignedGetUrl(getAssetsBucket(), 'key', 60);
    expect(u).toBe('https://signed.example/presigned');
  });

  it('ensureDevLocalStackBuckets no-ops in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { ensureDevLocalStackBuckets } = await import('./s3.js');
    await ensureDevLocalStackBuckets();
    expect(send).not.toHaveBeenCalled();
    process.env.NODE_ENV = prev;
  });

  it('ensureDevLocalStackBuckets creates bucket when head fails', async () => {
    const prevNode = process.env.NODE_ENV;
    const prevAws = process.env.AWS_ENDPOINT_URL;
    process.env.NODE_ENV = 'development';
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
    send.mockRejectedValueOnce(new Error('no bucket')).mockResolvedValueOnce({});
    const { ensureDevLocalStackBuckets } = await import('./s3.js');
    await ensureDevLocalStackBuckets();
    expect(send.mock.calls.length).toBeGreaterThan(0);
    process.env.NODE_ENV = prevNode;
    process.env.AWS_ENDPOINT_URL = prevAws;
  });

  it('ensureDevLocalStackBuckets ignores bucket already exists', async () => {
    const prevNode = process.env.NODE_ENV;
    const prevAws = process.env.AWS_ENDPOINT_URL;
    process.env.NODE_ENV = 'development';
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
    const err = new Error('exists');
    (err as Error & { name: string }).name = 'BucketAlreadyOwnedByYou';
    send.mockRejectedValueOnce(new Error('no head')).mockRejectedValueOnce(err);
    const { ensureDevLocalStackBuckets } = await import('./s3.js');
    await ensureDevLocalStackBuckets();
    process.env.NODE_ENV = prevNode;
    process.env.AWS_ENDPOINT_URL = prevAws;
  });
});
