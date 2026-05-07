-- Store all monetary values as integer cents instead of Decimal dollars.
-- Existing rows multiplied by 100 so no data is lost.

ALTER TABLE "media_items"  ALTER COLUMN "price"                TYPE INTEGER USING (ROUND("price" * 100))::INTEGER;
ALTER TABLE "orders"       ALTER COLUMN "total_amount"         TYPE INTEGER USING (ROUND("total_amount" * 100))::INTEGER;
ALTER TABLE "purchases"    ALTER COLUMN "amount_paid"          TYPE INTEGER USING (ROUND("amount_paid" * 100))::INTEGER;
ALTER TABLE "purchases"    ALTER COLUMN "platform_fee"         TYPE INTEGER USING (ROUND("platform_fee" * 100))::INTEGER;
ALTER TABLE "purchases"    ALTER COLUMN "photographer_earned"  TYPE INTEGER USING (ROUND("photographer_earned" * 100))::INTEGER;
ALTER TABLE "users"        ALTER COLUMN "balance"              TYPE INTEGER USING (ROUND("balance" * 100))::INTEGER;
ALTER TABLE "transactions" ALTER COLUMN "amount"               TYPE INTEGER USING (ROUND("amount" * 100))::INTEGER;
ALTER TABLE "payout_requests" ALTER COLUMN "amount"            TYPE INTEGER USING (ROUND("amount" * 100))::INTEGER;
