-- Reversements saisis par un super-admin : destinataire libre, organisation facultative (solde plateforme sinon).
ALTER TABLE "organizer_payouts" ALTER COLUMN "org_id" DROP NOT NULL;
ALTER TABLE "organizer_payouts" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "organizer_payouts" ADD COLUMN "manual_recipient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizer_payouts" ADD COLUMN "note" VARCHAR(500);
