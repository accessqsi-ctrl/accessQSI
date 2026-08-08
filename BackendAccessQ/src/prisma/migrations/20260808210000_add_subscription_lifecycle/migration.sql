CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'CANCELED', 'EXPIRED');
CREATE TYPE "SubscriptionChangeType" AS ENUM ('PURCHASE', 'UPGRADE', 'DOWNGRADE', 'RENEWAL', 'INTERVAL_CHANGE', 'CANCEL', 'REACTIVATE');
CREATE TYPE "SubscriptionChangeStatus" AS ENUM ('AWAITING_PAYMENT', 'SCHEDULED', 'APPLIED', 'FAILED', 'CANCELED', 'EXPIRED', 'REVIEW_REQUIRED', 'REFUND_PENDING');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVIEW_REQUIRED';

CREATE TABLE "subscriptions" (
    "subscription_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_interval" "BillingInterval",
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("subscription_id")
);

CREATE TABLE "subscription_changes" (
    "subscription_change_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "subscription_id" INTEGER,
    "from_plan_id" INTEGER,
    "to_plan_id" INTEGER,
    "from_interval" "BillingInterval",
    "to_interval" "BillingInterval",
    "type" "SubscriptionChangeType" NOT NULL,
    "status" "SubscriptionChangeStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "effective_at" TIMESTAMP(3),
    "quoted_amount" DECIMAL(18,2),
    "quoted_currency" VARCHAR(3),
    "reference_amount" DECIMAL(18,2),
    "reference_currency" VARCHAR(3),
    "source_version" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("subscription_change_id")
);

CREATE TABLE "subscription_periods" (
    "subscription_period_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "payment_id" INTEGER,
    "billing_interval" "BillingInterval",
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "entitlement_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("subscription_period_id")
);

CREATE TABLE "refunds" (
    "refund_id" SERIAL NOT NULL,
    "provider_refund_id" UUID NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "org_id" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "provider_transaction_id" TEXT,
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("refund_id")
);

ALTER TABLE "payments" ADD COLUMN "subscription_change_id" INTEGER;
ALTER TABLE "usersQ" ADD COLUMN "suspended_by_plan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "area" ADD COLUMN "suspended_by_plan" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_changes" ADD COLUMN "resource_selection" JSONB;
ALTER TABLE "organizations" ADD COLUMN "enterprise_contract_reference" TEXT;
ALTER TABLE "organizations" ADD COLUMN "enterprise_entitlements" JSONB;

CREATE TABLE "subscription_audit_logs" (
    "subscription_audit_log_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "actor_user_id" INTEGER,
    "action" TEXT NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_audit_logs_pkey" PRIMARY KEY ("subscription_audit_log_id")
);

CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");
CREATE INDEX "subscription_changes_org_id_status_idx" ON "subscription_changes"("org_id", "status");
CREATE INDEX "subscription_changes_effective_at_status_idx" ON "subscription_changes"("effective_at", "status");
CREATE UNIQUE INDEX "subscription_changes_one_open_per_org_idx"
    ON "subscription_changes"("org_id")
    WHERE "status" IN ('AWAITING_PAYMENT', 'SCHEDULED');
CREATE INDEX "subscription_periods_org_id_starts_at_idx" ON "subscription_periods"("org_id", "starts_at");
CREATE INDEX "subscription_periods_payment_id_idx" ON "subscription_periods"("payment_id");
CREATE UNIQUE INDEX "payments_subscription_change_id_key" ON "payments"("subscription_change_id");
CREATE UNIQUE INDEX "refunds_provider_refund_id_key" ON "refunds"("provider_refund_id");
CREATE UNIQUE INDEX "refunds_payment_id_key" ON "refunds"("payment_id");
CREATE INDEX "refunds_org_id_status_idx" ON "refunds"("org_id", "status");
CREATE INDEX "subscription_audit_logs_org_id_created_at_idx" ON "subscription_audit_logs"("org_id", "created_at");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("plan_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("subscription_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_from_plan_id_fkey" FOREIGN KEY ("from_plan_id") REFERENCES "plan"("plan_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_to_plan_id_fkey" FOREIGN KEY ("to_plan_id") REFERENCES "plan"("plan_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("plan_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_change_id_fkey" FOREIGN KEY ("subscription_change_id") REFERENCES "subscription_changes"("subscription_change_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_audit_logs" ADD CONSTRAINT "subscription_audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "subscriptions" (
    "org_id", "plan_id", "status", "billing_interval", "current_period_start", "current_period_end", "version", "updated_at"
)
SELECT
    o."org_id",
    o."subscription_plan",
    CASE
        WHEN o."trial_expires_at" IS NOT NULL AND o."trial_expires_at" > CURRENT_TIMESTAMP THEN 'TRIALING'::"SubscriptionStatus"
        WHEN o."subscription_expires_at" IS NOT NULL AND o."subscription_expires_at" <= CURRENT_TIMESTAMP THEN 'EXPIRED'::"SubscriptionStatus"
        ELSE 'ACTIVE'::"SubscriptionStatus"
    END,
    o."subscription_interval",
    COALESCE(o."subscription_started_at", o."created_at"),
    o."subscription_expires_at",
    1,
    CURRENT_TIMESTAMP
FROM "organizations" o
WHERE o."subscription_plan" IS NOT NULL;

INSERT INTO "subscription_periods" (
    "org_id", "plan_id", "billing_interval", "starts_at", "ends_at", "source", "entitlement_snapshot"
)
SELECT
    o."org_id",
    o."subscription_plan",
    o."subscription_interval",
    COALESCE(o."subscription_started_at", o."created_at"),
    o."subscription_expires_at",
    'MIGRATION',
    jsonb_build_object('plan', p."title", 'features', p."features")
FROM "organizations" o
JOIN "plan" p ON p."plan_id" = o."subscription_plan"
WHERE o."subscription_plan" IS NOT NULL;
