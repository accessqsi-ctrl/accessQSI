ALTER TABLE "plan"
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD';

UPDATE "plan"
SET "cost" = 5,
    "currency" = 'USD'
WHERE UPPER("title") = 'PRO';
