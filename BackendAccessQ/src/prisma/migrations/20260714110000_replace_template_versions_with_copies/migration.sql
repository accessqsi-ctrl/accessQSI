DROP TABLE IF EXISTS "card_template_versions";
ALTER TABLE "card_template_customs" DROP COLUMN IF EXISTS "version";
ALTER TABLE "qr_codes" DROP COLUMN IF EXISTS "card_template_version";
