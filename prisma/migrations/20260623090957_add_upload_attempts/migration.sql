/*
  Warnings:

  - A unique constraint covering the columns `[upload_attempt_id]` on the table `media_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UploadSource" AS ENUM ('LOCAL', 'DRIVE');

-- CreateEnum
CREATE TYPE "UploadAttemptStatus" AS ENUM ('READY', 'ACQUIRING', 'FINALIZING', 'COMPLETED', 'FAILED', 'CANCEL_REQUESTED', 'CLEANUP_PENDING', 'CANCELLED');

-- AlterTable
ALTER TABLE "media_items" ADD COLUMN     "upload_attempt_id" TEXT;

-- CreateTable
CREATE TABLE "upload_attempts" (
    "id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "source" "UploadSource" NOT NULL,
    "status" "UploadAttemptStatus" NOT NULL DEFAULT 'READY',
    "cloudinary_public_id" TEXT NOT NULL,
    "expected_media_type" "MediaType" NOT NULL,
    "remote_file_id" TEXT,
    "last_error_code" TEXT,
    "upload_grant_expires_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_attempts_cloudinary_public_id_key" ON "upload_attempts"("cloudinary_public_id");

-- CreateIndex
CREATE INDEX "upload_attempts_session_status_idx" ON "upload_attempts"("session_id", "status");

-- CreateIndex
CREATE INDEX "upload_attempts_status_expires_idx" ON "upload_attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "upload_attempts_photographer_client_request_key" ON "upload_attempts"("photographer_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_items_upload_attempt_id_key" ON "media_items"("upload_attempt_id");

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_upload_attempt_id_fkey" FOREIGN KEY ("upload_attempt_id") REFERENCES "upload_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_attempts" ADD CONSTRAINT "upload_attempts_session_id_photographer_id_fkey" FOREIGN KEY ("session_id", "photographer_id") REFERENCES "surf_sessions"("id", "photographer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one COMPLETED attempt per existing non-deleted media row.
INSERT INTO upload_attempts (
  id, client_request_id, session_id, photographer_id,
  source, status, cloudinary_public_id, expected_media_type,
  remote_file_id, expires_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  gen_random_uuid(),
  mi.session_id,
  mi.photographer_id,
  CASE WHEN mi.import_source = 'GOOGLE_DRIVE' THEN 'DRIVE' ELSE 'LOCAL' END::"UploadSource",
  'COMPLETED'::"UploadAttemptStatus",
  mi.cloudinary_public_id,
  CASE WHEN mi.type = 'VIDEO' THEN 'VIDEO' ELSE 'PHOTO' END::"MediaType",
  mi.remote_file_id,
  NOW() + INTERVAL '1 year',
  mi.created_at,
  NOW()
FROM media_items mi
WHERE mi.deleted_at IS NULL;

-- Link each media row to its backfilled attempt.
UPDATE media_items mi
SET upload_attempt_id = ua.id
FROM upload_attempts ua
WHERE ua.cloudinary_public_id = mi.cloudinary_public_id;
