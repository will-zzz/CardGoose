import { Router, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

export const authRouter: IRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  if (username.length < 2 || password.length < 6) {
    res.status(400).json({ error: 'username min 2 chars, password min 6 chars' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash },
  });

  const token = signToken({ sub: user.id, username: user.username });
  req.log.info({ userId: user.id, username: user.username }, 'auth.register ok');
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username },
  });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username });
  req.log.info({ userId: user.id, username: user.username }, 'auth.login ok');
  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});
