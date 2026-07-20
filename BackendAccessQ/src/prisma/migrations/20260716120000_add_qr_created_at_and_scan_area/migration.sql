ALTER TYPE "ScanStatus" ADD VALUE 'denied_event_inactive';
ALTER TYPE "ScanStatus" ADD VALUE 'denied_area_not_allowed';
ALTER TYPE "ScanStatus" ADD VALUE 'denied_insufficient_level';

ALTER TABLE "qr_codes"
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "scan_logs"
ADD COLUMN "area_id" INTEGER;

CREATE INDEX "scan_logs_area_id_idx" ON "scan_logs"("area_id");

ALTER TABLE "scan_logs"
ADD CONSTRAINT "scan_logs_area_id_fkey"
FOREIGN KEY ("area_id") REFERENCES "area"("area_id")
ON DELETE SET NULL ON UPDATE CASCADE;
