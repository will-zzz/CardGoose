import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertDevProfileIfSet } from './devProfile.js';

describe('assertDevProfileIfSet', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('no-ops in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CARDGOOSE_DEV_PROFILE = 'fully-local';
    expect(() => assertDevProfileIfSet()).not.toThrow();
  });

  it('no-ops when profile not fully-local', () => {
    process.env.NODE_ENV = 'development';
    process.env.CARDGOOSE_DEV_PROFILE = '';
    expect(() => assertDevProfileIfSet()).not.toThrow();
  });

  it('throws when DB not local:5433', () => {
    process.env.NODE_ENV = 'development';
    process.env.CARDGOOSE_DEV_PROFILE = 'fully-local';
    process.env.DATABASE_URL = 'postgresql://x@remote:5432/db';
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
    process.env.SQS_QUEUE_URL = 'http://localhost:4566/queue';
    expect(() => assertDevProfileIfSet()).toThrow(/5433/);
  });

  it('throws when AWS endpoint not LocalStack', () => {
    process.env.NODE_ENV = 'development';
    process.env.CARDGOOSE_DEV_PROFILE = 'fully-local';
    process.env.DATABASE_URL = 'postgresql://u@127.0.0.1:5433/db';
    process.env.AWS_ENDPOINT_URL = 'https://s3.amazonaws.com';
    process.env.SQS_QUEUE_URL = 'http://localhost:4566/q';
    expect(() => assertDevProfileIfSet()).toThrow(/LocalStack/);
  });

  it('throws when SQS points at real AWS', () => {
    process.env.NODE_ENV = 'development';
    process.env.CARDGOOSE_DEV_PROFILE = 'fully-local';
    process.env.DATABASE_URL = 'postgresql://u@127.0.0.1:5433/db';
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
    process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/x';
    expect(() => assertDevProfileIfSet()).toThrow(/amazonaws/);
  });

  it('passes with valid fully-local env', () => {
    process.env.NODE_ENV = 'development';
    process.env.CARDGOOSE_DEV_PROFILE = 'fully-local';
    process.env.DATABASE_URL = 'postgresql://u@localhost:5433/db';
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
    process.env.SQS_QUEUE_URL = 'http://localhost:4566/q';
    expect(() => assertDevProfileIfSet()).not.toThrow();
  });
});
