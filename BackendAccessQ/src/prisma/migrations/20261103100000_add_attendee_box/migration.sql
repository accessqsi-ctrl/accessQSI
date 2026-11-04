-- Comptes participants, codes de connexion par email et propriété des billets (box).
CREATE TABLE "attendees" (
    "attendee_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(40),
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendees_pkey" PRIMARY KEY ("attendee_id")
);

CREATE UNIQUE INDEX "attendees_email_key" ON "attendees"("email");

CREATE TABLE "attendee_login_codes" (
    "attendee_login_code_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendee_login_codes_pkey" PRIMARY KEY ("attendee_login_code_id")
);

CREATE INDEX "attendee_login_codes_email_created_at_idx" ON "attendee_login_codes"("email", "created_at");

ALTER TABLE "registration_offers" ADD COLUMN "box_only_qr" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "registrations" ADD COLUMN "owner_attendee_id" UUID;

CREATE INDEX "registrations_owner_attendee_id_created_at_idx" ON "registrations"("owner_attendee_id", "created_at");

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_owner_attendee_id_fkey" FOREIGN KEY ("owner_attendee_id") REFERENCES "attendees"("attendee_id") ON DELETE SET NULL ON UPDATE CASCADE;
