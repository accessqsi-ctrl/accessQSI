ALTER TABLE "payments"
ADD COLUMN "reference_amount" DECIMAL(18,2),
ADD COLUMN "reference_currency" VARCHAR(3) NOT NULL DEFAULT 'USD';

UPDATE "payments"
SET "reference_amount" = "amount",
    "reference_currency" = "currency";

ALTER TABLE "payments"
ALTER COLUMN "reference_amount" SET NOT NULL;

UPDATE "plan"
SET "cost" = 10,
    "currency" = 'USD'
WHERE UPPER("title") = 'PRO';
