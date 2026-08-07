-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'reviewer');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'reviewer';

-- Migrate existing admins
UPDATE "User" SET "role" = 'admin' WHERE "isAdmin" = true;
