-- Reversements aux organisateurs et remboursements des achats de billets.
-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'SUBMITTING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'PAYOUT';
ALTER TYPE "LedgerEntryType" ADD VALUE 'PAYOUT_REVERSAL';

-- AlterTable
ALTER TABLE "organizer_ledger_entries" ADD COLUMN     "payout_id" UUID;

-- CreateTable
CREATE TABLE "organizer_payout_accounts" (
    "payout_account_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "updated_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_payout_accounts_pkey" PRIMARY KEY ("payout_account_id")
);

-- CreateTable
CREATE TABLE "organizer_payouts" (
    "payout_id" UUID NOT NULL,
    "provider_payout_id" UUID NOT NULL,
    "org_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_id" INTEGER NOT NULL,
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "provider_transaction_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "organizer_payouts_pkey" PRIMARY KEY ("payout_id")
);

-- CreateTable
CREATE TABLE "ticket_refunds" (
    "ticket_refund_id" UUID NOT NULL,
    "provider_refund_id" UUID NOT NULL,
    "ticket_payment_id" UUID NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500) NOT NULL,
    "requested_by_id" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "provider_transaction_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "provider_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ticket_refunds_pkey" PRIMARY KEY ("ticket_refund_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizer_payout_accounts_org_id_currency_key" ON "organizer_payout_accounts"("org_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_payouts_provider_payout_id_key" ON "organizer_payouts"("provider_payout_id");

-- CreateIndex
CREATE INDEX "organizer_payouts_org_id_created_at_idx" ON "organizer_payouts"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "organizer_payouts_status_created_at_idx" ON "organizer_payouts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_refunds_provider_refund_id_key" ON "ticket_refunds"("provider_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_refunds_ticket_payment_id_key" ON "ticket_refunds"("ticket_payment_id");

-- CreateIndex
CREATE INDEX "ticket_refunds_status_created_at_idx" ON "ticket_refunds"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_ledger_entries_payout_id_type_key" ON "organizer_ledger_entries"("payout_id", "type");

-- AddForeignKey
ALTER TABLE "organizer_ledger_entries" ADD CONSTRAINT "organizer_ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "organizer_payouts"("payout_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_payout_accounts" ADD CONSTRAINT "organizer_payout_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_payout_accounts" ADD CONSTRAINT "organizer_payout_accounts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "usersQ"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_payouts" ADD CONSTRAINT "organizer_payouts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_payouts" ADD CONSTRAINT "organizer_payouts_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "usersQ"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizer_payouts" ADD CONSTRAINT "organizer_payouts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "usersQ"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_refunds" ADD CONSTRAINT "ticket_refunds_ticket_payment_id_fkey" FOREIGN KEY ("ticket_payment_id") REFERENCES "ticket_payments"("ticket_payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_refunds" ADD CONSTRAINT "ticket_refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "usersQ"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
