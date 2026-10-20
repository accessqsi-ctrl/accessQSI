CREATE TABLE "pass_issuance_requests" (
    "pass_issuance_request_id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "scope" VARCHAR(120) NOT NULL,
    "idempotency_key_hash" CHAR(64) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "qr_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pass_issuance_requests_pkey" PRIMARY KEY ("pass_issuance_request_id")
);

CREATE UNIQUE INDEX "pass_issuance_requests_qr_id_key"
ON "pass_issuance_requests"("qr_id");

CREATE UNIQUE INDEX "pass_issuance_requests_org_id_scope_idempotency_key_hash_key"
ON "pass_issuance_requests"("org_id", "scope", "idempotency_key_hash");

CREATE INDEX "pass_issuance_requests_org_id_created_at_idx"
ON "pass_issuance_requests"("org_id", "created_at");

ALTER TABLE "pass_issuance_requests"
ADD CONSTRAINT "pass_issuance_requests_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pass_issuance_requests"
ADD CONSTRAINT "pass_issuance_requests_qr_id_fkey"
FOREIGN KEY ("qr_id") REFERENCES "qr_codes"("qr_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
