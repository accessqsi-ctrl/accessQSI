ALTER TABLE "qr_codes"
ADD COLUMN "card_message" TEXT,
ADD COLUMN "card_generation_status" TEXT,
ADD COLUMN "card_generation_error" TEXT;

UPDATE "qr_codes"
SET "card_generation_status" = CASE
  WHEN "card_generated_at" IS NOT NULL THEN 'READY'
  WHEN "card_template_id" IS NOT NULL THEN 'PENDING'
  ELSE NULL
END;
