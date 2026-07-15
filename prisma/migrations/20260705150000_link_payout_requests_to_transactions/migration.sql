ALTER TABLE "payout_requests" ADD COLUMN "transaction_id" TEXT NOT NULL;

CREATE UNIQUE INDEX "payout_requests_transaction_id_key" ON "payout_requests"("transaction_id");

ALTER TABLE "payout_requests"
  ADD CONSTRAINT "payout_requests_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
