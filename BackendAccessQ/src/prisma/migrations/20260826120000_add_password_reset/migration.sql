ALTER TABLE "usersQ"
ADD COLUMN "password_reset_token_hash" TEXT,
ADD COLUMN "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN "password_reset_email_sent_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "usersQ_password_reset_token_hash_key"
ON "usersQ"("password_reset_token_hash");
