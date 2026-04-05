import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const { sub, username } = verifyToken(token);
    req.user = { id: sub, username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
