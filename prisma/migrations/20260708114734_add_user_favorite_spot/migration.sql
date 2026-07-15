-- CreateTable
CREATE TABLE "user_favorite_spots" (
    "user_id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_spots_pkey" PRIMARY KEY ("user_id","spot_id")
);

-- AddForeignKey
ALTER TABLE "user_favorite_spots" ADD CONSTRAINT "user_favorite_spots_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_spots" ADD CONSTRAINT "user_favorite_spots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
