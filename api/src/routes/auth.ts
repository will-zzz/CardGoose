import { Router, type IRouter } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';

export const authRouter: IRouter = Router();

const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

authRouter.post('/register', async (req, res) => {
  const body = req.body as { email?: string; username?: string; password?: string };
  const raw = body.email ?? body.username;
  const password = body.password;
  if (!raw || !password || typeof raw !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const email = normalizeEmail(raw);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Enter a valid email address' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username: email } });
  if (existing) {
    if (!existing.passwordHash) {
      res.status(409).json({
        error: 'An account with this email already exists. Sign in with Google.',
      });
      return;
    }
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username: email, passwordHash },
  });

  const token = signToken({ sub: user.id, username: user.username });
  req.log.info({ userId: user.id, username: user.username }, 'auth.register ok');
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username },
  });
});

authRouter.post('/login', async (req, res) => {
  const body = req.body as { email?: string; username?: string; password?: string };
  const raw = body.email ?? body.username;
  const password = body.password;
  if (!raw || !password || typeof raw !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const email = normalizeEmail(raw);
  const user = await prisma.user.findUnique({ where: { username: email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: 'This account uses Google sign-in' });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ sub: user.id, username: user.username });
  req.log.info({ userId: user.id, username: user.username }, 'auth.login ok');
  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});

authRouter.post('/google', async (req, res) => {
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken || typeof accessToken !== 'string') {
    res.status(400).json({ error: 'accessToken is required' });
    return;
  }

  const gr = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!gr.ok) {
    req.log.warn({ status: gr.status }, 'auth.google userinfo failed');
    res.status(401).json({ error: 'Invalid or expired Google session' });
    return;
  }

  const profile = (await gr.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };

  if (!profile.email || profile.email_verified !== true) {
    res.status(400).json({ error: 'Google did not return a verified email' });
    return;
  }

  const email = normalizeEmail(profile.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email from Google' });
    return;
  }

  let user = await prisma.user.findUnique({ where: { username: email } });
  if (!user) {
    user = await prisma.user.create({
      data: { username: email, passwordHash: null },
    });
    req.log.info({ userId: user.id, username: user.username }, 'auth.google register ok');
  } else {
    req.log.info({ userId: user.id, username: user.username }, 'auth.google login ok');
  }

  const token = signToken({ sub: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username },
  });
});
