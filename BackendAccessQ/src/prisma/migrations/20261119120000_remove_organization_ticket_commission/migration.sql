-- Les ventes de billets ne prélèvent plus de commission AccessQ.
ALTER TABLE "organizations" DROP COLUMN "ticket_commission_bps";
