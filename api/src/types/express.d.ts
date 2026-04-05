import type { JwtPayload } from 'jsonwebtoken';
import type { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user?: {
        id: string;
        username: string;
      };
      jwtPayload?: string | JwtPayload;
    }
  }
}

export {};
