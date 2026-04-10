/**
 * Default env for Vitest (matches docker-compose local names when unset).
 */
process.env.JWT_SECRET ??= 'test-jwt-secret-key-minimum-32-characters-long!';
process.env.S3_BUCKET_ASSETS ??= 'test-assets-bucket';
process.env.S3_BUCKET_EXPORTS ??= 'test-exports-bucket';
process.env.SQS_QUEUE_URL ??= 'http://localhost:4566/000000000000/test-queue';
