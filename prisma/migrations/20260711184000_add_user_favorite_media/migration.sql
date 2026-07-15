CREATE TABLE "user_favorite_media" (
    "user_id" TEXT NOT NULL,
    "media_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_media_pkey" PRIMARY KEY ("user_id", "media_item_id")
);

CREATE INDEX "user_favorite_media_user_created_idx"
ON "user_favorite_media"("user_id", "created_at" DESC);

ALTER TABLE "user_favorite_media"
ADD CONSTRAINT "user_favorite_media_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_favorite_media"
ADD CONSTRAINT "user_favorite_media_media_item_id_fkey"
FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
