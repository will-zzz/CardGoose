-- AlterTable: allow OAuth users without a password
ALTER TABLE "User" ALTER COLUMN "password_hash" DROP NOT NULL;
