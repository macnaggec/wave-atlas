/*
  Warnings:

  - A unique constraint covering the columns `[download_token]` on the table `purchases` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_buyer_id_fkey";

-- DropForeignKey
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_buyer_id_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "guest_email" TEXT,
ALTER COLUMN "buyer_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "download_token" TEXT,
ADD COLUMN     "guest_email" TEXT,
ALTER COLUMN "buyer_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "purchases_download_token_key" ON "purchases"("download_token");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
