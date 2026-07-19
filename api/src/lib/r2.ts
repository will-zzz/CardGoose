import {
  CopyObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rootLogger } from './logger.js';

function getAccountId(): string {
  const id = process.env.R2_ACCOUNT_ID;
  if (!id) throw new Error('R2_ACCOUNT_ID is not set');
  return id;
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${getAccountId()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

export function getBucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error('R2_BUCKET is not set');
  return b;
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Server-side copy within the same bucket (e.g. promote project asset → global). */
export async function copyObjectSameBucket(
  bucket: string,
  sourceKey: string,
  destKey: string
): Promise<void> {
  const copySource = `${bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
  await r2Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: destKey,
    })
  );
}

export async function listObjectKeys(bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const out = await r2Client.send(
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
  return getSignedUrl(r2Client, cmd, { expiresIn });
}

/** Presigned PUT for direct client-to-R2 uploads. */
export async function getSignedPutUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client, cmd, { expiresIn });
}

/** Log R2 config on startup (never log secrets). */
export function logR2Config(): void {
  rootLogger.info(
    {
      bucket: process.env.R2_BUCKET ?? '(unset)',
      accountId: process.env.R2_ACCOUNT_ID ? '***set***' : '(unset)',
    },
    'R2 config'
  );
}
