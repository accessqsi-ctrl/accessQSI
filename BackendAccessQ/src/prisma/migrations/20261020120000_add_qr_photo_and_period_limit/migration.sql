-- Limite d'utilisation par période (jour, semaine, mois) et photo du titulaire.
ALTER TYPE "ScanStatus" ADD VALUE 'denied_period_limit';

CREATE TYPE "QrPeriodUnit" AS ENUM ('day', 'week', 'month');

ALTER TABLE "qr_codes"
ADD COLUMN "period_limit" INTEGER,
ADD COLUMN "period_unit" "QrPeriodUnit",
ADD COLUMN "period_timezone" VARCHAR(64);

CREATE TABLE "qr_holder_photos" (
    "qr_id" INTEGER NOT NULL,
    "mime_type" VARCHAR(20) NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_holder_photos_pkey" PRIMARY KEY ("qr_id")
);

ALTER TABLE "qr_holder_photos"
ADD CONSTRAINT "qr_holder_photos_qr_id_fkey"
FOREIGN KEY ("qr_id") REFERENCES "qr_codes"("qr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accélère le comptage des passages autorisés sur la période en cours.
CREATE INDEX "scan_logs_qr_code_id_status_scanned_at_idx"
ON "scan_logs"("qr_code_id", "status", "scanned_at");
