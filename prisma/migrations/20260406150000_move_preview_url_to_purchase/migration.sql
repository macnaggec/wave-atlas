-- Drop purchasePreviewUrl from media_items
ALTER TABLE "media_items" DROP COLUMN "purchase_preview_url";

-- Add previewUrl to purchases (nullable — filled at fulfillment time)
ALTER TABLE "purchases" ADD COLUMN "preview_url" TEXT;
