import { describe, expect, it, vi, beforeEach } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send = send;
  },
  SendMessageCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe('sqs', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({});
  });

  it('getQueueUrl throws when unset', async () => {
    const prev = process.env.SQS_QUEUE_URL;
    delete process.env.SQS_QUEUE_URL;
    const { getQueueUrl } = await import('./sqs.js');
    expect(() => getQueueUrl()).toThrow('SQS_QUEUE_URL');
    process.env.SQS_QUEUE_URL = prev;
  });

  it('sendJsonMessage sends to queue', async () => {
    const { sendJsonMessage } = await import('./sqs.js');
    await sendJsonMessage({ hello: 'world' });
    expect(send).toHaveBeenCalled();
  });
});
