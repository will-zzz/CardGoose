import { createApp } from './app.js';
import { logR2Config } from './lib/r2.js';
import { rootLogger } from './lib/logger.js';

const port = Number(process.env.PORT) || 3001;

void (async () => {
  logR2Config();
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    rootLogger.info(
      {
        port,
        nodeEnv: process.env.NODE_ENV ?? 'development',
      },
      'API listening'
    );
  });
})().catch((err) => {
  rootLogger.error(err);
  process.exit(1);
});
