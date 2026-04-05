import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

export const rootLogger = pino({
  level,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
