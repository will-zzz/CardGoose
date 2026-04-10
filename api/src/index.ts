import { createApp } from './app.js';
import { assertDevProfileIfSet } from './lib/devProfile.js';
import { ensureDevLocalStackBuckets } from './lib/s3.js';
import { rootLogger } from './lib/logger.js';

const port = Number(process.env.PORT) || 3001;

assertDevProfileIfSet();

void (async () => {
  await ensureDevLocalStackBuckets();
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    rootLogger.info(
      {
        port,
        nodeEnv: process.env.NODE_ENV ?? 'development',
        awsEndpoint: process.env.AWS_ENDPOINT_URL ?? '(real AWS)',
      },
      'API listening'
    );
  });
})().catch((err) => {
  rootLogger.error(err);
  process.exit(1);
});
