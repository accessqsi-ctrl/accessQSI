CREATE INDEX "scan_logs_scanned_at_id_idx"
ON "scan_logs"("scanned_at", "id");

CREATE INDEX "scan_logs_area_id_scanned_at_idx"
ON "scan_logs"("area_id", "scanned_at");

CREATE INDEX "scan_logs_status_scanned_at_idx"
ON "scan_logs"("status", "scanned_at");

