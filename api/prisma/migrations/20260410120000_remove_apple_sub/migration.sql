-- Drop legacy apple_sub column if present (feature removed)
DROP INDEX IF EXISTS "User_apple_sub_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "apple_sub";
