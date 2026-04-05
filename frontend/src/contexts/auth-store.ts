import type { AuthUser } from './auth-types';

const STORAGE_KEY = 'cardboardforge_auth';

type Stored = { token: string; user: AuthUser };

export function loadStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.token && parsed?.user?.id && parsed?.user?.username) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistAuth(token: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}
