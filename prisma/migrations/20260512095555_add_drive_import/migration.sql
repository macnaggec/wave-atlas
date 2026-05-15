-- CreateEnum
CREATE TYPE "MediaImportSource" AS ENUM ('DIRECT', 'GOOGLE_DRIVE');

-- AlterEnum
ALTER TYPE "MediaStatus" ADD VALUE 'DRIVE_PENDING';

-- AlterTable
ALTER TABLE "media_items" ADD COLUMN     "import_source" "MediaImportSource" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "remote_file_id" TEXT;
