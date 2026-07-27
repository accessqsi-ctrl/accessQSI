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
const upload = multer({
    dest: "tmp/uploads/",
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Format de logo non supporté."), false);
        }
    }
});

router.use(authMiddleware);

router.get("/custom", requireCustomTemplates, cardTemplateController.listCustomTemplates);
router.post("/preview", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.previewTemplate);
router.put("/custom/:id/status", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.setStatus);
router.post("/custom", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.createCustomTemplate);
router.get("/default", cardTemplateController.getDefaultTemplate);
router.put("/default", adminOnly, requireCustomTemplatesWhenSelected, cardTemplateController.setDefaultTemplate);
router.put("/custom/default/clear", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.clearDefaultCustomTemplate);
router.delete("/default", adminOnly, cardTemplateController.clearDefaultCustomTemplate);
router.post("/custom/:id/duplicate", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.duplicateCustomTemplate);
router.post("/logo", canManageCustomTemplates, requireCustomTemplates, upload.single("logo"), cardTemplateController.uploadLogo);
router.post("/background", canManageCustomTemplates, requireCustomTemplates, upload.single("background"), cardTemplateController.uploadBackground);
router.put("/custom/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.updateCustomTemplate);
router.delete("/custom/:id", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.deleteCustomTemplate);
router.put("/custom/:id/default", canManageCustomTemplates, requireCustomTemplates, cardTemplateController.setDefaultCustomTemplate);

module.exports = router;
