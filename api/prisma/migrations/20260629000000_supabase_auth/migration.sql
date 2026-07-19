-- Migration: Switch to Supabase Auth
-- Remove passwordHash from users; user.id is now the Supabase auth.users UUID (no @default).

ALTER TABLE "User" DROP COLUMN IF EXISTS "password_hash";

-- directUrl is Prisma-only config, no SQL needed.
