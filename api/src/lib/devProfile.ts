/**
 * When CARDGOOSE_DEV_PROFILE=fully-local, fail fast if fully-local env looks like
 * production-shaped URLs (wrong DB or real AWS endpoints).
 */
export function assertDevProfileIfSet(): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.CARDGOOSE_DEV_PROFILE !== 'fully-local') return;

  const dbUrl = process.env.DATABASE_URL ?? '';
  const awsEndpoint = (process.env.AWS_ENDPOINT_URL ?? '').trim();
  const sqsUrl = process.env.SQS_QUEUE_URL ?? '';

  const localPostgres =
    /@(localhost|127\.0\.0\.1):5433(\/|$|\?)/.test(dbUrl) ||
    /\/\/(localhost|127\.0\.0\.1):5433\//.test(dbUrl);

  const localStack = /^https?:\/\/(localhost|127\.0\.0\.1):4566\/?$/.test(awsEndpoint);

  if (!localPostgres) {
    throw new Error(
      'CARDGOOSE_DEV_PROFILE=fully-local requires DATABASE_URL to use host localhost or 127.0.0.1 on port 5433 (Docker Postgres from docker-compose).'
    );
  }

  if (!localStack) {
    throw new Error(
      'CARDGOOSE_DEV_PROFILE=fully-local requires AWS_ENDPOINT_URL=http://localhost:4566 (or http://127.0.0.1:4566) for LocalStack.'
    );
  }

  if (sqsUrl.includes('amazonaws.com')) {
    throw new Error(
      'CARDGOOSE_DEV_PROFILE=fully-local requires an SQS URL pointing at LocalStack, not AWS (SQS_QUEUE_URL must not contain amazonaws.com).'
    );
  }
}
