-- Incrementing this value invalidates every access and refresh token for the account.
ALTER TABLE "usersQ" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
