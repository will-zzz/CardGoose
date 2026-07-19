/**
 * Auth store backed by Supabase session — no manual localStorage JWT management.
 * Supabase client handles session persistence in localStorage automatically via
 * its own `supabase.auth.session` storage key.
 */
import type { AuthUser } from './auth-types';
import type { Session } from '@supabase/supabase-js';

export function sessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user?.email) return null;
  return { id: session.user.id, username: session.user.email };
}

export function sessionToToken(session: Session | null): string | null {
  return session?.access_token ?? null;
}
