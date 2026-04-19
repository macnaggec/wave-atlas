-- Rename watermark_url to lightbox_url
ALTER TABLE "media_items" RENAME COLUMN "watermark_url" TO "lightbox_url";

-- Rename preview_url to purchase_preview_url
ALTER TABLE "media_items" RENAME COLUMN "preview_url" TO "purchase_preview_url";
