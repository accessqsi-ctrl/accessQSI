-- Bibliothèque d'images de l'organisation, réutilisables d'un modèle de carte à l'autre.
CREATE TABLE "organization_assets" (
    "id" SERIAL NOT NULL,
    "org_id" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'image',
    "mime_type" VARCHAR(20),
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_assets_org_id_created_at_idx" ON "organization_assets"("org_id", "created_at");

CREATE UNIQUE INDEX "organization_assets_org_id_url_key" ON "organization_assets"("org_id", "url");

ALTER TABLE "organization_assets" ADD CONSTRAINT "organization_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reprise des images déjà utilisées par les modèles existants.
INSERT INTO "organization_assets" ("org_id", "url", "name", "kind")
SELECT DISTINCT "org_id", "background_image_url", 'Image de fond', 'background'
FROM "card_template_customs"
WHERE "background_image_url" IS NOT NULL AND "background_image_url" <> '' AND "deleted_at" IS NULL
ON CONFLICT ("org_id", "url") DO NOTHING;

INSERT INTO "organization_assets" ("org_id", "url", "name", "kind")
SELECT DISTINCT "org_id", "logo_url", 'Logo', 'logo'
FROM "card_template_customs"
WHERE "logo_url" IS NOT NULL AND "logo_url" <> '' AND "deleted_at" IS NULL
ON CONFLICT ("org_id", "url") DO NOTHING;
