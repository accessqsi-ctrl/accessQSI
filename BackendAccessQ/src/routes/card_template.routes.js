const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const cardTemplateController = require("../controllers/api.card_template.controller");

const adminOnly = roleMiddleware(["ORG_ADMIN", "SUPER_ADMIN"]);
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

router.get("/custom", cardTemplateController.listCustomTemplates);
router.post("/custom", adminOnly, cardTemplateController.createCustomTemplate);
router.get("/default", cardTemplateController.getDefaultTemplate);
router.put("/default", adminOnly, cardTemplateController.setDefaultTemplate);
router.put("/custom/default/clear", adminOnly, cardTemplateController.clearDefaultCustomTemplate);
router.delete("/default", adminOnly, cardTemplateController.clearDefaultCustomTemplate);
router.post("/custom/:id/duplicate", adminOnly, cardTemplateController.duplicateCustomTemplate);
router.post("/logo", adminOnly, upload.single("logo"), cardTemplateController.uploadLogo);
router.put("/custom/:id", adminOnly, cardTemplateController.updateCustomTemplate);
router.delete("/custom/:id", adminOnly, cardTemplateController.deleteCustomTemplate);
router.put("/custom/:id/default", adminOnly, cardTemplateController.setDefaultCustomTemplate);

module.exports = router;
