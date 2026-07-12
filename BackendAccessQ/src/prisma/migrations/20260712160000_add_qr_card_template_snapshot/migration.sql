ALTER TABLE "card_template_customs"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "qr_codes"
ADD COLUMN "card_template_id" TEXT,
ADD COLUMN "card_template_version" INTEGER,
ADD COLUMN "card_template_snapshot" JSONB,
ADD COLUMN "card_generated_at" TIMESTAMP(3);

CREATE INDEX "qr_codes_card_template_id_idx" ON "qr_codes"("card_template_id");
