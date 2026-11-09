-- Auteur de chaque QR (organisateur ou agent), pour distinguer les QR créés à la main de ceux de la billetterie.
-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "created_by_id" INTEGER;

-- CreateIndex
CREATE INDEX "qr_codes_event_id_created_by_id_idx" ON "qr_codes"("event_id", "created_by_id");

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "usersQ"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
