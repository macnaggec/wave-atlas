-- CreateEnum
CREATE TYPE "UploadWorkspaceKind" AS ENUM ('NEW_SESSION', 'SESSION_EDIT');

-- CreateEnum
CREATE TYPE "UploadWorkspaceStatus" AS ENUM ('ACTIVE', 'SAVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UploadWorkspaceAssetStatus" AS ENUM ('READY', 'PROMOTED', 'CLEANUP_PENDING', 'DELETED');

-- CreateTable
CREATE TABLE "upload_workspaces" (
    "id" TEXT NOT NULL,
    "kind" "UploadWorkspaceKind" NOT NULL,
    "status" "UploadWorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "photographer_id" TEXT NOT NULL,
    "target_session_id" TEXT,
    "spot_id" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "photo_price" INTEGER NOT NULL DEFAULT 300,
    "video_price" INTEGER NOT NULL DEFAULT 300,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_workspace_assets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "photographer_id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "cloudinary_public_id" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "lightbox_url" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "import_source" "MediaImportSource" NOT NULL DEFAULT 'DIRECT',
    "remote_file_id" TEXT,
    "status" "UploadWorkspaceAssetStatus" NOT NULL DEFAULT 'READY',
    "upload_attempt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_workspace_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_workspace_media_changes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "media_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_workspace_media_changes_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "upload_attempts" ADD COLUMN "workspace_id" TEXT;

-- Backfill existing attempts from the legacy session-based upload model.
-- These rows are historical upload records, not active workspaces, so keep
-- them linked through cancelled compatibility workspaces.
CREATE TEMP TABLE "_legacy_upload_attempt_workspaces" AS
SELECT
  ua."session_id",
  ua."photographer_id",
  gen_random_uuid()::TEXT AS "workspace_id"
FROM "upload_attempts" ua
GROUP BY ua."session_id", ua."photographer_id";

INSERT INTO "upload_workspaces" (
  "id",
  "kind",
  "status",
  "photographer_id",
  "spot_id",
  "starts_at",
  "ends_at",
  "photo_price",
  "video_price",
  "created_at",
  "updated_at"
)
SELECT
  legacy."workspace_id",
  'NEW_SESSION'::"UploadWorkspaceKind",
  'CANCELLED'::"UploadWorkspaceStatus",
  legacy."photographer_id",
  s."spot_id",
  s."starts_at",
  s."ends_at",
  s."photo_price",
  s."video_price",
  s."created_at",
  NOW()
FROM "_legacy_upload_attempt_workspaces" legacy
JOIN "surf_sessions" s
  ON s."id" = legacy."session_id"
 AND s."photographer_id" = legacy."photographer_id";

UPDATE "upload_attempts" ua
SET "workspace_id" = legacy."workspace_id"
FROM "_legacy_upload_attempt_workspaces" legacy
WHERE ua."session_id" = legacy."session_id"
  AND ua."photographer_id" = legacy."photographer_id";

DROP TABLE "_legacy_upload_attempt_workspaces";

ALTER TABLE "upload_attempts" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "upload_attempts" DROP CONSTRAINT "upload_attempts_session_id_photographer_id_fkey";
DROP INDEX "upload_attempts_session_status_idx";
ALTER TABLE "upload_attempts" DROP COLUMN "session_id";

-- CreateIndex
CREATE INDEX "upload_workspaces_photographer_status_updated_idx" ON "upload_workspaces"("photographer_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "upload_workspaces_target_session_idx" ON "upload_workspaces"("target_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_workspaces_one_active_per_photographer_idx"
ON "upload_workspaces"("photographer_id")
WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "upload_workspace_assets_cloudinary_public_id_key" ON "upload_workspace_assets"("cloudinary_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_workspace_assets_upload_attempt_id_key" ON "upload_workspace_assets"("upload_attempt_id");

-- CreateIndex
CREATE INDEX "upload_workspace_assets_workspace_status_created_idx" ON "upload_workspace_assets"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "upload_workspace_media_changes_workspace_media_key" ON "upload_workspace_media_changes"("workspace_id", "media_item_id");

-- CreateIndex
CREATE INDEX "upload_workspace_media_changes_media_item_idx" ON "upload_workspace_media_changes"("media_item_id");

-- CreateIndex
CREATE INDEX "upload_attempts_workspace_status_idx" ON "upload_attempts"("workspace_id", "status");

-- AddForeignKey
ALTER TABLE "upload_workspaces" ADD CONSTRAINT "upload_workspaces_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspaces" ADD CONSTRAINT "upload_workspaces_target_session_id_photographer_id_fkey" FOREIGN KEY ("target_session_id", "photographer_id") REFERENCES "surf_sessions"("id", "photographer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspaces" ADD CONSTRAINT "upload_workspaces_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspace_assets" ADD CONSTRAINT "upload_workspace_assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "upload_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspace_assets" ADD CONSTRAINT "upload_workspace_assets_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspace_assets" ADD CONSTRAINT "upload_workspace_assets_upload_attempt_id_fkey" FOREIGN KEY ("upload_attempt_id") REFERENCES "upload_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspace_media_changes" ADD CONSTRAINT "upload_workspace_media_changes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "upload_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_workspace_media_changes" ADD CONSTRAINT "upload_workspace_media_changes_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_attempts" ADD CONSTRAINT "upload_attempts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "upload_workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
