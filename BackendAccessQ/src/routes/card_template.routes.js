const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { requirePlanCapability } = require("../middleware/planAccessMiddleware");
const { PLAN_CAPABILITIES } = require("../config/subscription");
const cardTemplateController = require("../controllers/api.card_template.controller");

const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);
const canManageCustomTemplates = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN", "ORG_AGENT"]);
const requireCustomTemplates = requirePlanCapability(PLAN_CAPABILITIES.CUSTOM_CARD_TEMPLATES, {
    message: "Les modèles personnalisés nécessitent un abonnement Pro."
});
const requireCustomTemplatesWhenSelected = (req, res, next) => {
    const templateId = String(req.body?.templateId || "").trim();
    if (templateId.startsWith("custom:")) {
        return requireCustomTemplates(req, res, next);
    }
    return next();
};
// Le fichier reste en mémoire : son type réel est vérifié sur les octets avant tout enregistrement.
const imageUpload = (field) => {
    const middleware = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024, files: 1 }
    }).single(field);
    return (req, res, next) => middleware(req, res, (error) => {
        if (!error) return next();
        const tooLarge = error.code === "LIMIT_FILE_SIZE";
        return res.status(tooLarge ? 413 : 400).json({
            success: false,
            message: tooLarge ? "L'image ne doit pas dépasser 2 Mo." : "Envoi de l'image invalide."
        });
    });
};

router.use(authMiddleware);

router.get("/custom", requireCustomTemplates, cardTemplateController.listCustomTemplates);
router.post("/preview", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.previewTemplate);
router.put("/custom/:id/status", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.setStatus);
router.post("/custom", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.createCustomTemplate);
router.get("/default", cardTemplateController.getDefaultTemplate);
router.put("/default", adminOnly, requireCustomTemplatesWhenSelected, cardTemplateController.setDefaultTemplate);
// Le modèle par défaut est un réglage de l'organisation : réservé aux administrateurs.
router.put("/custom/default/clear", adminOnly, requireCustomTemplates, cardTemplateController.clearDefaultCustomTemplate);
router.delete("/default", adminOnly, cardTemplateController.clearDefaultCustomTemplate);
router.post("/custom/:id/duplicate", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.duplicateCustomTemplate);
router.post("/logo", canManageCustomTemplates, requireCustomTemplates, imageUpload("logo"), cardTemplateController.uploadLogo);
router.post("/background", canManageCustomTemplates, requireCustomTemplates, imageUpload("background"), cardTemplateController.uploadBackground);
router.get("/assets", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.listAssets);
router.post("/assets", canManageCustomTemplates, requireCustomTemplates, imageUpload("file"), cardTemplateController.uploadAsset);
router.patch("/assets/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.updateAsset);
router.delete("/assets/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.deleteAsset);
router.put("/custom/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.updateCustomTemplate);
router.delete("/custom/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.deleteCustomTemplate);
router.put("/custom/:id/default", adminOnly, requireCustomTemplates, cardTemplateController.setDefaultCustomTemplate);

module.exports = router;
