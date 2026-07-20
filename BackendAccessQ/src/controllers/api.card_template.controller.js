const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const customCardTemplateService = require("../services/custom_card_template.service");
const storageService = require("../services/storage.service");

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
        const svg = customCardTemplateService.previewPayload(req.body);
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

exports.uploadLogo = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Logo requis." });
        }

        const extension = path.extname(req.file.originalname || "").toLowerCase() || ".png";
        const filename = `logo_${orgId}_${crypto.randomUUID()}${extension}`;
        const targetDir = path.join(__dirname, "../statics/card-logos");
        const targetPath = path.join(targetDir, filename);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        await storageService.moveFile(req.file.path, targetPath);
        res.status(201).json({ success: true, logoUrl: `/card-logos/${filename}` });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: "Erreur lors de l'envoi du logo." });
    }
};

exports.uploadBackground = async (req, res) => {
    try {
        const orgId = requireOrg(req, res);
        if (!orgId) return;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image de fond requise." });
        }

        const extension = path.extname(req.file.originalname || "").toLowerCase() || ".png";
        const filename = `background_${orgId}_${crypto.randomUUID()}${extension}`;
        const targetDir = storageService.storagePath("card-backgrounds");
        const targetPath = path.join(targetDir, filename);
        await storageService.ensureDirectory(targetDir);

        await fs.promises.rename(req.file.path, targetPath);
        res.status(201).json({ success: true, backgroundImageUrl: `/card-backgrounds/${filename}` });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: "Erreur lors de l'envoi de l'image de fond." });
    }
};
