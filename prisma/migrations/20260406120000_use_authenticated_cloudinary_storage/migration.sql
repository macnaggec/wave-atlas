-- Rename original_url to cloudinary_public_id.
-- In dev, existing URL strings are preserved as public_id values temporarily.
-- Re-seed the DB after this migration to get canonical data.
ALTER TABLE "media_items" RENAME COLUMN "original_url" TO "cloudinary_public_id";

-- Add thumbnail_url column with a temporary default so existing rows don't fail.
ALTER TABLE "media_items" ADD COLUMN "thumbnail_url" TEXT NOT NULL DEFAULT '';

-- Drop the default — Prisma schema has no @default, new rows come from the app.
ALTER TABLE "media_items" ALTER COLUMN "thumbnail_url" DROP DEFAULT;
