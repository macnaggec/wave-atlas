/*
  Warnings:

  - You are about to drop the column `photo_id` on the `purchases` table. All the data in the column will be lost.
  - The primary key for the `spots` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `photos` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `media_item_id` to the `purchases` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DELETED');

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_photographer_id_fkey";

-- DropForeignKey
ALTER TABLE "photos" DROP CONSTRAINT "photos_spot_id_fkey";

-- DropForeignKey
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_photo_id_fkey";

-- AlterTable
ALTER TABLE "purchases" DROP COLUMN "photo_id",
ADD COLUMN     "media_item_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "spots" DROP CONSTRAINT "spots_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "spots_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "spots_id_seq";

-- DropTable
DROP TABLE "photos";

-- CreateTable
CREATE TABLE "media_items" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "photographer_id" TEXT NOT NULL,
    "spot_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(8,2) NOT NULL,
    "watermark_url" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_photographer_id_fkey" FOREIGN KEY ("photographer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_media_item_id_fkey" FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
