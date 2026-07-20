UPDATE "qr_codes"
SET "status" = 'active'
WHERE "usage_limit" = 0
  AND "status" = 'used_up'
  AND "deleted_at" IS NULL;
