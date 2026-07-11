const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const pdfTemplateController = require("../controllers/api.pdf_template.controller");

router.use(authMiddleware);

router.get("/", pdfTemplateController.listTemplates);
router.post("/generate", pdfTemplateController.generatePdf);
router.get("/generated/:filename/download", pdfTemplateController.downloadGeneratedPdf);
router.get("/:templateId/preview", pdfTemplateController.previewTemplate);

module.exports = router;
