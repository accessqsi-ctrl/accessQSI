ALTER TABLE "card_template_customs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
UPDATE "card_template_customs" SET "status" = 'PUBLISHED' WHERE "deleted_at" IS NULL;
UPDATE "card_template_customs" SET "status" = 'ARCHIVED' WHERE "deleted_at" IS NOT NULL;

CREATE TABLE "card_template_versions" (
  "id" SERIAL PRIMARY KEY,
  "template_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "card_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "card_template_customs"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "card_template_versions_template_id_version_key" ON "card_template_versions"("template_id", "version");
CREATE INDEX "card_template_versions_template_id_created_at_idx" ON "card_template_versions"("template_id", "created_at");

INSERT INTO "card_template_versions" ("template_id", "version", "snapshot")
SELECT "id", "version", jsonb_build_object(
  'baseTemplateId', "base_template_id", 'name', "name", 'primaryColor', "primary_color",
  'secondaryColor', "secondary_color", 'title', "title", 'cardMessageDefault', "card_message_default",
  'logoUrl', "logo_url", 'backgroundImageUrl', "background_image_url", 'qrPosition', "qr_position",
  'visibleFields', "visible_fields", 'layoutConfig', "layout_config", 'canvasScene', "canvas_scene", 'layout', "layout"
) FROM "card_template_customs";
