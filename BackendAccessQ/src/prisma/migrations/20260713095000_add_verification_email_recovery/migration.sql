ALTER TABLE "usersQ"
ADD COLUMN "verification_token_expires_at" TIMESTAMP(3),
ADD COLUMN "verification_email_sent_at" TIMESTAMP(3);

UPDATE "usersQ"
SET "verification_token_expires_at" = CURRENT_TIMESTAMP + INTERVAL '24 hours'
WHERE "verification_token" IS NOT NULL AND "is_verified" = false;
