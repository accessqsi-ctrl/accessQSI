CREATE TABLE "card_template_customs" (
    "id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "base_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL,
    "secondary_color" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "card_message_default" TEXT,
    "logo_url" TEXT,
    "qr_position" TEXT NOT NULL,
    "visible_fields" JSONB NOT NULL,
    "layout" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_template_customs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "card_template_customs_org_id_deleted_at_idx" ON "card_template_customs"("org_id", "deleted_at");
CREATE INDEX "card_template_customs_org_id_is_default_idx" ON "card_template_customs"("org_id", "is_default");

ALTER TABLE "card_template_customs" ADD CONSTRAINT "card_template_customs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;
