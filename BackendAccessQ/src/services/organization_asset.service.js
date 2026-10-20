// Bibliothèque d'images d'une organisation. Les fichiers sont stockés comme les autres ressources
// de modèles (storage.service) ; cette table permet de les retrouver et de les réutiliser.
const prisma = require("../prisma/client");
const storageService = require("./storage.service");

const ASSET_KINDS = Object.freeze(["logo", "background", "signature", "image"]);
const MAX_ASSETS_PER_ORG = 200;

class AssetError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "AssetError";
        this.statusCode = statusCode;
    }
}

const normalizeKind = (value) => (ASSET_KINDS.includes(String(value || "").trim()) ? String(value).trim() : "image");
const normalizeName = (value, fallback = "Image") => String(value || "").trim().slice(0, 120) || fallback;

const toApiAsset = (asset) => ({
    id: asset.id,
    url: asset.url,
    name: asset.name,
    kind: asset.kind,
    mimeType: asset.mime_type,
    sizeBytes: asset.size_bytes,
    createdAt: asset.created_at
});

const listForOrg = async (orgId) => {
    const assets = await prisma.organizationAsset.findMany({
        where: { org_id: orgId },
        orderBy: { created_at: "desc" }
    });
    return assets.map(toApiAsset);
};

const assertCapacity = async (orgId) => {
    const count = await prisma.organizationAsset.count({ where: { org_id: orgId } });
    if (count >= MAX_ASSETS_PER_ORG) {
        throw new AssetError(`La bibliothèque est limitée à ${MAX_ASSETS_PER_ORG} images. Supprimez celles qui ne servent plus.`, 409);
    }
};

// Enregistre une image déjà stockée ; un même fichier n'apparaît qu'une fois.
const registerForOrg = async (orgId, { url, name, kind, mimeType, sizeBytes }) => {
    const asset = await prisma.organizationAsset.upsert({
        where: { org_id_url: { org_id: orgId, url } },
        create: {
            org_id: orgId,
            url,
            name: normalizeName(name),
            kind: normalizeKind(kind),
            mime_type: mimeType || null,
            size_bytes: Number.isInteger(sizeBytes) ? sizeBytes : null
        },
        update: {}
    });
    return toApiAsset(asset);
};

const updateForOrg = async (orgId, id, { name, kind }) => {
    const existing = await prisma.organizationAsset.findFirst({ where: { id: Number(id), org_id: orgId } });
    if (!existing) throw new AssetError("Image introuvable.", 404);
    const asset = await prisma.organizationAsset.update({
        where: { id: existing.id },
        data: {
            ...(name !== undefined ? { name: normalizeName(name, existing.name) } : {}),
            ...(kind !== undefined ? { kind: normalizeKind(kind) } : {})
        }
    });
    return toApiAsset(asset);
};

// Nombre de modèles et de cartes déjà émises qui affichent encore cette image.
const countUsages = async (orgId, url) => {
    const [templates] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM "card_template_customs"
        WHERE "org_id" = ${orgId} AND "deleted_at" IS NULL
          AND ("background_image_url" = ${url} OR "logo_url" = ${url}
               OR position(${url} in COALESCE("canvas_scene"::text, '')) > 0)`;
    const [cards] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM "qr_codes" q
        JOIN "events" e ON e."event_id" = q."event_id"
        WHERE e."org_id" = ${orgId} AND q."deleted_at" IS NULL
          AND position(${url} in COALESCE(q."card_template_snapshot"::text, '')) > 0`;
    return { templates: Number(templates?.count || 0), cards: Number(cards?.count || 0) };
};

const deleteForOrg = async (orgId, id) => {
    const existing = await prisma.organizationAsset.findFirst({ where: { id: Number(id), org_id: orgId } });
    if (!existing) throw new AssetError("Image introuvable.", 404);

    const usages = await countUsages(orgId, existing.url);
    if (usages.templates > 0 || usages.cards > 0) {
        const parts = [
            usages.templates ? `${usages.templates} modèle${usages.templates > 1 ? "s" : ""}` : "",
            usages.cards ? `${usages.cards} carte${usages.cards > 1 ? "s" : ""} déjà émise${usages.cards > 1 ? "s" : ""}` : ""
        ].filter(Boolean);
        throw new AssetError(`Cette image est encore utilisée par ${parts.join(" et ")}.`, 409);
    }

    await prisma.organizationAsset.delete({ where: { id: existing.id } });
    for (const directory of ["card-backgrounds", "card-logos"]) {
        if (await storageService.removeManagedPublicAsset(existing.url, directory)) break;
    }
};

module.exports = {
    ASSET_KINDS,
    AssetError,
    MAX_ASSETS_PER_ORG,
    assertCapacity,
    countUsages,
    deleteForOrg,
    listForOrg,
    registerForOrg,
    updateForOrg
};
