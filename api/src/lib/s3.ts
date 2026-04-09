import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rootLogger } from './logger.js';

function endpointConfig(): { endpoint?: string; forcePathStyle?: boolean } {
  const url = process.env.AWS_ENDPOINT_URL;
  if (url) {
    return { endpoint: url, forcePathStyle: true };
  }
  return {};
}

export const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  ...endpointConfig(),
});

export function getAssetsBucket(): string {
  const b = process.env.S3_BUCKET_ASSETS;
  if (!b) throw new Error('S3_BUCKET_ASSETS is not set');
  return b;
}

export function getExportsBucket(): string {
  const b = process.env.S3_BUCKET_EXPORTS;
  if (!b) throw new Error('S3_BUCKET_EXPORTS is not set');
  return b;
}

/** After Docker/LocalStack restarts, buckets may be missing; create them in dev only. */
export async function ensureDevLocalStackBuckets(): Promise<void> {
  const endpoint = process.env.AWS_ENDPOINT_URL ?? '';
  if (process.env.NODE_ENV === 'production') return;
  if (!endpoint.includes(':4566')) return;

  const buckets = [getAssetsBucket(), getExportsBucket()];
  for (const Bucket of buckets) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket }));
    } catch {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket }));
        rootLogger.info({ Bucket }, 'Created missing LocalStack S3 bucket');
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') continue;
        throw err;
      }
    }
  }
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function listObjectKeys(bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const out = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of out.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

export async function getSignedGetUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}
