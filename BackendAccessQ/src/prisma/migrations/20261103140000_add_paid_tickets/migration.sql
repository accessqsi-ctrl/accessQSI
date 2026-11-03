-- Billetterie payante : prix des offres, paiements des billets, commission et solde des organisateurs.
-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('TICKET_SALE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ticket_commission_bps" INTEGER;

-- AlterTable
ALTER TABLE "registration_offers" ADD COLUMN     "currency" VARCHAR(3),
ADD COLUMN     "price" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "ticket_payments" (
    "ticket_payment_id" UUID NOT NULL,
    "deposit_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "registration_form_id" UUID NOT NULL,
    "registration_offer_id" UUID NOT NULL,
    "attendee_id" UUID NOT NULL,
    "registration_id" UUID,
    "submission_key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "holder_phone" VARCHAR(40),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "commission_bps" INTEGER NOT NULL,
    "commission_amount" DECIMAL(18,2) NOT NULL,
    "organizer_amount" DECIMAL(18,2) NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "hold_expires_at" TIMESTAMP(3) NOT NULL,
    "provider_transaction_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ticket_payments_pkey" PRIMARY KEY ("ticket_payment_id")
);

-- CreateTable
CREATE TABLE "organizer_ledger_entries" (
    "ledger_entry_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "ticket_payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizer_ledger_entries_pkey" PRIMARY KEY ("ledger_entry_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_payments_deposit_id_key" ON "ticket_payments"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_payments_registration_id_key" ON "ticket_payments"("registration_id");

-- CreateIndex
CREATE INDEX "ticket_payments_registration_offer_id_status_hold_expires_a_idx" ON "ticket_payments"("registration_offer_id", "status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "ticket_payments_attendee_id_created_at_idx" ON "ticket_payments"("attendee_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_payments_org_id_created_at_idx" ON "ticket_payments"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_payments_status_created_at_idx" ON "ticket_payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_payments_registration_form_id_submission_key_hash_key" ON "ticket_payments"("registration_form_id", "submission_key_hash");

-- CreateIndex
CREATE INDEX "organizer_ledger_entries_org_id_currency_idx" ON "organizer_ledger_entries"("org_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_ledger_entries_ticket_payment_id_type_key" ON "organizer_ledger_entries"("ticket_payment_id", "type");

-- AddForeignKey
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_registration_form_id_fkey" FOREIGN KEY ("registration_form_id") REFERENCES "registration_forms"("registration_form_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_registration_offer_id_fkey" FOREIGN KEY ("registration_offer_id") REFERENCES "registration_offers"("registration_offer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "attendees"("attendee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_payments" ADD CONSTRAINT "ticket_payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("registration_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_ledger_entries" ADD CONSTRAINT "organizer_ledger_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_ledger_entries" ADD CONSTRAINT "organizer_ledger_entries_ticket_payment_id_fkey" FOREIGN KEY ("ticket_payment_id") REFERENCES "ticket_payments"("ticket_payment_id") ON DELETE SET NULL ON UPDATE CASCADE;
