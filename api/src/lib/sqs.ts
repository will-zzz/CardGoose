import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { rootLogger } from './logger.js';

function endpointConfig(): { endpoint?: string } {
  const url = process.env.AWS_ENDPOINT_URL;
  if (url) return { endpoint: url };
  return {};
}

export const sqsClient = new SQSClient({
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

export function getQueueUrl(): string {
  const u = process.env.SQS_QUEUE_URL;
  if (!u) throw new Error('SQS_QUEUE_URL is not set');
  return u;
}

export async function sendJsonMessage(body: Record<string, unknown>): Promise<void> {
  const queueUrl = getQueueUrl();
  rootLogger.info(
    { queueUrl, messagePreview: JSON.stringify(body).slice(0, 500) },
    'sqs.SendMessage'
  );
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
    })
  );
}
