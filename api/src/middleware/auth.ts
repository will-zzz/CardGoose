import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { rootLogger } from '../lib/logger.js';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_ANON_KEY is not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Lazy singleton — constructed once on first request.
let _supabase: ReturnType<typeof getSupabaseClient> | null = null;
function supabase(): ReturnType<typeof getSupabaseClient> {
  if (!_supabase) _supabase = getSupabaseClient();
  return _supabase;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

  const {
    data: { user },
    error,
  } = await supabase().auth.getUser(token);

  if (error || !user || !user.email) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Upsert user row so the DB stays in sync with Supabase Auth on first login.
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, username: user.email },
      update: { username: user.email },
    });
  } catch (err) {
    rootLogger.error({ err, userId: user.id }, 'auth.upsert failed');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  req.user = { id: user.id, username: user.email };
  next();
}
