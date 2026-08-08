CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL', 'ONE_TIME');
CREATE TYPE "EventEntitlementType" AS ENUM ('SUBSCRIPTION', 'EVENT_PASS');
CREATE TYPE "EventPassStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'EXPIRED');

ALTER TABLE "organizations"
ADD COLUMN "subscription_interval" "BillingInterval";

ALTER TABLE "events"
ADD COLUMN "entitlement_type" "EventEntitlementType" NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN "qr_limit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "entitlement_expires_at" TIMESTAMP(3);

ALTER TABLE "payments"
ADD COLUMN "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';

CREATE TABLE "event_passes" (
    "event_pass_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "payment_id" INTEGER NOT NULL,
    "event_id" INTEGER,
    "status" "EventPassStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    CONSTRAINT "event_passes_pkey" PRIMARY KEY ("event_pass_id")
);

CREATE UNIQUE INDEX "event_passes_payment_id_key" ON "event_passes"("payment_id");
CREATE UNIQUE INDEX "event_passes_event_id_key" ON "event_passes"("event_id");
CREATE INDEX "event_passes_org_id_status_idx" ON "event_passes"("org_id", "status");

ALTER TABLE "event_passes"
ADD CONSTRAINT "event_passes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "event_passes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "event_passes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
    discovery_id INTEGER;
    legacy_id INTEGER;
BEGIN
    SELECT "plan_id" INTO discovery_id FROM "plan" WHERE "title" = 'DISCOVERY';
    SELECT "plan_id" INTO legacy_id FROM "plan" WHERE "title" IN ('FREE', 'STANDARD') ORDER BY "plan_id" LIMIT 1;
    IF legacy_id IS NOT NULL AND discovery_id IS NOT NULL THEN
        UPDATE "organizations" SET "subscription_plan" = discovery_id WHERE "subscription_plan" = legacy_id;
        UPDATE "payments" SET "plan_id" = discovery_id WHERE "plan_id" = legacy_id;
        DELETE FROM "plan" WHERE "plan_id" = legacy_id;
    ELSIF legacy_id IS NOT NULL THEN
        UPDATE "plan" SET "title" = 'DISCOVERY', "cost" = 0, "currency" = 'USD' WHERE "plan_id" = legacy_id;
    END IF;
END $$;

INSERT INTO "plan" ("title", "cost", "currency", "features")
VALUES
('DISCOVERY', 0, 'USD', '[]'::jsonb),
('ESSENTIAL', 15, 'USD', '["bulk_qr_import","scan_exports"]'::jsonb),
('PRO', 25, 'USD', '["bulk_qr_import","custom_card_templates","scan_exports","advanced_analytics"]'::jsonb),
('EVENT_PASS', 7, 'USD', '[]'::jsonb)
ON CONFLICT ("title") DO UPDATE SET
"cost" = EXCLUDED."cost",
"currency" = EXCLUDED."currency",
"features" = EXCLUDED."features";

UPDATE "events" AS e
SET "qr_limit" = GREATEST(
    COALESCE((SELECT COUNT(*)::integer FROM "qr_codes" q WHERE q."event_id" = e."event_id"), 0),
    CASE p."title"
        WHEN 'PRO' THEN 700
        WHEN 'ESSENTIAL' THEN 200
        ELSE 50
    END
)
FROM "organizations" o
LEFT JOIN "plan" p ON p."plan_id" = o."subscription_plan"
WHERE o."org_id" = e."org_id";
