const crypto = require("crypto");
const customCardTemplateService = require("../services/custom_card_template.service");
const storageService = require("../services/storage.service");
const organizationAssetService = require("../services/organization_asset.service");
const { IMAGE_EXTENSIONS, detectImageType } = require("../utils/imageType");

const requireOrg = (req, res) => {
    if (!req.user || !req.user.org_id) {
        res.status(401).json({ success: false, message: "Non autorisé" });
        return null;
    }
    return req.user.org_id;
};

exports.listCustomTemplates = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const result = await customCardTemplateService.listForOrg(orgId);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.previewTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;
        const svg = await customCardTemplateService.previewPayload(req.body);
        res.type("image/svg+xml").status(200).send(svg);
    } catch (error) {
        res.status(error.statusCode || 400).json({ success: false, message: error.message || "Aperçu impossible." });
    }
};

exports.setStatus = async (req, res) => {
    const orgId = requireOrg(req, res); if (!orgId) return;
    const template = await customCardTemplateService.setStatusForOrg(orgId, req.params.id, req.body.status);
    if (!template) return res.status(400).json({ success: false, message: "Statut ou modèle invalide." });
    res.json({ success: true, template });
};

exports.createCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const template = await customCardTemplateService.createForOrg(orgId, req.body);
        res.status(201).json({ success: true, template });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Erreur serveur" });
    }
};

exports.updateCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const template = await customCardTemplateService.updateForOrg(orgId, req.params.id, req.body);
        if (!template) {
            return res.status(404).json({ success: false, message: "Modèle personnalisé introuvable." });
        }

        res.status(200).json({ success: true, template });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Erreur serveur" });
    }
};

exports.deleteCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const deleted = await customCardTemplateService.deleteForOrg(orgId, req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Modèle personnalisé introuvable." });
        }

        res.status(200).json({ success: true, message: "Modèle personnalisé supprimé." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.duplicateCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const template = await customCardTemplateService.duplicateForOrg(orgId, req.params.id);
        if (!template) {
            return res.status(404).json({ success: false, message: "Modèle personnalisé introuvable." });
        }

        res.status(201).json({ success: true, template });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.setDefaultCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const result = await customCardTemplateService.setDefaultForOrg(orgId, `custom:${req.params.id}`);
        if (!result) {
            return res.status(404).json({ success: false, message: "Modèle personnalisé introuvable." });
        }

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.getDefaultTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const defaultTemplateId = await customCardTemplateService.getDefaultForOrg(orgId);
        res.status(200).json({ success: true, defaultTemplateId });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.setDefaultTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const result = await customCardTemplateService.setDefaultForOrg(orgId, req.body.templateId);
        if (!result) {
            return res.status(400).json({ success: false, message: "Modèle de carte invalide." });
        }

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

exports.clearDefaultCustomTemplate = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        await customCardTemplateService.clearDefaultForOrg(orgId);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
};

const assetErrorResponse = (res, error, fallbackMessage) => (
    error instanceof organizationAssetService.AssetError
        ? res.status(error.statusCode).json({ success: false, message: error.message })
        : res.status(500).json({ success: false, message: fallbackMessage })
);

// Enregistre une image de modèle après vérification de son type réel, puis l'ajoute à la
// bibliothèque de l'organisation. L'extension et le Content-Type stockés sont déduits des
// octets : un fichier HTML, JS ou SVG est refusé.
const saveTemplateImage = async (req, res, { directory, prefix, kind, responseKey, missingMessage, errorMessage }) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        const buffer = req.file?.buffer;
        if (!buffer?.length) {
            return res.status(400).json({ success: false, message: missingMessage });
        }
        const contentType = detectImageType(buffer);
        if (!contentType) {
            return res.status(415).json({ success: false, message: "Format non supporté. Utilisez une image JPEG, PNG ou WebP." });
        }
        await organizationAssetService.assertCapacity(orgId);

        const filename = `${prefix}_${orgId}_${crypto.randomUUID()}${IMAGE_EXTENSIONS[contentType]}`;
        const url = await storageService.saveUploadedAsset({ directory, filename, contentType, buffer });
        const asset = await organizationAssetService.registerForOrg(orgId, {
            url,
            name: req.body?.name || String(req.file.originalname || "").replace(/\.[^.]+$/, ""),
            kind,
            mimeType: contentType,
            sizeBytes: buffer.length
        });
        res.status(201).json({ success: true, [responseKey]: url, asset });
    } catch (error) {
        assetErrorResponse(res, error, errorMessage);
    }
};

exports.uploadLogo = (req, res) => saveTemplateImage(req, res, {
    directory: "card-logos",
    prefix: "logo",
    kind: "logo",
    responseKey: "logoUrl",
    missingMessage: "Logo requis.",
    errorMessage: "Erreur lors de l'envoi du logo."
});

exports.uploadBackground = (req, res) => saveTemplateImage(req, res, {
    directory: "card-backgrounds",
    prefix: "background",
    kind: "background",
    responseKey: "backgroundImageUrl",
    missingMessage: "Image de fond requise.",
    errorMessage: "Erreur lors de l'envoi de l'image de fond."
});

// ===== Bibliothèque d'images de l'organisation =====
exports.listAssets = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;
        res.json({
            success: true,
            assets: await organizationAssetService.listForOrg(orgId),
            maxAssets: organizationAssetService.MAX_ASSETS_PER_ORG
        });
    } catch (error) {
        assetErrorResponse(res, error, "Impossible de charger la bibliothèque.");
    }
};

exports.uploadAsset = (req, res) => {
    const kind = organizationAssetService.ASSET_KINDS.includes(req.body?.kind) ? req.body.kind : "image";
    return saveTemplateImage(req, res, {
        directory: kind === "logo" ? "card-logos" : "card-backgrounds",
        prefix: kind === "logo" ? "logo" : "background",
        kind,
        responseKey: "url",
        missingMessage: "Image requise.",
        errorMessage: "Erreur lors de l'envoi de l'image."
    });
};

exports.updateAsset = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;
        const asset = await organizationAssetService.updateForOrg(orgId, req.params.id, {
            name: req.body?.name,
            kind: req.body?.kind
        });
        res.json({ success: true, asset });
    } catch (error) {
        assetErrorResponse(res, error, "Impossible de modifier l'image.");
    }
};

exports.deleteAsset = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;
        await organizationAssetService.deleteForOrg(orgId, req.params.id);
        res.json({ success: true });
    } catch (error) {
        assetErrorResponse(res, error, "Impossible de supprimer l'image.");
    }
};
