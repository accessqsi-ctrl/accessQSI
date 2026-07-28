ALTER TABLE "organizations"
ADD COLUMN "subscription_started_at" TIMESTAMP(3),
ADD COLUMN "subscription_expires_at" TIMESTAMP(3);

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "payments" (
    "payment_id" SERIAL NOT NULL,
    "deposit_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "initiated_by_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_transaction_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "access_starts_at" TIMESTAMP(3),
    "access_expires_at" TIMESTAMP(3),
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

CREATE UNIQUE INDEX "payments_deposit_id_key" ON "payments"("deposit_id");
CREATE INDEX "payments_org_id_created_at_idx" ON "payments"("org_id", "created_at");
CREATE INDEX "payments_org_id_status_idx" ON "payments"("org_id", "status");
CREATE INDEX "payments_initiated_by_id_idx" ON "payments"("initiated_by_id");

ALTER TABLE "payments"
ADD CONSTRAINT "payments_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "plan"("plan_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_initiated_by_id_fkey"
FOREIGN KEY ("initiated_by_id") REFERENCES "usersQ"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
