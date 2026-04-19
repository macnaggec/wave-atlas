ALTER TABLE "media_items" ADD COLUMN "preview_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "media_items" ALTER COLUMN "preview_url" DROP DEFAULT;
