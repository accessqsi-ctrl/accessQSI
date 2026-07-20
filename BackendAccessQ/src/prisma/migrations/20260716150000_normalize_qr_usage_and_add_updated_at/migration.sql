UPDATE "qr_codes"
SET "usage_limit" = 0
WHERE "usage_limit" >= 999999;

UPDATE "qr_codes"
SET "status" = 'used_up'
WHERE "status" = 'active'
  AND "usage_limit" > 0
  AND "scans_count" >= "usage_limit";

UPDATE "qr_codes"
SET "status" = 'expired'
WHERE "status" = 'active'
  AND "valid_until" IS NOT NULL
  AND "valid_until" < CURRENT_TIMESTAMP;

ALTER TABLE "qr_codes"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "qr_codes"
ADD CONSTRAINT "qr_codes_usage_limit_non_negative"
CHECK ("usage_limit" >= 0);

ALTER TABLE "qr_codes"
ADD CONSTRAINT "qr_codes_scans_count_non_negative"
CHECK ("scans_count" >= 0);
