ALTER TABLE "area" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "usersQ_org_id_deleted_at_idx" ON "usersQ"("org_id", "deleted_at");
CREATE INDEX "usersQ_role_idx" ON "usersQ"("role");
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");
CREATE INDEX "events_org_id_deleted_at_idx" ON "events"("org_id", "deleted_at");
CREATE INDEX "qr_codes_event_id_status_deleted_at_idx" ON "qr_codes"("event_id", "status", "deleted_at");
CREATE INDEX "scan_logs_qr_code_id_idx" ON "scan_logs"("qr_code_id");
CREATE INDEX "scan_logs_scanned_by_id_idx" ON "scan_logs"("scanned_by_id");
CREATE INDEX "scan_logs_scanned_at_idx" ON "scan_logs"("scanned_at");
CREATE INDEX "area_org_id_deleted_at_idx" ON "area"("org_id", "deleted_at");
CREATE INDEX "EventSchedule_id_event_idx" ON "EventSchedule"("id_event");
CREATE INDEX "EventSchedule_id_area_idx" ON "EventSchedule"("id_area");
