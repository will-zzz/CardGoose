/**
 * Default env for Vitest (matches local dev names when unset).
 */
import { vi } from 'vitest';

export const TEST_ACCESS_TOKEN = 'valid-test-token';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === TEST_ACCESS_TOKEN) {
          return { data: { user: { id: 'u1', email: 'a@b.com' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }),
    },
  }),
}));

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.R2_ACCOUNT_ID ??= 'test-account';
process.env.R2_ACCESS_KEY_ID ??= 'test-key';
process.env.R2_SECRET_ACCESS_KEY ??= 'test-secret';
process.env.R2_BUCKET ??= 'cardgoose';
