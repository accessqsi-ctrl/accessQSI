CREATE TYPE "RegistrationFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "RegistrationStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RegistrationIssuanceStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'BLOCKED_QUOTA', 'FAILED');
CREATE TYPE "RegistrationEmailStatus" AS ENUM ('PENDING', 'ACCEPTED', 'FAILED');
CREATE TYPE "RegistrationTokenPurpose" AS ENUM ('PASS_ACCESS');
CREATE TYPE "RegistrationJobType" AS ENUM ('ISSUE_PASS', 'SEND_PASS_EMAIL');
CREATE TYPE "RegistrationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "registration_forms" (
    "registration_form_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "public_slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "RegistrationFormStatus" NOT NULL DEFAULT 'DRAFT',
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "ask_phone" BOOLEAN NOT NULL DEFAULT false,
    "phone_required" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_forms_pkey" PRIMARY KEY ("registration_form_id")
);

CREATE TABLE "registration_offers" (
    "registration_offer_id" UUID NOT NULL,
    "registration_form_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "access_type" VARCHAR(20) NOT NULL DEFAULT 'single',
    "usage_limit" INTEGER NOT NULL DEFAULT 1,
    "level" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "card_template_id" VARCHAR(160),
    "card_message" VARCHAR(240),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_offers_pkey" PRIMARY KEY ("registration_offer_id"),
    CONSTRAINT "registration_offers_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
    CONSTRAINT "registration_offers_usage_limit_check" CHECK ("usage_limit" > 0),
    CONSTRAINT "registration_offers_level_check" CHECK ("level" > 0)
);

CREATE TABLE "registrations" (
    "registration_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "registration_form_id" UUID NOT NULL,
    "registration_offer_id" UUID NOT NULL,
    "submission_key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "holder_name" VARCHAR(160) NOT NULL,
    "holder_email" VARCHAR(320) NOT NULL,
    "holder_phone" VARCHAR(40),
    "offer_snapshot" JSONB NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PROCESSING',
    "issuance_status" "RegistrationIssuanceStatus" NOT NULL DEFAULT 'PENDING',
    "email_status" "RegistrationEmailStatus" NOT NULL DEFAULT 'PENDING',
    "qr_id" INTEGER,
    "capacity_held" BOOLEAN NOT NULL DEFAULT true,
    "capacity_released_at" TIMESTAMP(3),
    "failure_code" VARCHAR(80),
    "failure_message" VARCHAR(500),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registrations_pkey" PRIMARY KEY ("registration_id")
);

CREATE TABLE "registration_access_tokens" (
    "registration_access_token_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "purpose" "RegistrationTokenPurpose" NOT NULL DEFAULT 'PASS_ACCESS',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    CONSTRAINT "registration_access_tokens_pkey" PRIMARY KEY ("registration_access_token_id")
);

CREATE TABLE "registration_email_deliveries" (
    "registration_email_delivery_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "status" "RegistrationEmailStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(30) NOT NULL DEFAULT 'BREVO',
    "provider_message_id" VARCHAR(200),
    "failure_message" VARCHAR(500),
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_email_deliveries_pkey" PRIMARY KEY ("registration_email_delivery_id")
);

CREATE TABLE "registration_jobs" (
    "registration_job_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "type" "RegistrationJobType" NOT NULL,
    "status" "RegistrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 6,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMP(3),
    "locked_by" VARCHAR(120),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "registration_jobs_pkey" PRIMARY KEY ("registration_job_id")
);

CREATE UNIQUE INDEX "registration_forms_public_slug_key" ON "registration_forms"("public_slug");
CREATE INDEX "registration_forms_org_id_created_at_idx" ON "registration_forms"("org_id", "created_at");
CREATE INDEX "registration_forms_event_id_idx" ON "registration_forms"("event_id");
CREATE INDEX "registration_offers_registration_form_id_position_idx" ON "registration_offers"("registration_form_id", "position");
CREATE UNIQUE INDEX "registrations_qr_id_key" ON "registrations"("qr_id");
CREATE UNIQUE INDEX "registrations_registration_form_id_submission_key_hash_key" ON "registrations"("registration_form_id", "submission_key_hash");
CREATE INDEX "registrations_org_id_created_at_idx" ON "registrations"("org_id", "created_at");
CREATE INDEX "registrations_registration_form_id_status_created_at_idx" ON "registrations"("registration_form_id", "status", "created_at");
CREATE INDEX "registrations_registration_offer_id_capacity_held_idx" ON "registrations"("registration_offer_id", "capacity_held");
CREATE INDEX "registrations_holder_email_idx" ON "registrations"("holder_email");
CREATE UNIQUE INDEX "registration_access_tokens_token_hash_key" ON "registration_access_tokens"("token_hash");
CREATE INDEX "registration_access_tokens_registration_id_expires_at_idx" ON "registration_access_tokens"("registration_id", "expires_at");
CREATE INDEX "registration_email_deliveries_registration_id_created_at_idx" ON "registration_email_deliveries"("registration_id", "created_at");
CREATE INDEX "registration_jobs_status_run_after_lease_until_idx" ON "registration_jobs"("status", "run_after", "lease_until");
CREATE INDEX "registration_jobs_registration_id_type_created_at_idx" ON "registration_jobs"("registration_id", "type", "created_at");
CREATE UNIQUE INDEX "registration_jobs_one_active_type_idx" ON "registration_jobs"("registration_id", "type") WHERE "status" IN ('PENDING', 'PROCESSING');

ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_offers" ADD CONSTRAINT "registration_offers_registration_form_id_fkey" FOREIGN KEY ("registration_form_id") REFERENCES "registration_forms"("registration_form_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registration_form_id_fkey" FOREIGN KEY ("registration_form_id") REFERENCES "registration_forms"("registration_form_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registration_offer_id_fkey" FOREIGN KEY ("registration_offer_id") REFERENCES "registration_offers"("registration_offer_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_qr_id_fkey" FOREIGN KEY ("qr_id") REFERENCES "qr_codes"("qr_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_access_tokens" ADD CONSTRAINT "registration_access_tokens_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registration_email_deliveries" ADD CONSTRAINT "registration_email_deliveries_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registration_jobs" ADD CONSTRAINT "registration_jobs_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE CASCADE ON UPDATE CASCADE;
